// One-time migration: ensure every job in the live store has a valid `program`.
// Local + the public static site read content/site.json (already back-filled),
// but production reads the app-state store seeded from jobs-catalog.json, so any
// jobs already persisted there without a program need this pass.
//
// Run against the target environment (uses whatever DATABASE_URL the env points to):
//   node scripts/backfill-job-programs.mjs
import { readJobs, writeJobs } from '../server/data/store.js';
import { DEFAULT_PROGRAM, PROGRAMS } from '../shared/constants.js';

const jobs = (await readJobs()) || [];
let changed = 0;
for (const job of jobs) {
  if (!job.program || !PROGRAMS.includes(job.program)) {
    job.program = DEFAULT_PROGRAM;
    changed += 1;
  }
}
if (changed > 0) await writeJobs(jobs);
console.log(`Back-filled ${changed}/${jobs.length} job(s) to a valid program (default: ${DEFAULT_PROGRAM}).`);
process.exit(0);
