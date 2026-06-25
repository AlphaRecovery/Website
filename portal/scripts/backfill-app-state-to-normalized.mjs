import pg from 'pg';
import { config } from '../server/config.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; backfill has no remote database target.');
  process.exit(dryRun ? 0 : 1);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

function storageKey(filePath = '') {
  return String(filePath).replace(/^supabase:\/\//, '');
}

const client = await pool.connect();
try {
  await client.query('begin');
  const result = await client.query("select data from portal_app_state where id = 'primary'");
  const data = result.rows[0]?.data || {};

  const counts = {
    users: (data.users || []).length,
    sessions: (data.sessions || []).length,
    activity_log: (data.activity_log || []).length,
    employment_applications: (data.employment_applications || []).length,
    employment_application_submissions: (data.employment_application_submissions || []).length,
    employment_application_drafts: (data.employment_application_drafts || []).length,
    employment_application_files: (data.employment_applications || []).reduce((sum, app) => sum + (app.files || []).length, 0)
  };

  if (dryRun) {
    console.log(JSON.stringify(counts, null, 2));
    await client.query('rollback');
    process.exit(0);
  }

  for (const user of data.users || []) {
    await client.query(
      `insert into users (id, email, password_hash, role, full_name, phone, location, status, force_password_change, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash, role = excluded.role,
       full_name = excluded.full_name, phone = excluded.phone, location = excluded.location, status = excluded.status,
       force_password_change = excluded.force_password_change, updated_at = excluded.updated_at`,
      [
        user.id, user.email, user.password_hash, user.role, user.full_name,
        user.phone || null, user.location || null, user.status || 'active',
        Boolean(user.force_password_change), user.created_at || new Date().toISOString(), user.updated_at || null
      ]
    );
  }

  for (const session of data.sessions || []) {
    await client.query(
      `insert into sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
       values (coalesce($1::uuid, gen_random_uuid()), $2, $3, nullif($4,'')::inet, $5, $6, $7)
       on conflict (token_hash) do update set user_id = excluded.user_id, expires_at = excluded.expires_at`,
      [session.id || null, session.user_id, session.token_hash, session.ip_address || null, session.user_agent || '', session.expires_at, session.created_at || new Date().toISOString()]
    );
  }

  for (const app of data.employment_applications || []) {
    await client.query(
      `insert into employment_applications (
        id, user_id, role_slug, role_title, department, location, employment_type, full_name, email, phone,
        status, assigned_recruiter_id, assigned_at, score, score_breakdown, payload, files, confirmation_number,
        notification_status, notification_error_code, submitted_at, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22,$23)
      on conflict (id) do update set status = excluded.status, payload = excluded.payload, files = excluded.files,
        notification_status = excluded.notification_status, notification_error_code = excluded.notification_error_code`,
      [
        app.id, app.user_id || null, app.role_slug, app.role_title, app.department, app.location || null, app.employment_type || null,
        app.full_name, app.email, app.phone || null, app.status || 'New', app.assigned_recruiter_id || null, app.assigned_at || null,
        Number(app.score || 0), JSON.stringify(app.score_breakdown || {}), JSON.stringify(app.payload || {}),
        JSON.stringify(app.files || []), app.confirmation_number || null, app.notification_status || 'pending',
        app.notification_error_code || null, app.submitted_at || app.created_at || new Date().toISOString(),
        app.created_at || new Date().toISOString(), app.updated_at || null
      ]
    );

    for (const file of app.files || []) {
      await client.query(
        `insert into employment_application_files (
          id, employment_application_id, field, label, original_name, mime_type, size_bytes,
          storage_bucket, storage_key, storage_status, uploaded_at, activated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$10)
        on conflict (storage_bucket, storage_key) do update set employment_application_id = excluded.employment_application_id,
          storage_status = 'active'`,
        [
          file.id, app.id, file.field || 'file', file.label || file.field || 'File',
          file.originalName || file.original_name || 'document', file.mimeType || file.mime_type || 'application/octet-stream',
          Number(file.size || file.size_bytes || 0), config.supabaseStorageBucket || 'portal-documents',
          storageKey(file.path), file.uploadedAt || file.uploaded_at || app.submitted_at || app.created_at || new Date().toISOString()
        ]
      );
    }
  }

  for (const submission of data.employment_application_submissions || []) {
    await client.query(
      `insert into employment_application_submissions (
        id, employment_application_id, user_id, email, role_slug, role_title, department, location, employment_type,
        full_name, confirmation_number, delivery, email_to, email_cc, email_status, email_error_code,
        uploaded_files, submitted_at, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19)
      on conflict (id) do update set email_status = excluded.email_status, email_error_code = excluded.email_error_code`,
      [
        submission.id, submission.employment_application_id || null, submission.user_id || null, submission.email,
        submission.role_slug, submission.role_title, submission.department || null, submission.location || null,
        submission.employment_type || null, submission.full_name || null, submission.confirmation_number,
        submission.delivery || 'portal', submission.email_to || null, submission.email_cc || null,
        submission.email_status || 'pending', submission.email_error_code || null,
        JSON.stringify(submission.uploaded_files || []), submission.submitted_at || submission.created_at || new Date().toISOString(),
        submission.created_at || new Date().toISOString()
      ]
    );
  }

  for (const draft of data.employment_application_drafts || []) {
    await client.query(
      `insert into application_drafts (id, user_id, email, role_slug, role_title, department, section, payload, updated_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       on conflict (user_id, role_slug) do update set section = excluded.section, payload = excluded.payload, updated_at = excluded.updated_at`,
      [
        draft.id, draft.user_id, draft.email, draft.role_slug, draft.role_title || null, draft.department || null,
        Number(draft.section || 1), JSON.stringify(draft.payload || {}), draft.updated_at || new Date().toISOString(),
        draft.created_at || new Date().toISOString()
      ]
    );
  }

  for (const row of data.activity_log || []) {
    await client.query(
      `insert into activity_log (id, user_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
       values ($1,$2,$2,$3,$4,$5,$6::jsonb,$7)
       on conflict (id) do nothing`,
      [
        row.id, row.user_id || row.actor_user_id || null, row.action,
        row.entity_type || row.metadata?.entity_type || null, row.entity_id || row.metadata?.entity_id || null,
        JSON.stringify(row.metadata || {}), row.created_at || new Date().toISOString()
      ]
    );
  }

  await client.query('commit');
  console.log(JSON.stringify(counts, null, 2));
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Backfill failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
