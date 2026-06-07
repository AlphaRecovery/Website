import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), override: true });

export const config = {
  root,
  port: Number(process.env.PORTAL_PORT || process.env.PORT || 8787),
  clientOrigin: process.env.PORTAL_CLIENT_ORIGIN || 'http://127.0.0.1:4180',
  clientOrigins: (process.env.PORTAL_CLIENT_ORIGIN || 'http://127.0.0.1:4180').split(',').map((origin) => origin.trim()).filter(Boolean),
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
  resendApiKey: process.env.RESEND_API_KEY || ''
};
