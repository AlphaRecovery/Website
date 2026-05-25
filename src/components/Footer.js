import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid container">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-alpha">ALPHA</span>
            <span className="logo-recovery">RECOVERY</span>
          </div>
          <p className="footer-tagline">Private Intelligence Agency</p>
          <p className="footer-desc">
            Expert intelligence solutions for informed decisions and strategic success.
          </p>
        </div>

        <div className="footer-col">
          <h4>Services</h4>
          <ul>
            <li><Link to="/services#security">Security & Intelligence</Link></li>
            <li><Link to="/services#fugitive">Fugitive Recovery</Link></li>
            <li><Link to="/services#crisis">Crisis Management</Link></li>
            <li><Link to="/services#law">Law Enforcement Support</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/contact">Partnerships</Link></li>
            <li><Link to="/contact">Careers</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          <ul className="footer-contact">
            <li>
              <span className="contact-label">Address</span>
              <span>8735 Dunwoody Place Ste 6828<br />Atlanta, GA 30350</span>
            </li>
            <li>
              <span className="contact-label">Email</span>
              <a href="mailto:Admin@alpharecovery.org">Admin@alpharecovery.org</a>
            </li>
            <li>
              <span className="contact-label">Phone</span>
              <a href="tel:2142644347">214-264-4347</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom container">
        <div className="divider" />
        <div className="footer-bottom-inner">
          <p>© {new Date().getFullYear()} Alpha Recovery LLC — All Rights Reserved.</p>
          <p className="footer-est">Est. 2022 · Atlanta, GA</p>
        </div>
      </div>
    </footer>
  );
}
