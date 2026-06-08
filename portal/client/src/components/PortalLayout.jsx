import Sidebar from './Sidebar.jsx';
import { useEffect, useState } from 'react';

export default function PortalLayout({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1100px)');
    const update = () => setIsMobileNav(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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
      <button
        className="portal-nav-backdrop"
        type="button"
        aria-label="Close navigation menu"
        aria-hidden={!navOpen}
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <Sidebar mobileOpen={navOpen} isMobileNav={isMobileNav} onNavigate={() => setNavOpen(false)} />
      <main className="portal-main">{children}</main>
    </div>
  );
}
