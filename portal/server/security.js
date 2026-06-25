import crypto from 'node:crypto';

export const PRIVATE_NO_STORE = 'no-store, private, max-age=0';

const BASE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://portal.alpharecovery.org https://alpharecovery.org https://www.alpharecovery.org"
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

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

export function setBaselineSecurityHeaders(req, res, next) {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
  const csp = process.env.NODE_ENV === 'production' ? [...BASE_CSP, 'upgrade-insecure-requests'] : BASE_CSP;
  res.setHeader('Content-Security-Policy', csp.join('; '));
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
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
