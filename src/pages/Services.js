import React from 'react';
import { Link } from 'react-router-dom';
import './Services.css';

const services = [
  {
    id: 'security',
    num: '01',
    title: 'Security & Intelligence',
    subtitle: 'Comprehensive threat analysis & protective intelligence',
    desc: 'Our Security & Intelligence division delivers comprehensive OSINT-driven security assessments, competitive intelligence, cyber-intelligence, and geopolitical analysis. We combine human expertise with advanced AI technology to provide actionable intelligence that keeps your organization ahead of emerging threats.',
    capabilities: [
      'Open-Source Intelligence (OSINT)',
      'Cyber Intelligence & Digital Forensics',
      'Competitive Intelligence',
      'Geopolitical Risk Analysis',
      'Executive Protection',
      'Corporate Investigations',
    ],
  },
  {
    id: 'fugitive',
    num: '02',
    title: 'Fugitive Recovery',
    subtitle: 'Precision apprehension operations',
    desc: 'Alpha Recovery\'s Fugitive Recovery unit operates with military-grade precision. We leverage advanced tracking methodologies, intelligence gathering, and inter-agency coordination to locate and apprehend fugitives efficiently and safely — minimizing risk while maximizing results.',
    capabilities: [
      'Bail Bond Fugitive Recovery',
      'Skip Tracing & Location Services',
      'Inter-Agency Coordination',
      'Surveillance Operations',
      'Asset Recovery',
      'Multi-Jurisdictional Operations',
    ],
  },
  {
    id: 'crisis',
    num: '03',
    title: 'Crisis Management',
    subtitle: 'Rapid response when it matters most',
    desc: 'When a crisis strikes, decisive action is critical. Our Crisis Management team provides rapid-response protocols, expert strategic guidance, and on-the-ground support to navigate high-stakes situations with minimal exposure and maximum resolution speed.',
    capabilities: [
      'Rapid Response Planning',
      'Hostage & Kidnap Response',
      'Corporate Crisis Consulting',
      'Reputation & Media Management',
      'Emergency Extraction',
      'Post-Crisis Analysis',
    ],
  },
  {
    id: 'law',
    num: '04',
    title: 'Law Enforcement Support',
    subtitle: 'Intelligence resources for agencies & departments',
    desc: 'Alpha Recovery provides specialized intelligence support to law enforcement agencies at all levels. From investigative resources to operational expertise, we bridge the gap between traditional law enforcement capabilities and the advanced intelligence needed in today\'s complex threat landscape.',
    capabilities: [
      'Investigative Intelligence Support',
      'Cold Case Research',
      'Digital Evidence Analysis',
      'Undercover Operation Support',
      'Training & Capacity Building',
      'Event Security Coordination',
    ],
  },
];

export default function Services() {
  return (
    <main className="services-page">
      {/* Page Header */}
      <section className="page-header">
        <div className="page-header-bg" />
        <div className="container page-header-content">
          <span className="tag">What We Do</span>
          <h1>Our Services</h1>
          <p>Specialized intelligence and security solutions tailored to your needs.</p>
        </div>
      </section>

      {/* Services list */}
      <section className="section">
        <div className="container">
          {services.map((s, i) => (
            <div key={s.id} id={s.id} className={`service-block${i % 2 !== 0 ? ' reversed' : ''}`}>
              <div className="service-block-num">{s.num}</div>
              <div className="service-block-content">
                <span className="tag">{s.subtitle}</span>
                <h2>{s.title}</h2>
                <p className="service-block-desc">{s.desc}</p>
                <div className="capabilities">
                  <span className="cap-label">Capabilities</span>
                  <ul>
                    {s.capabilities.map(c => (
                      <li key={c}>
                        <span className="cap-dot" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to="/contact" className="btn" style={{marginTop:'2rem'}}><span>Inquire About This Service</span></Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="services-cta">
        <div className="container">
          <div className="services-cta-inner">
            <span className="tag">Get Started</span>
            <h2>Don't See What You Need?</h2>
            <p>Alpha Recovery offers custom intelligence solutions for unique challenges. Contact us to discuss a tailored engagement.</p>
            <Link to="/contact" className="btn"><span>Contact Our Team</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
