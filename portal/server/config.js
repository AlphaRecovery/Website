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
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);
const productionPublicPortalUrl = 'https://portal.alpharecovery.org';
const defaultPublicPortalUrl = isProduction ? productionPublicPortalUrl : defaultClientOrigins[0];

function firstConfiguredOrigin(value) {
  return String(value || '').split(',').map((origin) => origin.trim()).filter(Boolean)[0] || '';
}

function publicPortalUrlIssue(value) {
  if (!value) return 'PUBLIC_PORTAL_URL';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (url.protocol !== 'https:' || isLocalhost) return `PUBLIC_PORTAL_URL=${productionPublicPortalUrl}`;
  } catch {
    return `PUBLIC_PORTAL_URL=${productionPublicPortalUrl}`;
  }
  return '';
}

function configuredPublicPortalUrl() {
  const configured = String(process.env.PUBLIC_PORTAL_URL || '').trim();
  if (configured) return configured;
  if (isProduction) return defaultPublicPortalUrl;
  return firstConfiguredOrigin(process.env.PORTAL_CLIENT_ORIGIN) || defaultPublicPortalUrl;
}

function bytesFromEnv(name, fallback) {
  const value = Number(process.env[name] || 0);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const defaultUploadFileBytes = isProduction && isVercel ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
const defaultUploadRequestBytes = isProduction && isVercel ? 4.5 * 1024 * 1024 : 18 * 1024 * 1024;
const vercelUploadRequestCeilingBytes = 4.5 * 1024 * 1024;

export const config = {
  root,
  port: Number(process.env.PORTAL_PORT || process.env.PORT || 8787),
  clientOrigin: configuredClientOrigins[0] || defaultClientOrigins[0],
  clientOrigins,
  cookieDomain: process.env.PORTAL_COOKIE_DOMAIN || undefined,
  sessionDays: Number(process.env.PORTAL_SESSION_DAYS || 7),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  dataFile: process.env.PORTAL_DATA_FILE || path.join(root, 'server', 'data', 'dev-db.json'),
  uploadsDir: process.env.PORTAL_UPLOADS_DIR || (process.env.VERCEL ? path.join('/tmp', 'alpha-portal-uploads') : path.join(root, 'server', 'storage', 'uploads')),
  storageDriver: process.env.PORTAL_STORAGE_DRIVER || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'local'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'portal-documents',
  maxUploadFileBytes: bytesFromEnv('PORTAL_MAX_UPLOAD_FILE_BYTES', defaultUploadFileBytes),
  maxUploadRequestBytes: bytesFromEnv('PORTAL_MAX_UPLOAD_REQUEST_BYTES', defaultUploadRequestBytes),
  maxUploadFiles: bytesFromEnv('PORTAL_MAX_UPLOAD_FILES', 20),
  recruiterCanViewAllApplications: process.env.RECRUITER_CAN_VIEW_ALL_APPLICATIONS === 'true',
  draftRetentionDays: bytesFromEnv('DRAFT_RETENTION_DAYS', 30),
  rejectedRetentionDays: bytesFromEnv('REJECTED_RETENTION_DAYS', 365),
  withdrawnRetentionDays: bytesFromEnv('WITHDRAWN_RETENTION_DAYS', 365),
  pdfViewWatermarkEnabled: process.env.PDF_VIEW_WATERMARK_ENABLED === 'true',
  publicPortalUrl: configuredPublicPortalUrl(),
  emailDriver: process.env.EMAIL_DRIVER || (process.env.RESEND_API_KEY ? 'resend' : 'log'),
  emailFrom: process.env.EMAIL_FROM || 'Alpha Recovery <no-reply@alpharecovery.org>',
  contactEmail: process.env.CONTACT_EMAIL || 'Admin@alpharecovery.org',
  applicationEmailTo: process.env.APPLICATION_EMAIL_TO || process.env.CONTACT_EMAIL || 'Admin@alpharecovery.org',
  applicationEmailCc: process.env.APPLICATION_EMAIL_CC || 'Topeka.mv@alpharecovery.org',
  resendApiKey: process.env.RESEND_API_KEY || ''
};

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.floor((bytes / 1024 / 1024) * 10) / 10}MB`;
  if (bytes >= 1024) return `${Math.floor(bytes / 102.4) / 10}KB`;
  return `${bytes}B`;
}

export function validateProductionConfig() {
  if (!isProduction) return;

  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL or POSTGRES_URL');

  if (isVercel && config.storageDriver !== 'supabase') {
    missing.push('PORTAL_STORAGE_DRIVER=supabase');
  }
  if (config.storageDriver === 'supabase') {
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!config.supabaseStorageBucket) missing.push('SUPABASE_STORAGE_BUCKET');
  }

  if (isVercel && config.maxUploadRequestBytes > vercelUploadRequestCeilingBytes) {
    missing.push(`PORTAL_MAX_UPLOAD_REQUEST_BYTES<=${Math.floor(vercelUploadRequestCeilingBytes)}`);
  }
  if (config.maxUploadFileBytes > config.maxUploadRequestBytes) {
    missing.push('PORTAL_MAX_UPLOAD_FILE_BYTES<=PORTAL_MAX_UPLOAD_REQUEST_BYTES');
  }

  if (config.emailDriver !== 'resend') missing.push('EMAIL_DRIVER=resend');
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');
  if (!process.env.APPLICATION_EMAIL_TO && !process.env.CONTACT_EMAIL) missing.push('APPLICATION_EMAIL_TO or CONTACT_EMAIL');
  const publicPortalUrlConfigIssue = publicPortalUrlIssue(config.publicPortalUrl);
  if (publicPortalUrlConfigIssue) missing.push(publicPortalUrlConfigIssue);

  if (missing.length) {
    throw new Error(`Unsafe production portal configuration. Missing or invalid: ${missing.join(', ')}.`);
  }
}

export function configClass() {
  return {
    ok: true,
    service: 'alpha-portal',
    mode: process.env.NODE_ENV || 'development',
    database: config.databaseUrl ? 'postgres' : 'local-json',
    storage: config.storageDriver === 'supabase' ? 'supabase-private-required' : 'local',
    email: config.emailDriver === 'resend' ? 'resend' : 'log',
    uploads: {
      maxFileBytes: config.maxUploadFileBytes,
      maxRequestBytes: config.maxUploadRequestBytes,
      maxFiles: config.maxUploadFiles
    },
    retention: {
      draftsDays: config.draftRetentionDays,
      rejectedDays: config.rejectedRetentionDays,
      withdrawnDays: config.withdrawnRetentionDays
    }
  };
}
