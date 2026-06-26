import { loadDb } from '../server/data/store.js';
import { runRetentionCleanup } from '../server/retention.js';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');

await loadDb();
const summary = await runRetentionCleanup({ execute });
console.log(JSON.stringify(summary, null, 2));
