// Read-only diagnostic: inspect the Resend configuration the portal uses in
// production (loads portal/.env). Prints the email driver/from address and the
// verification status of domains in the Resend account. Sends no email.
//
// Run from the portal/ directory:  node scripts/check-resend.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), override: true });

const key = process.env.RESEND_API_KEY || '';
console.log('EMAIL_DRIVER:', process.env.EMAIL_DRIVER || '(unset)');
console.log('EMAIL_FROM  :', process.env.EMAIL_FROM || '(unset)');
console.log('RESEND key  :', key ? `${key.slice(0, 6)}…${key.slice(-3)} (len ${key.length})` : '(unset)');

if (!key) process.exit(1);

const res = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${key}` }
});
console.log('GET /domains status:', res.status);
const body = await res.json().catch(() => ({}));
const domains = body.data || body || [];
if (Array.isArray(domains)) {
  for (const d of domains) {
    console.log(`  domain: ${d.name}  status: ${d.status}  region: ${d.region}`);
  }
} else {
  console.log('  response:', JSON.stringify(body));
}
