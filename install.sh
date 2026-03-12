#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$ROOT_DIR/.env"
KEEP_DATA=0
ADMIN_EMAIL_OVERRIDE=''
ADMIN_PASSWORD_OVERRIDE=''

usage() {
  cat <<'EOF'
Usage:
  bash ./install.sh [--keep-data] [--admin-email=<email>] [--admin-password=<password>]

Options:
  --keep-data                 Start containers without deleting project Docker volumes first.
  --admin-email=<email>       Override BOOTSTRAP_ADMIN_EMAIL in .env.
  --admin-password=<secret>   Override BOOTSTRAP_ADMIN_PASSWORD in .env.
  -h, --help                  Show this help.
EOF
}

info() {
  printf '%s\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

show_requirements() {
  cat <<'EOF'
Hospital Web Service installer

Before startup, install exactly this:
- Windows: Docker Desktop for Windows -> https://www.docker.com/products/docker-desktop/
- macOS: Docker Desktop for Mac -> https://www.docker.com/products/docker-desktop/
- Linux: Docker Engine -> https://docs.docker.com/engine/install/
- Linux: Docker Compose plugin -> https://docs.docker.com/compose/install/linux/

No Node.js, npm or PostgreSQL installation is required on the host machine.
After installation, launch Docker and rerun this script.
EOF
}

generate_secret() {
  length=$1

  if command -v openssl >/dev/null 2>&1; then
    secret=$(openssl rand -base64 96 | tr -dc 'A-Za-z0-9' | cut -c1-"$length")
    if [ "${#secret}" -eq "$length" ]; then
      printf '%s' "$secret"
      return
    fi
  fi

  if [ -r /dev/urandom ]; then
    secret=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | cut -c1-"$length")
    if [ "${#secret}" -eq "$length" ]; then
      printf '%s' "$secret"
      return
    fi
  fi

  fail 'Unable to generate a secure secret on this machine.'
}

raw_env_value() {
  key=$1

  if [ ! -f "$ENV_FILE" ]; then
    return 1
  fi

  value=$(sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1)
  if [ -z "$value" ]; then
    return 1
  fi

  printf '%s' "$value"
}

set_env_value() {
  key=$1
  value=$2
  tmp_file=$(mktemp)

  awk -v target_key="$key" -v target_value="$value" '
    BEGIN { updated = 0 }
    index($0, target_key "=") == 1 {
      print target_key "=" target_value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print target_key "=" target_value
      }
    }
  ' "$ENV_FILE" > "$tmp_file"

  mv "$tmp_file" "$ENV_FILE"
}

env_value_or_default() {
  key=$1
  default_value=$2
  placeholder=${3-}

  current_value=$(raw_env_value "$key" 2>/dev/null || true)
  if [ -n "$current_value" ] && { [ -z "$placeholder" ] || [ "$current_value" != "$placeholder" ]; }; then
    printf '%s' "$current_value"
    return
  fi

  printf '%s' "$default_value"
}

write_env_file() {
  postgres_db=$(env_value_or_default POSTGRES_DB 'hospital_db')
  postgres_user=$(env_value_or_default POSTGRES_USER 'postgres')
  postgres_password=$(env_value_or_default POSTGRES_PASSWORD "$(generate_secret 24)" 'change-me-db-password')
  jwt_secret=$(env_value_or_default JWT_SECRET "$(generate_secret 48)" 'change-me-jwt-secret')
  postgres_port=$(env_value_or_default POSTGRES_PORT '5432')
  backend_port=$(env_value_or_default BACKEND_PORT '3001')
  frontend_port=$(env_value_or_default FRONTEND_PORT '8080')
  default_frontend_urls="http://localhost:${frontend_port},http://127.0.0.1:${frontend_port}"
  frontend_urls=$(env_value_or_default FRONTEND_URLS "$default_frontend_urls")
  admin_email_default=$(env_value_or_default BOOTSTRAP_ADMIN_EMAIL 'admin@hospital.local')
  admin_password_default=$(env_value_or_default BOOTSTRAP_ADMIN_PASSWORD "$(generate_secret 20)" 'ChangeMe123!')
  auth_cookie_secure=$(env_value_or_default AUTH_COOKIE_SECURE 'auto')
  trust_proxy=$(env_value_or_default TRUST_PROXY 'false')
  max_file_size=$(env_value_or_default MAX_FILE_SIZE '52428800')
  log_max_size=$(env_value_or_default LOG_MAX_SIZE '20m')
  log_max_files=$(env_value_or_default LOG_MAX_FILES '14d')

  bootstrap_admin_email=${ADMIN_EMAIL_OVERRIDE:-$admin_email_default}
  bootstrap_admin_password=${ADMIN_PASSWORD_OVERRIDE:-$admin_password_default}

  cat > "$ENV_FILE" <<EOF
POSTGRES_DB=$postgres_db
POSTGRES_USER=$postgres_user
POSTGRES_PASSWORD=$postgres_password
JWT_SECRET=$jwt_secret
FRONTEND_URLS=$frontend_urls
BOOTSTRAP_ADMIN_EMAIL=$bootstrap_admin_email
BOOTSTRAP_ADMIN_PASSWORD=$bootstrap_admin_password
POSTGRES_PORT=$postgres_port
BACKEND_PORT=$backend_port
FRONTEND_PORT=$frontend_port
AUTH_COOKIE_SECURE=$auth_cookie_secure
TRUST_PROXY=$trust_proxy
MAX_FILE_SIZE=$max_file_size
LOG_MAX_SIZE=$log_max_size
LOG_MAX_FILES=$log_max_files
EOF

  if [ -f "$ENV_FILE" ]; then
    info ".env prepared: $ENV_FILE"
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail 'Docker CLI is not installed. Read the links above and install Docker first.'
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail 'Docker Compose plugin is missing. Install Docker Compose and rerun the installer.'
  fi

  if ! docker info >/dev/null 2>&1; then
    fail 'Docker is installed, but the Docker daemon is not running.'
  fi
}

compose() {
  docker compose "$@"
}

port_in_use() {
  port=$1

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return $?
  fi

  return 1
}

next_free_port() {
  port=$1
  while port_in_use "$port"; do
    port=$((port + 1))
  done

  printf '%s' "$port"
}

update_frontend_urls_for_port() {
  old_port=$1
  new_port=$2
  current_urls=$(raw_env_value FRONTEND_URLS 2>/dev/null || true)

  case "$current_urls" in
    "http://localhost:${old_port},http://127.0.0.1:${old_port}"|"")
      set_env_value FRONTEND_URLS "http://localhost:${new_port},http://127.0.0.1:${new_port}"
      ;;
  esac
}

ensure_free_port() {
  env_key=$1
  label=$2
  current_port=$(raw_env_value "$env_key" 2>/dev/null || true)

  if [ -z "$current_port" ] || ! port_in_use "$current_port"; then
    return
  fi

  free_port=$(next_free_port "$current_port")
  set_env_value "$env_key" "$free_port"

  if [ "$env_key" = 'FRONTEND_PORT' ]; then
    update_frontend_urls_for_port "$current_port" "$free_port"
  fi

  info "Port $current_port for $label is busy. Using $free_port instead."
}

wait_for_service() {
  service=$1
  timeout_seconds=$2
  elapsed=0

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    container_id=$(compose ps -q "$service" 2>/dev/null || true)
    if [ -n "$container_id" ]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)
      case "$status" in
        healthy|running)
          return 0
          ;;
        unhealthy)
          compose logs --no-color "$service" || true
          fail "Service '$service' became unhealthy during startup."
          ;;
        exited|dead)
          compose logs --no-color "$service" || true
          fail "Service '$service' exited during startup."
          ;;
      esac
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  compose ps || true
  compose logs --no-color "$service" || true
  fail "Service '$service' did not become ready within ${timeout_seconds} seconds."
}

query_scalar() {
  sql=$1
  postgres_user=$(raw_env_value POSTGRES_USER)
  postgres_db=$(raw_env_value POSTGRES_DB)
  compose exec -T postgres psql -U "$postgres_user" -d "$postgres_db" -t -A -c "$sql" | tr -d '[:space:]'
}

verify_database_shape() {
  users_count=$(query_scalar 'SELECT COUNT(*) FROM users;')
  admin_count=$(query_scalar 'SELECT COUNT(*) FROM users WHERE "isAdmin" = TRUE AND "isActive" = TRUE;')
  departments_count=$(query_scalar 'SELECT COUNT(*) FROM departments;')

  if [ "$users_count" != '1' ] || [ "$admin_count" != '1' ] || [ "$departments_count" != '0' ]; then
    fail "Unexpected database state detected (users=$users_count, admins=$admin_count, departments=$departments_count). Re-run the installer without --keep-data for a fully clean delivery start."
  fi
}

verify_admin_login() {
  admin_email=$(raw_env_value BOOTSTRAP_ADMIN_EMAIL)
  admin_password=$(raw_env_value BOOTSTRAP_ADMIN_PASSWORD)

  compose exec -T \
    -e CHECK_EMAIL="$admin_email" \
    -e CHECK_PASSWORD="$admin_password" \
    backend \
    node -e "const email = process.env.CHECK_EMAIL; const password = process.env.CHECK_PASSWORD; async function main() { const response = await fetch('http://127.0.0.1:3001/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); if (!response.ok) { const body = await response.text(); console.error(body); process.exit(1); } const payload = await response.json(); if (!payload?.data?.user?.isAdmin) { console.error('Admin login verification failed.'); process.exit(1); } } main().catch((error) => { console.error(error); process.exit(1); });"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --keep-data)
      KEEP_DATA=1
      shift
      ;;
    --admin-email=*)
      ADMIN_EMAIL_OVERRIDE=${1#*=}
      shift
      ;;
    --admin-password=*)
      ADMIN_PASSWORD_OVERRIDE=${1#*=}
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      fail "Unknown option: $1"
      ;;
  esac
done

show_requirements
require_docker
write_env_file

if [ "$KEEP_DATA" -eq 1 ]; then
  info 'Keep-data mode: existing Docker volumes will be preserved.'
  compose down --remove-orphans >/dev/null 2>&1 || true
else
  info 'Clean install mode: existing project Docker volumes will be removed.'
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  ensure_free_port POSTGRES_PORT 'PostgreSQL'
  ensure_free_port BACKEND_PORT 'backend API'
  ensure_free_port FRONTEND_PORT 'frontend'
fi

info 'Building and starting containers...'
compose up -d --build

info 'Waiting for Postgres...'
wait_for_service postgres 120
info 'Waiting for backend...'
wait_for_service backend 180
info 'Waiting for frontend...'
wait_for_service frontend 180

info 'Verifying database contents...'
verify_database_shape
info 'Verifying admin login...'
verify_admin_login

frontend_port=$(raw_env_value FRONTEND_PORT)
bootstrap_admin_email=$(raw_env_value BOOTSTRAP_ADMIN_EMAIL)
bootstrap_admin_password=$(raw_env_value BOOTSTRAP_ADMIN_PASSWORD)

cat <<EOF

Project is ready.

- URL: http://localhost:${frontend_port}
- Admin email: ${bootstrap_admin_email}
- Admin password: ${bootstrap_admin_password}

Verified automatically:
- PostgreSQL is healthy
- Backend is healthy
- Frontend is healthy
- Database contains exactly 1 active admin user
- Database contains 0 departments
- Admin login succeeds
EOF
