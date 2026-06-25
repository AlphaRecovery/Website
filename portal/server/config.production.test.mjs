import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const portalRoot = path.resolve('.');

async function runConfigCheck(env, source = "import { validateProductionConfig } from './server/config.js'; validateProductionConfig(); console.log('ok');") {
  return execFileAsync(process.execPath, [
    '--input-type=module',
    '-e',
    source
  ], {
    cwd: portalRoot,
    env: { ...process.env, ...env }
  });
}

test('production config fails fast when required production services are missing', async () => {
  await assert.rejects(
    runConfigCheck({
      NODE_ENV: 'production',
      VERCEL: '1',
      DATABASE_URL: '',
      POSTGRES_URL: '',
      PORTAL_STORAGE_DRIVER: 'local',
      EMAIL_DRIVER: 'log',
      RESEND_API_KEY: ''
    }),
    /Unsafe production portal configuration/
  );
});

test('production config accepts complete safe configuration classes', async () => {
  const result = await runConfigCheck({
    NODE_ENV: 'production',
    VERCEL: '1',
    DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
    POSTGRES_URL: '',
    DATABASE_SSL: 'true',
    PORTAL_STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_STORAGE_BUCKET: 'portal-documents',
    EMAIL_DRIVER: 'resend',
    RESEND_API_KEY: 'resend-key',
    EMAIL_FROM: 'Alpha Recovery <no-reply@example.com>',
    APPLICATION_EMAIL_TO: 'hr@example.com',
    PUBLIC_PORTAL_URL: 'https://portal.alpharecovery.org',
    PORTAL_MAX_UPLOAD_FILE_BYTES: String(4 * 1024 * 1024),
    PORTAL_MAX_UPLOAD_REQUEST_BYTES: String(4 * 1024 * 1024)
  });
  assert.match(result.stdout, /ok/);
});

test('production config rejects local public portal URLs in outbound links', async () => {
  await assert.rejects(
    runConfigCheck({
      NODE_ENV: 'production',
      VERCEL: '1',
      DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
      POSTGRES_URL: '',
      DATABASE_SSL: 'true',
      PORTAL_STORAGE_DRIVER: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_STORAGE_BUCKET: 'portal-documents',
      EMAIL_DRIVER: 'resend',
      RESEND_API_KEY: 'resend-key',
      EMAIL_FROM: 'Alpha Recovery <no-reply@example.com>',
      APPLICATION_EMAIL_TO: 'hr@example.com',
      PUBLIC_PORTAL_URL: 'http://127.0.0.1:4180',
      PORTAL_MAX_UPLOAD_FILE_BYTES: String(4 * 1024 * 1024),
      PORTAL_MAX_UPLOAD_REQUEST_BYTES: String(4 * 1024 * 1024)
    }),
    /PUBLIC_PORTAL_URL=https:\/\/portal\.alpharecovery\.org/
  );
});

test('production config falls back to the public portal domain when URL is not configured', async () => {
  const result = await runConfigCheck({
    NODE_ENV: 'production',
    VERCEL: '1',
    DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
    POSTGRES_URL: '',
    DATABASE_SSL: 'true',
    PORTAL_STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_STORAGE_BUCKET: 'portal-documents',
    EMAIL_DRIVER: 'resend',
    RESEND_API_KEY: 'resend-key',
    EMAIL_FROM: 'Alpha Recovery <no-reply@example.com>',
    APPLICATION_EMAIL_TO: 'hr@example.com',
    PUBLIC_PORTAL_URL: '',
    PORTAL_CLIENT_ORIGIN: 'https://alpharecovery.org,https://www.alpharecovery.org',
    PORTAL_MAX_UPLOAD_FILE_BYTES: String(4 * 1024 * 1024),
    PORTAL_MAX_UPLOAD_REQUEST_BYTES: String(4 * 1024 * 1024)
  }, "import { config, validateProductionConfig } from './server/config.js'; import { portalUrl } from './server/email.js'; validateProductionConfig(); console.log(config.publicPortalUrl); console.log(portalUrl('/admin?application=test'));");

  assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
    'https://portal.alpharecovery.org',
    'https://portal.alpharecovery.org/admin?application=test'
  ]);
});

test('production config treats blank public portal URL as not configured', async () => {
  const result = await runConfigCheck({
    NODE_ENV: 'production',
    VERCEL: '1',
    DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
    POSTGRES_URL: '',
    DATABASE_SSL: 'true',
    PORTAL_STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_STORAGE_BUCKET: 'portal-documents',
    EMAIL_DRIVER: 'resend',
    RESEND_API_KEY: 'resend-key',
    EMAIL_FROM: 'Alpha Recovery <no-reply@example.com>',
    APPLICATION_EMAIL_TO: 'hr@example.com',
    PUBLIC_PORTAL_URL: '   ',
    PORTAL_MAX_UPLOAD_FILE_BYTES: String(4 * 1024 * 1024),
    PORTAL_MAX_UPLOAD_REQUEST_BYTES: String(4 * 1024 * 1024)
  }, "import { config, validateProductionConfig } from './server/config.js'; validateProductionConfig(); console.log(config.publicPortalUrl);");

  assert.equal(result.stdout.trim(), 'https://portal.alpharecovery.org');
});
