import React from 'react';
import { Link } from 'react-router-dom';
import './About.css';

const values = [
  { title: 'Precision', desc: 'Every operation is executed with meticulous attention to detail, ensuring accurate intelligence and reliable outcomes.' },
  { title: 'Integrity', desc: 'We operate with unwavering ethical standards, maintaining transparency and accountability in all engagements.' },
  { title: 'Innovation', desc: 'Combining advanced OSINT techniques with cutting-edge AI technology to stay ahead of evolving threats.' },
  { title: 'Commitment', desc: 'Relentless dedication to our clients\' safety and success — operating 24/7 when missions demand it.' },
];

export default function About() {
  return (
    <main className="about-page">
      <section className="page-header">
        <div className="page-header-bg" />
        <div className="container page-header-content">
          <span className="tag">Who We Are</span>
          <h1>About Alpha Recovery</h1>
          <p>A private intelligence agency built on precision, integrity, and innovation.</p>
        </div>
      </section>

      {/* Story */}
      <section className="section">
        <div className="container about-story">
          <div className="about-story-text">
            <span className="tag">Our Story</span>
            <h2>Built for a Safer World</h2>
            <p>
              Alpha Recovery LLC was established in 2022 in Atlanta, Georgia, with a clear mandate: to deliver world-class private intelligence and security services that make a tangible difference. From day one, we built our agency around the fusion of experienced human intelligence professionals and next-generation technology.
            </p>
            <p>
              Our team brings decades of combined experience in law enforcement, military intelligence, corporate security, and cybersecurity. This multidisciplinary foundation allows us to approach complex challenges from every angle — delivering comprehensive solutions where others see only obstacles.
            </p>
            <p>
              Today, Alpha Recovery stands at the forefront of private intelligence, serving clients ranging from individuals to corporations to government agencies, always with the same unwavering commitment to excellence.
            </p>
          </div>
          <div className="about-story-aside">
            <div className="aside-card">
              <span className="tag">Mission</span>
              <p>To safeguard communities and empower organizations by delivering cutting-edge intelligence and security solutions through precision, innovation, and integrity.</p>
            </div>
            <div className="aside-card">
              <span className="tag">Vision</span>
              <p>To be the global leader in private intelligence and security — where technology and human expertise unite to protect people and organizations worldwide.</p>
            </div>
            <div className="aside-stat">
              <span>Est. 2022</span>
              <span className="aside-stat-label">Atlanta, Georgia</span>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Values */}
      <section className="section">
        <div className="container">
          <div className="values-header">
            <span className="tag">What Drives Us</span>
            <h2 className="section-title">Core Values</h2>
          </div>
          <div className="values-grid">
            {values.map((v, i) => (
              <div key={i} className="value-card">
                <span className="value-num">0{i + 1}</span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Contact CTA */}
      <section className="section">
        <div className="container about-cta">
          <span className="tag">Work With Us</span>
          <h2>Ready to Partner with Alpha Recovery?</h2>
          <p>Whether you need intelligence support, security services, or a custom engagement, our team is ready to assist.</p>
          <div className="about-cta-btns">
            <Link to="/contact" className="btn"><span>Contact Us</span></Link>
            <Link to="/services" className="hero-link" style={{display:'inline-flex',alignItems:'center',gap:'0.5rem',fontFamily:'var(--font-cond)',fontSize:'0.8rem',fontWeight:600,letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--muted2)',transition:'color 0.2s ease'}}>
              View Services
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
