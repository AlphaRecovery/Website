import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { config } from '../config.js';

let db = null;
let pool = null;
let persistPromise = Promise.resolve();

function usePostgres() {
  return Boolean(config.databaseUrl);
}

function getPool() {
  if (!usePostgres()) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export function id() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

function emptyDb() {
  return {
    users: [],
    invites: [],
    sessions: [],
    password_reset_tokens: [],
    companies: [],
    contractors: [],
    jobs: [],
    applications: [],
    application_notes: [],
    employment_applications: [],
    employment_application_drafts: [],
    library_templates: [],
    notification_views: [],
    documents: [],
    interviews: [],
    tasks: [],
    messages: [],
    activity_log: []
  };
}

export async function loadDb() {
  if (db) return db;
  if (usePostgres()) {
    const client = getPool();
    await client.query(`
      create table if not exists portal_app_state (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
    const result = await client.query('select data from portal_app_state where id = $1', ['primary']);
    db = result.rows[0]?.data || emptyDb();
    normalizeDb();
    await persistDb();
    return db;
  }
  fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  if (fs.existsSync(config.dataFile)) {
    db = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
    if (normalizeDb()) saveDb();
    return db;
  }
  db = emptyDb();
  saveDb();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not loaded');
  return db;
}

export function saveDb() {
  if (usePostgres()) {
    persistPromise = persistPromise
      .then(() => persistDb())
      .catch((error) => {
        console.error('Postgres persistence failed:', error);
      });
    return;
  }
  fs.writeFileSync(config.dataFile, `${JSON.stringify(db, null, 2)}\n`);
}

function normalizeDb() {
  const fresh = emptyDb();
  let changed = false;
  for (const key of Object.keys(fresh)) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }
  for (const company of db.companies) {
    const legacyType = String(company.type || '').replace(/_/g, ' ');
    const cleanType = legacyType === 'pi firm' ? 'private investigation firm' : legacyType;
    if (cleanType !== company.type) {
      company.type = cleanType;
      changed = true;
    }
  }
  for (const table of ['applications', 'employment_applications']) {
    for (const row of db[table]) {
      if (!row.confirmation_number) {
        row.confirmation_number = `AR-${String(row.id || id()).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        changed = true;
      }
    }
  }
  const employmentById = new Map(db.employment_applications.map((row) => [row.id, row]));
  for (const application of db.applications) {
    const employment = employmentById.get(application.employment_application_id);
    if (employment?.employment_type && application.employment_type !== employment.employment_type) {
      application.employment_type = employment.employment_type;
      changed = true;
    }
    if (employment?.confirmation_number && application.confirmation_number !== employment.confirmation_number) {
      application.confirmation_number = employment.confirmation_number;
      changed = true;
    }
  }
  return changed;
}

async function persistDb() {
  if (!usePostgres()) return;
  await getPool().query(
    `insert into portal_app_state (id, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    ['primary', JSON.stringify(db)]
  );
}

export function insert(table, record) {
  const row = { id: id(), created_at: now(), ...record };
  getDb()[table].push(row);
  saveDb();
  return row;
}

export function updateById(table, recordId, patch) {
  const rows = getDb()[table];
  const row = rows.find((item) => item.id === recordId);
  if (!row) return null;
  Object.assign(row, patch);
  saveDb();
  return row;
}

export function removeExpiredSessions() {
  const database = getDb();
  const current = Date.now();
  database.sessions = database.sessions.filter((session) => new Date(session.expires_at).getTime() > current);
  saveDb();
}
