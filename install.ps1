param(
  [switch]$KeepData,
  [string]$AdminEmail,
  [string]$AdminPassword
)

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $RootDir '.env'

function Show-Usage {
  Write-Host 'Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1 [-KeepData] [-AdminEmail <email>] [-AdminPassword <password>]'
}

function Write-Info {
  param([string]$Message)
  Write-Host $Message
}

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Show-Requirements {
  Write-Host @'
Hospital Web Service installer

Before startup, install exactly this:
- Windows: Docker Desktop for Windows -> https://www.docker.com/products/docker-desktop/
- macOS: Docker Desktop for Mac -> https://www.docker.com/products/docker-desktop/
- Linux: Docker Engine -> https://docs.docker.com/engine/install/
- Linux: Docker Compose plugin -> https://docs.docker.com/compose/install/linux/

No Node.js, npm or PostgreSQL installation is required on the host machine.
After installation, launch Docker and rerun this script.
'@
}

function New-SecureToken {
  param([int]$Length)

  while ($true) {
    $bytes = New-Object byte[] ($Length * 2)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $token = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '')
    if ($token.Length -ge $Length) {
      return $token.Substring(0, $Length)
    }
  }
}

function Get-RawEnvValue {
  param([string]$Key)

  if (-not (Test-Path $EnvFile)) {
    return $null
  }

  $line = Get-Content $EnvFile | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -split '=', 2)[1].Trim()
}

function Get-EnvValueOrDefault {
  param(
    [string]$Key,
    [string]$DefaultValue,
    [string]$Placeholder = ''
  )

  $currentValue = Get-RawEnvValue $Key
  if ($currentValue -and (($Placeholder -eq '') -or ($currentValue -ne $Placeholder))) {
    return $currentValue
  }

  return $DefaultValue
}

function Write-EnvFile {
  $postgresDb = Get-EnvValueOrDefault 'POSTGRES_DB' 'hospital_db'
  $postgresUser = Get-EnvValueOrDefault 'POSTGRES_USER' 'postgres'
  $postgresPassword = Get-EnvValueOrDefault 'POSTGRES_PASSWORD' (New-SecureToken 24) 'change-me-db-password'
  $jwtSecret = Get-EnvValueOrDefault 'JWT_SECRET' (New-SecureToken 48) 'change-me-jwt-secret'
  $postgresPort = Get-EnvValueOrDefault 'POSTGRES_PORT' '5432'
  $backendPort = Get-EnvValueOrDefault 'BACKEND_PORT' '3001'
  $frontendPort = Get-EnvValueOrDefault 'FRONTEND_PORT' '8080'
  $frontendUrls = Get-EnvValueOrDefault 'FRONTEND_URLS' "http://localhost:$frontendPort,http://127.0.0.1:$frontendPort"
  $defaultAdminEmail = Get-EnvValueOrDefault 'BOOTSTRAP_ADMIN_EMAIL' 'admin@hospital.local'
  $defaultAdminPassword = Get-EnvValueOrDefault 'BOOTSTRAP_ADMIN_PASSWORD' (New-SecureToken 20) 'ChangeMe123!'
  $authCookieSecure = Get-EnvValueOrDefault 'AUTH_COOKIE_SECURE' 'auto'
  $trustProxy = Get-EnvValueOrDefault 'TRUST_PROXY' 'false'
  $maxFileSize = Get-EnvValueOrDefault 'MAX_FILE_SIZE' '52428800'
  $logMaxSize = Get-EnvValueOrDefault 'LOG_MAX_SIZE' '20m'
  $logMaxFiles = Get-EnvValueOrDefault 'LOG_MAX_FILES' '14d'

  $bootstrapAdminEmail = if ($AdminEmail) { $AdminEmail } else { $defaultAdminEmail }
  $bootstrapAdminPassword = if ($AdminPassword) { $AdminPassword } else { $defaultAdminPassword }

  @"
POSTGRES_DB=$postgresDb
POSTGRES_USER=$postgresUser
POSTGRES_PASSWORD=$postgresPassword
JWT_SECRET=$jwtSecret
FRONTEND_URLS=$frontendUrls
BOOTSTRAP_ADMIN_EMAIL=$bootstrapAdminEmail
BOOTSTRAP_ADMIN_PASSWORD=$bootstrapAdminPassword
POSTGRES_PORT=$postgresPort
BACKEND_PORT=$backendPort
FRONTEND_PORT=$frontendPort
AUTH_COOKIE_SECURE=$authCookieSecure
TRUST_PROXY=$trustProxy
MAX_FILE_SIZE=$maxFileSize
LOG_MAX_SIZE=$logMaxSize
LOG_MAX_FILES=$logMaxFiles
"@ | Set-Content -Path $EnvFile -Encoding ascii

  Write-Info ".env prepared: $EnvFile"
}

function Set-EnvValue {
  param(
    [string]$Key,
    [string]$Value
  )

  $lines = if (Test-Path $EnvFile) { Get-Content $EnvFile } else { @() }
  $updated = $false
  $newLines = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") {
      $updated = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $updated) {
    $newLines += "$Key=$Value"
  }

  $newLines | Set-Content -Path $EnvFile -Encoding ascii
}

function Require-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker CLI is not installed. Read the links above and install Docker first.'
  }

  try {
    & docker compose version *> $null
  } catch {
    Fail 'Docker Compose plugin is missing. Install Docker Compose and rerun the installer.'
  }

  try {
    & docker info *> $null
  } catch {
    Fail 'Docker is installed, but the Docker daemon is not running.'
  }
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & docker compose @Args
}

function Test-PortInUse {
  param([int]$Port)

  try {
    return @((Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)).Count -gt 0
  }
  catch {
    return $false
  }
}

function Get-FreePort {
  param([int]$StartPort)

  $port = $StartPort
  while (Test-PortInUse $port) {
    $port++
  }

  return $port
}

function Update-FrontendUrlsForPort {
  param(
    [int]$OldPort,
    [int]$NewPort
  )

  $currentUrls = Get-RawEnvValue 'FRONTEND_URLS'
  if (-not $currentUrls -or $currentUrls -eq "http://localhost:$OldPort,http://127.0.0.1:$OldPort") {
    Set-EnvValue 'FRONTEND_URLS' "http://localhost:$NewPort,http://127.0.0.1:$NewPort"
  }
}

function Ensure-FreePort {
  param(
    [string]$EnvKey,
    [string]$Label
  )

  $currentPortText = Get-RawEnvValue $EnvKey
  if (-not $currentPortText) {
    return
  }

  $currentPort = [int]$currentPortText
  if (-not (Test-PortInUse $currentPort)) {
    return
  }

  $freePort = Get-FreePort $currentPort
  Set-EnvValue $EnvKey ([string]$freePort)

  if ($EnvKey -eq 'FRONTEND_PORT') {
    Update-FrontendUrlsForPort -OldPort $currentPort -NewPort $freePort
  }

  Write-Info "Port $currentPort for $Label is busy. Using $freePort instead."
}

function Wait-ForService {
  param(
    [string]$Service,
    [int]$TimeoutSeconds
  )

  $elapsed = 0
  while ($elapsed -lt $TimeoutSeconds) {
    $containerId = (& docker compose ps -q $Service).Trim()
    if ($containerId) {
      $status = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId).Trim()
      switch ($status) {
        'healthy' { return }
        'running' { return }
        'unhealthy' {
          Invoke-Compose logs --no-color $Service
          Fail "Service '$Service' became unhealthy during startup."
        }
        'exited' {
          Invoke-Compose logs --no-color $Service
          Fail "Service '$Service' exited during startup."
        }
        'dead' {
          Invoke-Compose logs --no-color $Service
          Fail "Service '$Service' exited during startup."
        }
      }
    }

    Start-Sleep -Seconds 3
    $elapsed += 3
  }

  Invoke-Compose ps
  Invoke-Compose logs --no-color $Service
  Fail "Service '$Service' did not become ready within $TimeoutSeconds seconds."
}

function Invoke-DatabaseScalar {
  param([string]$Sql)

  $postgresUser = Get-RawEnvValue 'POSTGRES_USER'
  $postgresDb = Get-RawEnvValue 'POSTGRES_DB'
  return ((& docker compose exec -T postgres psql -U $postgresUser -d $postgresDb -t -A -c $Sql) -join '').Trim()
}

function Verify-DatabaseShape {
  $usersCount = Invoke-DatabaseScalar 'SELECT COUNT(*) FROM users;'
  $adminCount = Invoke-DatabaseScalar 'SELECT COUNT(*) FROM users WHERE "isAdmin" = TRUE AND "isActive" = TRUE;'
  $departmentsCount = Invoke-DatabaseScalar 'SELECT COUNT(*) FROM departments;'

  if ($usersCount -ne '1' -or $adminCount -ne '1' -or $departmentsCount -ne '0') {
    Fail "Unexpected database state detected (users=$usersCount, admins=$adminCount, departments=$departmentsCount). Re-run the installer without -KeepData for a fully clean delivery start."
  }
}

function Verify-AdminLogin {
  $bootstrapAdminEmail = Get-RawEnvValue 'BOOTSTRAP_ADMIN_EMAIL'
  $bootstrapAdminPassword = Get-RawEnvValue 'BOOTSTRAP_ADMIN_PASSWORD'
  $script = "const email = process.env.CHECK_EMAIL; const password = process.env.CHECK_PASSWORD; async function main() { const response = await fetch('http://127.0.0.1:3001/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); if (!response.ok) { const body = await response.text(); console.error(body); process.exit(1); } const payload = await response.json(); if (!payload?.data?.user?.isAdmin) { console.error('Admin login verification failed.'); process.exit(1); } } main().catch((error) => { console.error(error); process.exit(1); });"

  & docker compose exec -T `
    -e "CHECK_EMAIL=$bootstrapAdminEmail" `
    -e "CHECK_PASSWORD=$bootstrapAdminPassword" `
    backend `
    node -e $script
}

Show-Requirements
Require-Docker
Write-EnvFile

if ($KeepData) {
  Write-Info 'Keep-data mode: existing Docker volumes will be preserved.'
  try {
    Invoke-Compose down --remove-orphans *> $null
  } catch {
  }
} else {
  Write-Info 'Clean install mode: existing project Docker volumes will be removed.'
  try {
    Invoke-Compose down -v --remove-orphans *> $null
  } catch {
  }

  Ensure-FreePort 'POSTGRES_PORT' 'PostgreSQL'
  Ensure-FreePort 'BACKEND_PORT' 'backend API'
  Ensure-FreePort 'FRONTEND_PORT' 'frontend'
}

Write-Info 'Building and starting containers...'
Invoke-Compose up -d --build

Write-Info 'Waiting for Postgres...'
Wait-ForService 'postgres' 120
Write-Info 'Waiting for backend...'
Wait-ForService 'backend' 180
Write-Info 'Waiting for frontend...'
Wait-ForService 'frontend' 180

Write-Info 'Verifying database contents...'
Verify-DatabaseShape
Write-Info 'Verifying admin login...'
Verify-AdminLogin

$frontendPort = Get-RawEnvValue 'FRONTEND_PORT'
$bootstrapAdminEmail = Get-RawEnvValue 'BOOTSTRAP_ADMIN_EMAIL'
$bootstrapAdminPassword = Get-RawEnvValue 'BOOTSTRAP_ADMIN_PASSWORD'

Write-Host @"

Project is ready.

- URL: http://localhost:$frontendPort
- Admin email: $bootstrapAdminEmail
- Admin password: $bootstrapAdminPassword

Verified automatically:
- PostgreSQL is healthy
- Backend is healthy
- Frontend is healthy
- Database contains exactly 1 active admin user
- Database contains 0 departments
- Admin login succeeds
"@
