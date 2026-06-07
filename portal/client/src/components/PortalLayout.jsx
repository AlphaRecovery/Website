import Sidebar from './Sidebar.jsx';
import { useState } from 'react';

export default function PortalLayout({ children }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`portal-layout${navOpen ? ' nav-open' : ''}`}>
      <header className="portal-mobile-bar">
        <button
          type="button"
          className="portal-menu-button"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-controls="portal-sidebar"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="portal-mobile-brand">
          <span>ALPHA</span>
          <strong>RECOVERY</strong>
        </div>
      </header>
      <button className="portal-nav-backdrop" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />
      <main className="portal-main">{children}</main>
    </div>
  );
}
