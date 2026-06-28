import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { config } from '../config.js';
import { sanitizeOperationalError } from '../security.js';

let db = null;
let pool = null;
let persistPromise = Promise.resolve();
let persistedSnapshot = {};
let storeAdapter = null;

export function setStoreAdapterForTests(adapter) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Store adapter override is only available in tests.');
  storeAdapter = adapter;
}

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

function snapshotFor(database = db) {
  const snapshot = {};
  for (const key of Object.keys(emptyDb())) {
    snapshot[key] = JSON.stringify(database?.[key] || []);
  }
  return snapshot;
}

function markPersisted(keys = Object.keys(emptyDb())) {
  for (const key of keys) {
    persistedSnapshot[key] = JSON.stringify(db?.[key] || []);
  }
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
    email_change_tokens: [],
    companies: [],
    contractors: [],
    jobs: [],
    applications: [],
    application_notes: [],
    employment_applications: [],
    employment_application_submissions: [],
    employment_application_drafts: [],
    library_templates: [],
    application_configs: [],
    notification_views: [],
    ats_settings: [],
    ats_jobs: [],
    ats_applicants: [],
    ats_applications: [],
    ats_application_stage_history: [],
    ats_offers: [],
    ats_screenings: [],
    ats_activity_events: [],
    ats_audit_events: [],
    ats_external_sources: [],
    documents: [],
    interviews: [],
    tasks: [],
    messages: [],
    activity_log: []
  };
}

function applicationFromEmploymentApplication(row) {
  const fullName = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    user_id: row.user_id || null,
    company_id: null,
    full_name: fullName || 'Unnamed Applicant',
    email: row.email || '',
    phone: row.phone || '',
    role_applied: row.role_title || '',
    role_slug: row.role_slug || '',
    department: row.department || '',
    location: row.location || '',
    employment_type: row.employment_type || '',
    experience: '',
    message: '',
    status: row.status || 'New',
    score: row.score ?? 0,
    score_breakdown: row.score_breakdown || {},
    assigned_recruiter_id: row.assigned_recruiter_id || null,
    assigned_at: row.assigned_at || null,
    notification_status: row.notification_status || 'pending',
    notification_error_code: row.notification_error_code || null,
    confirmation_number: row.confirmation_number || '',
    payload: row.payload || null,
    files: row.files || [],
    source: row.source || 'portal',
    recovery_status: row.recovery_status || null,
    recovered_at: row.recovered_at || null,
    recovered_by: row.recovered_by || null,
    submitted_at: row.submitted_at || row.created_at || now(),
    created_at: row.submitted_at || row.created_at || now(),
    legacy_employment_application_id: row.id
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
    await client.query(`
      create table if not exists portal_sessions (
        token_hash text primary key,
        user_id text not null,
        ip_address text,
        user_agent text,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    `);
    const result = await client.query('select data from portal_app_state where id = $1', ['primary']);
    db = result.rows[0]?.data || emptyDb();
    normalizeDb();
    if (!result.rows[0]) {
      await client.query(
        `insert into portal_app_state (id, data, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (id) do nothing`,
        ['primary', JSON.stringify(db)]
      );
    }
    persistedSnapshot = snapshotFor(db);
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

export async function saveDbNow() {
  if (usePostgres()) {
    await persistPromise;
    await persistDb();
    return;
  }
  saveDb();
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
  for (const employment of db.employment_applications || []) {
    const existing = db.applications.find((application) => (
      application.id === employment.id ||
      application.legacy_employment_application_id === employment.id ||
      application.employment_application_id === employment.id ||
      (application.confirmation_number && application.confirmation_number === employment.confirmation_number)
    ));
    if (existing) {
      const recovered = applicationFromEmploymentApplication(employment);
      for (const key of ['payload', 'files', 'role_slug', 'location', 'employment_type', 'notification_status', 'notification_error_code']) {
        if ((existing[key] === undefined || existing[key] === null || existing[key] === '') && recovered[key] !== undefined) {
          existing[key] = recovered[key];
          changed = true;
        }
      }
      if (!existing.legacy_employment_application_id) {
        existing.legacy_employment_application_id = employment.id;
        changed = true;
      }
    } else {
      db.applications.push(applicationFromEmploymentApplication(employment));
      changed = true;
    }
  }
  return changed;
}

async function persistDb() {
  if (!usePostgres()) return;
  const changedKeys = Object.keys(emptyDb()).filter((key) => JSON.stringify(db[key] || []) !== persistedSnapshot[key]);
  if (!changedKeys.length) return;

  const values = ['primary'];
  let expression = 'data';
  changedKeys.forEach((key) => {
    values.push(JSON.stringify(db[key] || []));
    expression = `jsonb_set(${expression}, '{${key}}', $${values.length}::jsonb, true)`;
  });

  await getPool().query(
    `update portal_app_state set data = ${expression}, updated_at = now() where id = $1`,
    values
  );
  markPersisted(changedKeys);
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

// Sessions are stored in their own table (not the app-state blob) so that
// serverless instances always read/write durable, up-to-date session rows.
// On Vercel a login on one instance must be visible to the next request on a
// different instance, and the write must complete before the response returns.
export async function createSessionRow({ tokenHash, userId, ip, userAgent, expiresAt }) {
  if (usePostgres()) {
    await getPool().query(
      `insert into portal_sessions (token_hash, user_id, ip_address, user_agent, expires_at)
       values ($1, $2, $3, $4, $5)
       on conflict (token_hash) do update set user_id = excluded.user_id, expires_at = excluded.expires_at`,
      [tokenHash, userId, ip || null, userAgent || '', expiresAt]
    );
    return;
  }
  insert('sessions', { token_hash: tokenHash, user_id: userId, ip_address: ip, user_agent: userAgent, expires_at: expiresAt });
}

export async function findSessionByTokenHash(tokenHash) {
  if (usePostgres()) {
    const result = await getPool().query(
      'select user_id, expires_at from portal_sessions where token_hash = $1 and expires_at > now()',
      [tokenHash]
    );
    return result.rows[0] || null;
  }
  removeExpiredSessions();
  return getDb().sessions.find((session) => session.token_hash === tokenHash) || null;
}

export async function deleteSessionByTokenHash(tokenHash) {
  if (usePostgres()) {
    await getPool().query('delete from portal_sessions where token_hash = $1', [tokenHash]);
    return;
  }
  const database = getDb();
  database.sessions = database.sessions.filter((session) => session.token_hash !== tokenHash);
  saveDb();
}

function duplicateEmploymentApplication(database, userId, roleSlug) {
  return (
    (database.applications || []).find((row) => row.user_id === userId && (row.role_slug === roleSlug || row.role_applied === roleSlug)) ||
    (database.employment_applications || []).find((row) => row.user_id === userId && row.role_slug === roleSlug) ||
    (database.employment_application_submissions || []).find((row) => row.user_id === userId && row.role_slug === roleSlug)
  );
}

function commitEmploymentRows(database, applicationRow, submissionRow, userId, roleSlug) {
  const duplicate = duplicateEmploymentApplication(database, userId, roleSlug);
  if (duplicate) {
    const error = new Error(`You already submitted an application for this role. Your confirmation number is ${duplicate.confirmation_number || 'on file'}.`);
    error.code = 'DUPLICATE_EMPLOYMENT_APPLICATION';
    throw error;
  }
  database.applications = [...(database.applications || []), applicationRow];
  database.employment_application_submissions = [...(database.employment_application_submissions || []), submissionRow];
  database.employment_application_drafts = (database.employment_application_drafts || [])
    .filter((draft) => !(draft.user_id === userId && draft.role_slug === roleSlug));
}

export async function commitEmploymentSubmission({ application, submission, userId, roleSlug }) {
  if (storeAdapter?.beforeCommitEmploymentSubmission) {
    await storeAdapter.beforeCommitEmploymentSubmission({ application, submission, userId, roleSlug });
  }
  const applicationRow = { created_at: now(), ...application };
  const submissionRow = { id: id(), created_at: now(), ...submission };

  if (!usePostgres()) {
    commitEmploymentRows(getDb(), applicationRow, submissionRow, userId, roleSlug);
    saveDb();
    return { application: applicationRow, submission: submissionRow };
  }

  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await client.query('select data from portal_app_state where id = $1 for update', ['primary']);
    const latest = result.rows[0]?.data || emptyDb();
    for (const key of Object.keys(emptyDb())) {
      if (!Array.isArray(latest[key])) latest[key] = [];
    }
    commitEmploymentRows(latest, applicationRow, submissionRow, userId, roleSlug);
    await client.query(
      `update portal_app_state
       set data = jsonb_set(
         jsonb_set(
           jsonb_set(data, '{applications}', $2::jsonb, true),
           '{employment_application_submissions}', $3::jsonb, true
         ),
         '{employment_application_drafts}', $4::jsonb, true
       ),
       updated_at = now()
       where id = $1`,
      [
        'primary',
        JSON.stringify(latest.applications),
        JSON.stringify(latest.employment_application_submissions),
        JSON.stringify(latest.employment_application_drafts)
      ]
    );
    await client.query('commit');
    db.applications = latest.applications;
    db.employment_application_submissions = latest.employment_application_submissions;
    db.employment_application_drafts = latest.employment_application_drafts;
    markPersisted(['applications', 'employment_application_submissions', 'employment_application_drafts']);
    return { application: applicationRow, submission: submissionRow };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEmploymentNotification({ applicationId, submissionId, status, error }) {
  const errorCode = error ? sanitizeOperationalError(error, 'email_notification_failed') : undefined;
  const patchRows = (database) => {
    const application = (database.applications || []).find((row) => row.id === applicationId);
    const submission = (database.employment_application_submissions || []).find((row) => row.id === submissionId);
    if (!application || !submission) return { application, submission };
    submission.email_status = status;
    if (errorCode) {
      submission.email_error_code = errorCode;
      delete submission.email_error;
    } else {
      delete submission.email_error_code;
      delete submission.email_error;
    }
    application.notification_status = status;
    if (errorCode) {
      application.notification_error_code = errorCode;
      delete application.notification_error;
    } else {
      delete application.notification_error_code;
      delete application.notification_error;
    }
    return { application, submission };
  };

  if (!usePostgres()) {
    const result = patchRows(getDb());
    saveDb();
    return result;
  }

  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await client.query('select data from portal_app_state where id = $1 for update', ['primary']);
    const latest = result.rows[0]?.data || emptyDb();
    const patched = patchRows(latest);
    await client.query(
      `update portal_app_state
       set data = jsonb_set(
         jsonb_set(data, '{applications}', $2::jsonb, true),
         '{employment_application_submissions}', $3::jsonb, true
       ),
       updated_at = now()
       where id = $1`,
      ['primary', JSON.stringify(latest.applications || []), JSON.stringify(latest.employment_application_submissions || [])]
    );
    await client.query('commit');
    db.applications = latest.applications || [];
    db.employment_application_submissions = latest.employment_application_submissions || [];
    markPersisted(['applications', 'employment_application_submissions']);
    return patched;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function patchEmploymentApplication(applicationId, patch) {
  const applyPatch = (database) => {
    const application = (database.applications || []).find((row) => (
      row.id === applicationId ||
      row.legacy_employment_application_id === applicationId ||
      row.employment_application_id === applicationId
    ));
    if (!application) return null;
    Object.assign(application, patch);
    return application;
  };

  if (!usePostgres()) {
    const application = applyPatch(getDb());
    saveDb();
    return application;
  }

  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await client.query('select data from portal_app_state where id = $1 for update', ['primary']);
    const latest = result.rows[0]?.data || emptyDb();
    const application = applyPatch(latest);
    await client.query(
      `update portal_app_state
       set data = jsonb_set(data, '{applications}', $2::jsonb, true), updated_at = now()
       where id = $1`,
      ['primary', JSON.stringify(latest.applications || [])]
    );
    await client.query('commit');
    db.applications = latest.applications || [];
    markPersisted(['applications']);
    return application;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Jobs are read fresh and written durably so that serverless instances never
// serve a stale cached copy and a delete is never dropped before it reaches
// Postgres. The write targets only the 'jobs' key (jsonb_set) so concurrent
// writers to other parts of the app-state blob are not clobbered.
export async function readJobs() {
  if (usePostgres()) {
    const result = await getPool().query("select data->'jobs' as jobs from portal_app_state where id = $1", ['primary']);
    const jobs = result.rows[0]?.jobs;
    return Array.isArray(jobs) ? jobs : null;
  }
  const jobs = getDb().jobs;
  return Array.isArray(jobs) ? jobs : null;
}

export async function writeJobs(jobs) {
  if (usePostgres()) {
    await getPool().query(
      "update portal_app_state set data = jsonb_set(data, '{jobs}', $1::jsonb, true), updated_at = now() where id = $2",
      [JSON.stringify(jobs), 'primary']
    );
    if (db) db.jobs = jobs;
    markPersisted(['jobs']);
    return;
  }
  getDb().jobs = jobs;
  saveDb();
}
