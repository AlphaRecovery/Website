import crypto from 'node:crypto';

export const PRIVATE_NO_STORE = 'no-store, private, max-age=0';

const SECRET_PATTERNS = [
  /supabase[_-]?service[_-]?role/i,
  /resend[_-]?api[_-]?key/i,
  /authorization/i,
  /bearer\s+[a-z0-9._-]+/i,
  /postgres:\/\/[^ \n\r\t]+/i,
  /password/i,
  /secret/i,
  /token/i
];

export function requestId() {
  return crypto.randomUUID();
}

export function setPrivateNoStoreHeaders(res) {
  res.setHeader('Cache-Control', PRIVATE_NO_STORE);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function sanitizeOperationalError(error, fallback = 'operation_failed') {
  const raw = String(error?.code || error?.message || fallback || 'operation_failed');
  if (SECRET_PATTERNS.some((pattern) => pattern.test(raw))) return fallback;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback;
}

export function publicErrorMessage(error, fallback = 'Request failed.') {
  if (process.env.NODE_ENV === 'production') return fallback;
  const message = String(error?.message || fallback);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

export function safeMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) return [key, '[redacted]'];
    if (typeof value === 'string' && SECRET_PATTERNS.some((pattern) => pattern.test(value))) return [key, '[redacted]'];
    return [key, value];
  }));
}
