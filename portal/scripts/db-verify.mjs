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
    console.log('Database verification passed.');
  }
} finally {
  await pool.end();
}
