import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const services = [
  {
    id: '01',
    title: 'Security & Intelligence',
    desc: 'Comprehensive OSINT-driven security assessments, threat analysis, and protective intelligence for organizations and individuals.',
    link: '/services#security',
  },
  {
    id: '02',
    title: 'Fugitive Recovery',
    desc: 'Precision fugitive apprehension operations leveraging advanced tracking, intelligence gathering, and inter-agency coordination.',
    link: '/services#fugitive',
  },
  {
    id: '03',
    title: 'Crisis Management',
    desc: 'Rapid-response protocols and expert guidance to navigate high-stakes crises with minimal exposure and maximum resolution.',
    link: '/services#crisis',
  },
  {
    id: '04',
    title: 'Law Enforcement Support',
    desc: 'Specialized intelligence support to law enforcement agencies, providing investigative resources and operational expertise.',
    link: '/services#law',
  },
];

const stats = [
  { value: '2022', label: 'Established' },
  { value: '100+', label: 'Cases Resolved' },
  { value: '4', label: 'Core Divisions' },
  { value: '24/7', label: 'Operational' },
];

export default function Home() {
  return (
    <main className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid-overlay" />
          <div className="hero-gradient" />
        </div>
        <div className="hero-content container">
          <div className="fade-up fade-up-d1">
            <span className="tag">Private Intelligence Agency</span>
          </div>
          <h1 className="hero-headline fade-up fade-up-d2">
            INTELLIGENCE<br />
            <span className="hero-headline-gold">THAT PROTECTS.</span>
          </h1>
          <p className="hero-sub fade-up fade-up-d3">
            Expert intelligence solutions for informed decisions<br />
            and strategic success. Operating where others cannot.
          </p>
          <div className="hero-cta fade-up fade-up-d4">
            <Link to="/contact" className="btn"><span>Request Consultation</span></Link>
            <Link to="/services" className="hero-link">
              Explore Services
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
        <div className="hero-scroll-indicator">
          <span />
        </div>
      </section>

      {/* Stats bar */}
      <section className="stats-bar">
        <div className="container">
          <div className="stats-inner">
            {stats.map((s, i) => (
              <div key={i} className="stat-item">
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About strip */}
      <section className="section about-strip">
        <div className="container">
          <div className="about-strip-inner">
            <div className="about-strip-left">
              <span className="tag">Who We Are</span>
              <h2 className="section-title">Alpha Recovery LLC</h2>
            </div>
            <div className="about-strip-right">
              <p>
                Established in 2022, Alpha Recovery LLC is a private intelligence agency providing a comprehensive suite of specialized services. We combine advanced Open-Source Intelligence (OSINT) techniques with cutting-edge AI technology to tackle the world's most pressing security challenges.
              </p>
              <p>
                We envision a safer world where threats are neutralized swiftly and effectively, empowering our clients to thrive without compromise.
              </p>
              <Link to="/about" className="btn" style={{marginTop: '1.5rem'}}><span>Learn More</span></Link>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Services */}
      <section className="section services-preview">
        <div className="container">
          <div className="services-header">
            <span className="tag">What We Do</span>
            <h2 className="section-title">Core Services</h2>
          </div>
          <div className="services-grid">
            {services.map(s => (
              <Link to={s.link} key={s.id} className="service-card">
                <span className="service-num">{s.id}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="service-arrow">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Mission */}
      <section className="section mission-section">
        <div className="container">
          <div className="mission-grid">
            <div className="mission-card">
              <span className="tag">Our Mission</span>
              <p>
                To safeguard communities and empower organizations by delivering cutting-edge intelligence and security solutions. We are dedicated to protecting lives, assets, and reputations through precision, innovation, and integrity.
              </p>
            </div>
            <div className="mission-card">
              <span className="tag">Our Vision</span>
              <p>
                To be the global leader in private intelligence and security, revolutionizing how threats are identified and neutralized — where technology and human expertise seamlessly unite to protect people and organizations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="container">
          <div className="cta-banner-inner">
            <div>
              <span className="tag">Ready to Begin</span>
              <h2>Work With Alpha Recovery</h2>
            </div>
            <Link to="/contact" className="btn-solid">Request a Consultation</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
