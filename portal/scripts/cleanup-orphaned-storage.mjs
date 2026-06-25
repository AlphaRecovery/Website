import pg from 'pg';
import { config } from '../server/config.js';
import { deleteStoredFile } from '../server/storage.js';
import { sanitizeOperationalError } from '../server/security.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; orphan cleanup only runs against normalized Postgres metadata.');
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

const client = await pool.connect();
try {
  const pending = await client.query(
    `select id, storage_bucket, storage_key
     from orphaned_storage_objects
     where resolved_at is null and created_at < now() - interval '1 hour'
     order by created_at asc
     limit 100`
  );
  console.log(`Found ${pending.rows.length} orphaned storage object(s).`);
  for (const row of pending.rows) {
    const filePath = `supabase://${row.storage_key}`;
    if (dryRun) {
      console.log(`Would delete ${row.storage_bucket}/${row.storage_key}`);
      continue;
    }
    try {
      await deleteStoredFile(filePath);
      await client.query('update orphaned_storage_objects set resolved_at = now() where id = $1', [row.id]);
    } catch (error) {
      await client.query(
        'update orphaned_storage_objects set error_code = $2 where id = $1',
        [row.id, sanitizeOperationalError(error, 'orphan_delete_failed')]
      );
    }
  }
} finally {
  client.release();
  await pool.end();
}
