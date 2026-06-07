import { displayLabel } from '../../../shared/constants.js';

export default function RoleBadge({ role }) {
  return (
    <span className="role-badge">
      {displayLabel(role)}
    </span>
  );
}
