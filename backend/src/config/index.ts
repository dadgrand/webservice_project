import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function parseCookieSecureMode(value: string | undefined): 'auto' | boolean {
  if (!value) return 'auto';

  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto') return 'auto';

  const parsed = parseBoolean(value);
  return parsed === null ? 'auto' : parsed;
}

function parseOriginList(...values: Array<string | undefined>): string[] {
  const items = values
    .flatMap((value) => (value ? value.split(',') : []))
    .map((value) => value.trim())
    .filter(Boolean);

  return items.length > 0 ? Array.from(new Set(items)) : ['http://localhost:5173'];
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Auth cookies
  auth: {
    cookieName: process.env.AUTH_COOKIE_NAME || 'hospital_auth',
    cookieSecureMode: parseCookieSecureMode(process.env.AUTH_COOKIE_SECURE),
    cookieSameSite: 'lax' as const,
    cookieMaxAgeMs: parseInt(process.env.AUTH_COOKIE_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000), 10),
  },

  // File uploads
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB default
  },

  // CORS
  frontendUrls: parseOriginList(process.env.FRONTEND_URLS, process.env.FRONTEND_URL),

  // Networking
  trustProxy: process.env.TRUST_PROXY === 'true',

  // Paths
  paths: {
    uploads: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    logs: path.resolve(process.env.LOG_DIR || './logs'),
  },

  // Logging
  logging: {
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
  },

  // Bootstrap admin
  bootstrapAdmin: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || '',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || '',
  },
};
