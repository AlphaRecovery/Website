import { displayLabel } from '../../../shared/constants.js';

export default function Badge({ value }) {
  return <span className={`badge badge-${value}`}>{displayLabel(value) || 'Unknown'}</span>;
}
