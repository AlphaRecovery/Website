import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../server/config.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has('--dry-run');
const confirmProduction = args.has('--confirm-production');
const toIndex = rawArgs.indexOf('--to');
const target = toIndex >= 0 ? rawArgs[toIndex + 1] : '';
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations');

if (process.env.NODE_ENV === 'production' && !confirmProduction) {
  console.error('Refusing production rollback without --confirm-production.');
  process.exit(1);
}

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; rollback runner has no remote database target.');
  process.exit(dryRun ? 0 : 1);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query('create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())');
  const applied = await client.query('select version from schema_migrations order by version desc');
  const toRollback = applied.rows
    .map((row) => row.version)
    .filter((version) => !target || version > target);

  if (dryRun) {
    console.log(`Dry run: ${toRollback.length} migration(s) would roll back.`);
    for (const version of toRollback) console.log(`- ${version}`);
    await client.query('rollback');
    process.exit(0);
  }

  for (const version of toRollback) {
    const rollbackFile = path.join(migrationsDir, `${version}.rollback.sql`);
    const sql = await fs.readFile(rollbackFile, 'utf8');
    console.log(`Rolling back ${version}`);
    await client.query(sql);
    await client.query('delete from schema_migrations where version = $1', [version]);
  }
  await client.query('commit');
  console.log('Rollback complete.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Rollback failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
