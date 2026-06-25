import pg from 'pg';
import { config } from '../server/config.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has('--dry-run');
const confirmProduction = args.has('--confirm-production');

if (process.env.NODE_ENV === 'production' && !confirmProduction) {
  console.error('Refusing production export without --confirm-production.');
  process.exit(1);
}

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; export-back has no remote database target.');
  process.exit(dryRun ? 0 : 1);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

async function tableRows(client, table) {
  const exists = await client.query('select to_regclass($1) as name', [`public.${table}`]);
  if (!exists.rows[0]?.name) return [];
  const result = await client.query(`select * from ${table}`);
  return result.rows;
}

function exportedFile(row) {
  return {
    id: row.id,
    field: row.field,
    label: row.label,
    originalName: row.original_name,
    size: Number(row.size_bytes || 0),
    mimeType: row.mime_type || '',
    path: row.storage_key?.startsWith('supabase://') ? row.storage_key : `supabase://${row.storage_key}`,
    uploadedAt: row.uploaded_at
  };
}

const client = await pool.connect();
try {
  await client.query('begin');
  const current = await client.query("select data from portal_app_state where id = 'primary'");
  const state = current.rows[0]?.data || {};

  const [
    users,
    sessions,
    activity,
    applications,
    submissions,
    files,
    drafts
  ] = await Promise.all([
    tableRows(client, 'users'),
    tableRows(client, 'sessions'),
    tableRows(client, 'activity_log'),
    tableRows(client, 'employment_applications'),
    tableRows(client, 'employment_application_submissions'),
    tableRows(client, 'employment_application_files'),
    tableRows(client, 'application_drafts')
  ]);

  const filesByApplication = new Map();
  for (const file of files.filter((row) => row.storage_status !== 'deleted')) {
    const rows = filesByApplication.get(file.employment_application_id) || [];
    rows.push(exportedFile(file));
    filesByApplication.set(file.employment_application_id, rows);
  }

  state.users = users;
  state.sessions = sessions;
  state.activity_log = activity.map((row) => ({
    ...row,
    user_id: row.user_id || row.actor_user_id || null
  }));
  state.employment_applications = applications.map((row) => ({
    ...row,
    files: filesByApplication.get(row.id) || []
  }));
  state.employment_application_submissions = submissions.map((row) => ({
    ...row,
    email_error: undefined
  }));
  state.employment_application_drafts = drafts.map((row) => ({
    ...row,
    roleSlug: row.role_slug
  }));

  if (dryRun) {
    console.log(JSON.stringify({
      users: state.users.length,
      sessions: state.sessions.length,
      activity_log: state.activity_log.length,
      employment_applications: state.employment_applications.length,
      employment_application_submissions: state.employment_application_submissions.length,
      employment_application_drafts: state.employment_application_drafts.length,
      employment_application_files: files.length
    }, null, 2));
    await client.query('rollback');
    process.exit(0);
  }

  await client.query(
    `insert into portal_app_state (id, data, updated_at)
     values ('primary', $1::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(state)]
  );
  await client.query('commit');
  console.log('Exported normalized rows back into portal_app_state.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Export failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
