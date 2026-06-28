import { displayLabel } from '../../../shared/constants.js';

// Maps any status string to a tone so the indicator carries meaning through
// color instead of wrapping every word in an identical red pill.
function toneFor(value = '') {
  const v = String(value).toLowerCase();
  if (/(hired|approved|active|online|complete|accepted|passed|cleared|onboard|sent|delivered)/.test(v)) return 'positive';
  if (/(reject|fail|inactive|closed|archiv|withdraw|expired|denied|blocked|error)/.test(v)) return 'negative';
  if (/(pending|review|submitted|screen|interview|draft|new|received|warn|expiring|hold|paused|requested)/.test(v)) return 'progress';
  return 'neutral';
}

export default function Badge({ value }) {
  return <span className={`badge badge-${toneFor(value)}`}>{displayLabel(value) || 'Unknown'}</span>;
}
