import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { config } from '../server/config.js';
import { deleteStoredFile } from '../server/storage.js';
import { sanitizeOperationalError } from '../server/security.js';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');

function redactPayload(payload = {}) {
  const redacted = { ...payload };
  delete redacted.backgroundAuthorization;
  delete redacted.references;
  delete redacted.criminalHistory;
  if (redacted.personalInformation) {
    redacted.personalInformation = {
      fullName: '[redacted]',
      email: '[redacted]',
      phone: '[redacted]',
      ssnLast4: '[redacted]',
      address: '[redacted]',
      city: '[redacted]',
      state: '[redacted]',
      zip: '[redacted]'
    };
  }
  if (redacted.drivingRecord) redacted.drivingRecord = '[redacted]';
  return redacted;
}

async function purgePostgres() {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
  });
  const client = await pool.connect();
  try {
    const due = await client.query(
      `select *
       from employment_applications
       where purged_at is null and (
         (lower(status) = 'rejected' and coalesce(rejected_at, updated_at, submitted_at) < now() - ($1 || ' days')::interval)
         or (lower(status) = 'withdrawn' and coalesce(withdrawn_at, updated_at, submitted_at) < now() - ($2 || ' days')::interval)
       )`,
      [config.rejectedRetentionDays, config.withdrawnRetentionDays]
    );
    const draftDue = await client.query(
      `select id from application_drafts where updated_at < now() - ($1 || ' days')::interval`,
      [config.draftRetentionDays]
    );
    console.log(JSON.stringify({ applications: due.rows.length, drafts: draftDue.rows.length }, null, 2));
    if (!execute) return;

    await client.query('begin');
    await client.query(
      `delete from application_drafts where updated_at < now() - ($1 || ' days')::interval`,
      [config.draftRetentionDays]
    );
    for (const application of due.rows) {
      const files = await client.query(
        `select * from employment_application_files where employment_application_id = $1 and storage_status not in ('deleted')`,
        [application.id]
      );
      for (const file of files.rows) {
        try {
          await deleteStoredFile(`supabase://${file.storage_key}`);
          await client.query(
            `update employment_application_files set storage_status = 'deleted', deleted_at = now(), delete_error_code = null where id = $1`,
            [file.id]
          );
        } catch (error) {
          await client.query(
            `update employment_application_files set storage_status = 'delete_failed', delete_error_code = $2 where id = $1`,
            [file.id, sanitizeOperationalError(error, 'file_delete_failed')]
          );
        }
      }
      await client.query(
        `update employment_applications
         set email = '[redacted]', phone = null, full_name = '[redacted]', payload = $2::jsonb,
             files = '[]'::jsonb, purged_at = now(), updated_at = now()
         where id = $1`,
        [application.id, JSON.stringify(redactPayload(application.payload || {}))]
      );
      await client.query(
        `insert into activity_log (user_id, actor_user_id, action, entity_type, entity_id, metadata)
         values (null, null, 'pii_purged', 'employment_application', $1, $2::jsonb)`,
        [application.id, JSON.stringify({ retention: true })]
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function purgeLocalJson() {
  if (!fs.existsSync(config.dataFile)) {
    console.log('No local JSON database found.');
    return;
  }
  const db = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
  const now = Date.now();
  const draftCutoff = now - config.draftRetentionDays * 24 * 60 * 60 * 1000;
  const beforeDrafts = db.employment_application_drafts?.length || 0;
  const dueApplications = (db.employment_applications || []).filter((app) => {
    const status = String(app.status || '').toLowerCase();
    if (!['rejected', 'withdrawn'].includes(status) || app.purged_at) return false;
    const days = status === 'rejected' ? config.rejectedRetentionDays : config.withdrawnRetentionDays;
    const date = new Date(app.rejected_at || app.withdrawn_at || app.updated_at || app.submitted_at || app.created_at).getTime();
    return date < now - days * 24 * 60 * 60 * 1000;
  });
  console.log(JSON.stringify({ applications: dueApplications.length, drafts: beforeDrafts }, null, 2));
  if (!execute) return;
  db.employment_application_drafts = (db.employment_application_drafts || []).filter((draft) => new Date(draft.updated_at || draft.created_at).getTime() >= draftCutoff);
  for (const app of dueApplications) {
    app.email = '[redacted]';
    app.phone = '';
    app.full_name = '[redacted]';
    app.payload = redactPayload(app.payload || {});
    app.files = [];
    app.purged_at = new Date().toISOString();
    db.activity_log = db.activity_log || [];
    db.activity_log.push({
      id: crypto.randomUUID(),
      user_id: null,
      action: 'pii_purged',
      metadata: { employment_application_id: app.id },
      created_at: new Date().toISOString()
    });
  }
  fs.writeFileSync(config.dataFile, `${JSON.stringify(db, null, 2)}\n`);
}

if (config.databaseUrl) await purgePostgres();
else purgeLocalJson();
