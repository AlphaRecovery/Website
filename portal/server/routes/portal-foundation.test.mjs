import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alpha-portal-foundation-'));
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.PORTAL_DATA_FILE = path.join(tempRoot, 'dev-db.json');
process.env.PORTAL_UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.PORTAL_STORAGE_DRIVER = 'local';
process.env.EMAIL_DRIVER = 'log';
process.env.PUBLIC_PORTAL_URL = 'http://127.0.0.1:4180';
process.env.RETENTION_WARNING_HOURS = '48';
process.env.DRAFT_RETENTION_DAYS = '7';
process.env.APPLICANT_INACTIVE_RETENTION_DAYS = '10';

const { default: app } = await import('../app.js');
const { getDb, insert, saveDbNow } = await import('../data/store.js');
const { hashPassword } = await import('../auth.js');
const { runRetentionCleanup } = await import('../retention.js');

function resetDb() {
  const db = getDb();
  for (const key of Object.keys(db)) {
    if (Array.isArray(db[key])) db[key] = [];
  }
}

function cookie(response) {
  const raw = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function json(baseUrl, pathName, { method = 'GET', cookie: requestCookie = '', body } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(requestCookie ? { Cookie: requestCookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { response, body: await response.json().catch(() => ({})), cookie: cookie(response) };
}

async function withServer(t) {
  resetDb();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function createUser(data) {
  return insert('users', {
    email: data.email,
    password_hash: await hashPassword(data.password || 'password-123'),
    role: data.role,
    full_name: data.full_name,
    phone: data.phone || '',
    location: data.location || '',
    status: data.status || 'active',
    force_password_change: false,
    created_at: data.created_at
  });
}

test('user management separates staff from applicant-only accounts and enforces manager admin limits', async (t) => {
  const baseUrl = await withServer(t);
  const admin = await createUser({ email: 'admin@example.com', role: 'admin', full_name: 'Admin User' });
  const manager = await createUser({ email: 'manager@example.com', role: 'manager', full_name: 'Manager User' });
  await createUser({ email: 'applicant@example.com', role: 'applicant', full_name: 'Applicant User' });
  await saveDbNow();

  const adminLogin = await json(baseUrl, '/api/auth/login', { method: 'POST', body: { email: admin.email, password: 'password-123' } });
  const users = await json(baseUrl, '/api/admin/users', { cookie: adminLogin.cookie });
  assert.equal(users.response.status, 200);
  assert.deepEqual(users.body.users.map((user) => user.role).sort(), ['admin', 'manager']);

  const managerLogin = await json(baseUrl, '/api/auth/login', { method: 'POST', body: { email: manager.email, password: 'password-123' } });
  const denied = await json(baseUrl, `/api/auth/users/${admin.id}/role`, {
    method: 'PATCH',
    cookie: managerLogin.cookie,
    body: { role: 'recruiter' }
  });
  assert.equal(denied.response.status, 403);

  const changed = await json(baseUrl, `/api/auth/users/${manager.id}/role`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: { role: 'hr' }
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.user.role, 'hr');
});

test('profile settings lock names and require email confirmation', async (t) => {
  const baseUrl = await withServer(t);
  const user = await createUser({ email: 'profile@example.com', role: 'applicant', full_name: 'Profile User' });
  await saveDbNow();
  const login = await json(baseUrl, '/api/auth/login', { method: 'POST', body: { email: user.email, password: 'password-123' } });

  const locked = await json(baseUrl, '/api/auth/profile', {
    method: 'PATCH',
    cookie: login.cookie,
    body: { first_name: 'Changed', phone: '555' }
  });
  assert.equal(locked.response.status, 400);

  const saved = await json(baseUrl, '/api/auth/profile', {
    method: 'PATCH',
    cookie: login.cookie,
    body: {
      phone: '404-555-0101',
      location: 'GA',
      notification_preferences: { email_messages: false }
    }
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.profile.phone, '404-555-0101');
  assert.equal(saved.body.profile.notification_preferences.email_messages, false);

  const requested = await json(baseUrl, '/api/auth/profile/email-change', {
    method: 'POST',
    cookie: login.cookie,
    body: { email: 'new-profile@example.com', currentPassword: 'password-123' }
  });
  assert.equal(requested.response.status, 200);
  assert.equal(getDb().users.find((row) => row.id === user.id).email, 'profile@example.com');

  const confirmed = await json(baseUrl, '/api/auth/profile/email-change/confirm', {
    method: 'POST',
    body: { token: requested.body.dev_email_change_token }
  });
  assert.equal(confirmed.response.status, 200);
  assert.equal(getDb().users.find((row) => row.id === user.id).email, 'new-profile@example.com');
});

test('email recovery creates a visible application with canonical PDF and duplicate protection', async (t) => {
  const baseUrl = await withServer(t);
  const admin = await createUser({ email: 'admin@example.com', role: 'admin', full_name: 'Admin User' });
  await createUser({ email: 'rondae.russell@gmail.com', role: 'applicant', full_name: 'Delrondae Russell' });
  insert('employment_application_submissions', {
    user_id: null,
    email: 'rondae.russell@gmail.com',
    role_slug: 'operations-manager',
    role_title: 'Operations Manager',
    department: 'Field Operations',
    location: 'Atlanta, GA',
    employment_type: 'Full Time',
    full_name: 'Delrondae Russell',
    confirmation_number: 'FO-2026-03760-1121EE',
    delivery: 'email',
    uploaded_files: [{ field: 'resume', label: 'Resume', original_name: 'Delrondae_Russell_Resume_AlphaRecovery.pdf' }],
    submitted_at: '2026-06-24T23:42:48.582Z'
  });
  await saveDbNow();
  const login = await json(baseUrl, '/api/auth/login', { method: 'POST', body: { email: admin.email, password: 'password-123' } });

  const form = new FormData();
  form.append('confirmationNumber', 'FO-2026-03760-1121EE');
  form.append('email', 'rondae.russell@gmail.com');
  form.append('applicationPdf', new Blob(['%PDF-1.4\napplication'], { type: 'application/pdf' }), 'operations-manager-application-FO-2026-03760-1121EE.pdf');
  const response = await fetch(`${baseUrl}/api/admin/recovery/email-application`, {
    method: 'POST',
    headers: { Cookie: login.cookie },
    body: form
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.recovered, true);
  assert.equal(body.application.source, 'email_recovery');
  assert.ok(body.application.files.some((file) => file.field === 'applicationPdf' && file.path));
  assert.ok(body.application.files.some((file) => file.storageStatus === 'metadata_only'));

  const duplicate = await fetch(`${baseUrl}/api/admin/recovery/email-application`, {
    method: 'POST',
    headers: { Cookie: login.cookie },
    body: form
  });
  assert.equal(duplicate.status, 200);
  assert.equal(getDb().employment_applications.length, 1);

  const list = await json(baseUrl, '/api/applications', { cookie: login.cookie });
  assert.equal(list.body.applications[0].confirmation_number, 'FO-2026-03760-1121EE');
});

test('retention warns before deleting and never deletes protected applicant users', async () => {
  resetDb();
  const old = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();
  const warned = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const inactive = await createUser({ email: 'inactive@example.com', role: 'applicant', full_name: 'Inactive Applicant', created_at: old });
  const protectedUser = await createUser({ email: 'protected@example.com', role: 'applicant', full_name: 'Protected Applicant', created_at: old });
  insert('employment_application_drafts', {
    user_id: inactive.id,
    email: inactive.email,
    role_slug: 'operations-manager',
    role_title: 'Operations Manager',
    section: 3,
    payload: {},
    updated_at: old
  });
  insert('employment_applications', {
    user_id: protectedUser.id,
    email: protectedUser.email,
    role_slug: 'operations-manager',
    role_title: 'Operations Manager',
    full_name: protectedUser.full_name,
    confirmation_number: 'FO-2026-01234-TEST',
    status: 'Hired',
    files: [],
    payload: {},
    submitted_at: old
  });
  await saveDbNow();

  const warning = await runRetentionCleanup({ execute: true });
  assert.equal(warning.draftWarnings, 1);
  assert.equal(getDb().employment_application_drafts.length, 1);
  assert.ok(getDb().users.some((user) => user.id === inactive.id));

  getDb().employment_application_drafts[0].retention_warning_sent_at = warned;
  getDb().users.find((user) => user.id === inactive.id).retention_warning_sent_at = warned;
  getDb().employment_application_drafts[0].updated_at = old;
  getDb().users.find((user) => user.id === inactive.id).last_active_at = old;
  const deleted = await runRetentionCleanup({ execute: true });
  assert.equal(deleted.draftsDeleted, 1);
  assert.equal(getDb().employment_application_drafts.length, 0);
  assert.ok(!getDb().users.some((user) => user.id === inactive.id));
  assert.ok(getDb().users.some((user) => user.id === protectedUser.id));
});

test.after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});
