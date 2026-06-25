import pg from 'pg';
import { config } from '../server/config.js';

const requiredTables = [
  'schema_migrations',
  'users',
  'sessions',
  'activity_log',
  'employment_applications',
  'employment_application_submissions',
  'employment_application_files',
  'application_drafts',
  'orphaned_storage_objects'
];

const requiredRlsTables = [
  'portal_app_state',
  'portal_sessions',
  ...requiredTables.filter((table) => table !== 'schema_migrations')
];

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; verification skipped for local JSON mode.');
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

try {
  const result = await pool.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)`,
    [requiredTables]
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !found.has(table));
  if (missing.length) {
    console.error(`Missing required table(s): ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    const rls = await pool.query(
      `select relname, relrowsecurity
       from pg_class
       join pg_namespace on pg_namespace.oid = pg_class.relnamespace
       where pg_namespace.nspname = 'public'
         and relkind = 'r'
         and relname = any($1)`,
      [requiredRlsTables]
    );
    const rlsByTable = new Map(rls.rows.map((row) => [row.relname, row.relrowsecurity]));
    const missingRls = requiredRlsTables.filter((table) => rlsByTable.has(table) && !rlsByTable.get(table));
    if (missingRls.length) {
      console.error(`RLS is not enabled for required table(s): ${missingRls.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('Database verification passed.');
    }
  }
} finally {
  await pool.end();
}
