import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let supabase = null;
let storageAdapter = null;

export function setStorageAdapterForTests(adapter) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Storage adapter override is only available in tests.');
  storageAdapter = adapter;
}

function supabaseClient() {
  if (!supabase) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return supabase;
}

export function isRemoteStoragePath(filePath = '') {
  return String(filePath).startsWith('supabase://');
}

export function storageKeyFromPath(filePath = '') {
  return String(filePath).replace(/^supabase:\/\//, '');
}

export async function storeUploadedFile(file, folder = 'documents') {
  if (storageAdapter?.storeUploadedFile) return storageAdapter.storeUploadedFile(file, folder);
  if (config.storageDriver !== 'supabase') return file.path;
  const original = file.originalname || path.basename(file.path);
  const safeName = original.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const key = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
  const buffer = await fs.readFile(file.path);
  const { error } = await supabaseClient()
    .storage
    .from(config.supabaseStorageBucket)
    .upload(key, buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false
    });
  await fs.unlink(file.path).catch(() => {});
  if (error) throw error;
  return `supabase://${key}`;
}

export async function readStoredFile(filePath) {
  if (storageAdapter?.readStoredFile) return storageAdapter.readStoredFile(filePath);
  if (!isRemoteStoragePath(filePath)) return fs.readFile(filePath);
  const { data, error } = await supabaseClient()
    .storage
    .from(config.supabaseStorageBucket)
    .download(storageKeyFromPath(filePath));
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteStoredFile(filePath) {
  if (storageAdapter?.deleteStoredFile) return storageAdapter.deleteStoredFile(filePath);
  if (!filePath) return;
  if (!isRemoteStoragePath(filePath)) {
    await fs.unlink(filePath).catch(() => {});
    return;
  }
  const { error } = await supabaseClient()
    .storage
    .from(config.supabaseStorageBucket)
    .remove([storageKeyFromPath(filePath)]);
  if (error) throw error;
}

export async function auditSupabaseStorageBucket() {
  if (config.storageDriver !== 'supabase') return { ok: true, storage: 'local' };
  const { data, error } = await supabaseClient().storage.getBucket(config.supabaseStorageBucket);
  if (error) return { ok: false, error: error.message };
  return {
    ok: data?.public === false,
    bucket: config.supabaseStorageBucket,
    public: Boolean(data?.public)
  };
}
