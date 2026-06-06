import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/services', label: 'Services' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}${menuOpen ? ' open' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-alpha">ALPHA</span>
          <span className="logo-recovery">RECOVERY</span>
          <span className="logo-llc">LLC</span>
        </Link>

        <ul className="navbar-links">
          {navLinks.map(l => (
            <li key={l.to}>
              <Link to={l.to} className={location.pathname === l.to ? 'active' : ''}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar-right">
          <Link to="/contact" className="btn"><span>Get Started</span></Link>
          <a href="https://portal.alpharecovery.org/login" className="btn btn-outline"><span>Portal</span></a>
          <button
            className={`hamburger${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {navLinks.map(l => (
          <Link key={l.to} to={l.to} className={location.pathname === l.to ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
        <Link to="/contact" className="btn-solid" style={{marginTop:'1rem',display:'inline-block',padding:'0.75rem 1.5rem',fontFamily:'var(--font-cond)',fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',fontSize:'0.8rem',color:'var(--black)',background:'var(--gold)',border:'1px solid var(--gold)'}}>
          Get Started
        </Link>
        <a href="https://portal.alpharecovery.org/login" className="btn-solid" style={{marginTop:'0.75rem',display:'inline-block',padding:'0.75rem 1.5rem',fontFamily:'var(--font-cond)',fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',fontSize:'0.8rem',color:'var(--gold)',background:'transparent',border:'1px solid var(--gold)'}}>
          Portal
        </a>
      </div>
    </nav>
  );
}
