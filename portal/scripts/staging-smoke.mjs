const baseUrl = (process.env.SMOKE_BASE_URL || process.env.PUBLIC_PORTAL_URL || '').replace(/\/$/, '');
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || '';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || '';

if (!baseUrl) {
  console.error('SMOKE_BASE_URL or PUBLIC_PORTAL_URL is required.');
  process.exit(1);
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function request(path, { method = 'GET', cookie = '', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${payload.error || response.statusText}`);
  return { response, payload, cookie: cookieFrom(response) };
}

const health = await request('/api/health');
for (const forbidden of ['SUPABASE', 'RESEND', '@', 'postgres://']) {
  if (JSON.stringify(health.payload).includes(forbidden)) {
    throw new Error(`Health endpoint leaked forbidden marker: ${forbidden}`);
  }
}
console.log('Health check passed.');

if (adminEmail && adminPassword) {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword }
  });
  await request('/api/admin/employment-applications', { cookie: login.cookie });
  await request('/api/activity', { cookie: login.cookie });
  console.log('Admin login/list/activity smoke passed.');
} else {
  console.log('Admin smoke skipped; set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to enable it.');
}

console.log('Staging smoke completed.');
