import { displayLabel } from '../../../shared/constants.js';

export default function PageHeader({ eyebrow, title, description, actions }) {
  const cleanTitle = displayLabel(title);
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{cleanTitle}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
