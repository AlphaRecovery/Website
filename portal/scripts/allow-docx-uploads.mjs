// One-time admin script: add DOC/DOCX MIME types to the Supabase storage bucket's
// allowed list so applicants can upload Word resumes.
//
// The portal uploads applicant files to Supabase Storage on submit. The bucket
// has an allowed-MIME-types restriction that did not include DOC/DOCX, so the
// final submit failed with "mime type ... wordprocessingml.document is not supported"
// even though the form advertised DOCX as accepted.
//
// This script READS the bucket's current allowed types and MERGES the Word types
// in (it never drops existing types). It targets PRODUCTION (loads portal/.env),
// because that is where the live bucket lives.
//
// Run from the portal/ directory:  node scripts/allow-docx-uploads.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error(`Could not find ${envPath}. Run this from the portal/ directory with production .env present.`);
  process.exit(1);
}
dotenv.config({ path: envPath, override: true });

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'portal-documents';

if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in portal/.env.');
  process.exit(1);
}

// MIME types the form already accepts, used as a baseline if the bucket has no
// restriction recorded. The two Word types are what we are adding.
const WORD_TYPES = [
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];
const BASELINE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', ...WORD_TYPES];

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data: current, error: getError } = await supabase.storage.getBucket(bucket);
if (getError) {
  console.error(`Failed to read bucket "${bucket}":`, getError.message);
  process.exit(1);
}

console.log(`Bucket: ${bucket}`);
console.log('Current allowed_mime_types:', current.allowed_mime_types ?? '(no restriction)');

const existing = Array.isArray(current.allowed_mime_types) && current.allowed_mime_types.length
  ? current.allowed_mime_types
  : BASELINE_TYPES;
const merged = Array.from(new Set([...existing, ...WORD_TYPES]));

if (merged.length === existing.length && WORD_TYPES.every((t) => existing.includes(t))) {
  console.log('DOC/DOCX already allowed — no change needed.');
  process.exit(0);
}

const { error: updateError } = await supabase.storage.updateBucket(bucket, {
  public: current.public,
  file_size_limit: current.file_size_limit,
  allowed_mime_types: merged
});
if (updateError) {
  console.error('Failed to update bucket:', updateError.message);
  process.exit(1);
}

console.log('Updated allowed_mime_types:', merged);
console.log('Done. DOC/DOCX uploads are now accepted.');
