import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alpha-security-headers-'));
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.PORTAL_DATA_FILE = path.join(tempRoot, 'dev-db.json');
process.env.PORTAL_UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.PORTAL_STORAGE_DRIVER = 'local';
process.env.EMAIL_DRIVER = 'log';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-value';
process.env.RESEND_API_KEY = 'resend-secret-value';
process.env.APPLICATION_EMAIL_TO = 'hr@example.com';

const { default: app } = await import('./app.js');

test('health endpoint reports config class without leaking env values', async (t) => {
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const payload = await response.json();
  const serialized = JSON.stringify(payload);
  assert.equal(payload.ok, true);
  assert.equal(serialized.includes('service-role-secret-value'), false);
  assert.equal(serialized.includes('resend-secret-value'), false);
  assert.equal(serialized.includes('hr@example.com'), false);
  assert.equal(serialized.includes('https://example.supabase.co'), false);
});
