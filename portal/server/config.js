import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.VERCEL) {
  // .env holds production credentials and is only loaded when explicitly running
  // in production (npm run start). Local development (npm run dev) loads
  // .env.local so it can never touch the production database, storage, or email.
  const localEnv = path.join(root, '.env.local');
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv, override: true });
  } else {
    dotenv.config({ path: path.join(root, '.env'), override: true });
  }
}

const defaultClientOrigins = [
  'http://127.0.0.1:4180',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://localhost:5173',
  'https://alpharecovery.org',
  'https://www.alpharecovery.org',
  'https://portal.alpharecovery.org'
];
const configuredClientOrigins = (process.env.PORTAL_CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const clientOrigins = Array.from(new Set([...defaultClientOrigins, ...configuredClientOrigins]));

export const config = {
  root,
  port: Number(process.env.PORTAL_PORT || process.env.PORT || 8787),
  clientOrigin: configuredClientOrigins[0] || defaultClientOrigins[0],
  clientOrigins,
  cookieDomain: process.env.PORTAL_COOKIE_DOMAIN || undefined,
  sessionDays: Number(process.env.PORTAL_SESSION_DAYS || 7),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  dataFile: path.join(root, 'server', 'data', 'dev-db.json'),
  uploadsDir: process.env.PORTAL_UPLOADS_DIR || (process.env.VERCEL ? path.join('/tmp', 'alpha-portal-uploads') : path.join(root, 'server', 'storage', 'uploads')),
  storageDriver: process.env.PORTAL_STORAGE_DRIVER || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'local'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'portal-documents',
  publicPortalUrl: process.env.PUBLIC_PORTAL_URL || process.env.PORTAL_CLIENT_ORIGIN || 'http://127.0.0.1:4180',
  emailDriver: process.env.EMAIL_DRIVER || (process.env.RESEND_API_KEY ? 'resend' : 'log'),
  emailFrom: process.env.EMAIL_FROM || 'Alpha Recovery <no-reply@alpharecovery.org>',
  contactEmail: process.env.CONTACT_EMAIL || 'Admin@alpharecovery.org',
  resendApiKey: process.env.RESEND_API_KEY || ''
};
