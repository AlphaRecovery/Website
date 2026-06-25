import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../server/config.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations');

async function migrationFiles() {
  return (await fs.readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file) && !file.endsWith('.rollback.sql'))
    .sort();
}

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured; migration runner has no remote database target.');
  process.exit(dryRun ? 0 : 1);
}

const files = await migrationFiles();
if (dryRun) {
  console.log(`Dry run: ${files.length} migration file(s) discovered.`);
  for (const file of files) console.log(`- ${file}`);
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query('create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())');
  const applied = await client.query('select version from schema_migrations');
  const appliedVersions = new Set(applied.rows.map((row) => row.version));
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (appliedVersions.has(version)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${version}`);
    await client.query(sql);
    await client.query('insert into schema_migrations (version) values ($1) on conflict do nothing', [version]);
  }
  await client.query('commit');
  console.log('Migrations complete.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
