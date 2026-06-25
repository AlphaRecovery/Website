import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const portalRoot = path.resolve('.');

async function runConfigCheck(env) {
  return execFileAsync(process.execPath, [
    '--input-type=module',
    '-e',
    "import { validateProductionConfig } from './server/config.js'; validateProductionConfig(); console.log('ok');"
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
    PORTAL_MAX_UPLOAD_FILE_BYTES: String(4 * 1024 * 1024),
    PORTAL_MAX_UPLOAD_REQUEST_BYTES: String(4 * 1024 * 1024)
  });
  assert.match(result.stdout, /ok/);
});
