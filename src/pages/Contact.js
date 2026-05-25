import React, { useState } from 'react';
import './Contact.css';

export default function Contact() {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', org: '', orgSize: '', service: '', message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    // Netlify forms — add data-netlify="true" to form in prod
    // For now simulate submission
    await new Promise(r => setTimeout(r, 800));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <main className="contact-page">
      <section className="page-header">
        <div className="page-header-bg" />
        <div className="container page-header-content">
          <span className="tag">Get In Touch</span>
          <h1>Contact Us</h1>
          <p>Ready to get started? Book a consultation with our team.</p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          {/* Info */}
          <div className="contact-info">
            <div className="contact-info-block">
              <span className="tag">Office</span>
              <p>8735 Dunwoody Place<br />Suite 6828<br />Atlanta, GA 30350</p>
            </div>
            <div className="contact-info-block">
              <span className="tag">Email</span>
              <a href="mailto:Admin@alpharecovery.org">Admin@alpharecovery.org</a>
            </div>
            <div className="contact-info-block">
              <span className="tag">Phone</span>
              <a href="tel:2142644347">214-264-4347</a>
            </div>
            <div className="contact-info-block">
              <span className="tag">Hours</span>
              <p>24/7 Operational Support<br /><span style={{color:'var(--muted)',fontSize:'0.85rem'}}>Emergency line always active</span></p>
            </div>
            <div className="contact-divider" />
            <div className="contact-note">
              <p>All inquiries are treated with strict confidentiality. A member of our team will respond within 24 hours.</p>
            </div>
          </div>

          {/* Form */}
          <div className="contact-form-wrap">
            {submitted ? (
              <div className="form-success">
                <div className="success-icon">✓</div>
                <h3>Message Received</h3>
                <p>Thank you for reaching out. A member of our team will be in touch within 24 hours.</p>
              </div>
            ) : (
              <form
                className="contact-form"
                onSubmit={handleSubmit}
                name="contact"
                data-netlify="true"
                netlify-honeypot="bot-field"
              >
                <input type="hidden" name="form-name" value="contact" />
                <p style={{display:'none'}}><input name="bot-field" /></p>

                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input name="name" value={form.name} onChange={handleChange} required placeholder="John Smith" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="(000) 000-0000" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@organization.com" />
                  </div>
                  <div className="form-group">
                    <label>Organization</label>
                    <input name="org" value={form.org} onChange={handleChange} placeholder="Company / Agency" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Organization Size</label>
                    <select name="orgSize" value={form.orgSize} onChange={handleChange}>
                      <option value="">Select size</option>
                      <option>Individual</option>
                      <option>1–10 employees</option>
                      <option>11–50 employees</option>
                      <option>51–200 employees</option>
                      <option>200+ employees</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Service of Interest</label>
                    <select name="service" value={form.service} onChange={handleChange}>
                      <option value="">Select service</option>
                      <option>Security & Intelligence</option>
                      <option>Fugitive Recovery</option>
                      <option>Crisis Management</option>
                      <option>Law Enforcement Support</option>
                      <option>Other / Custom</option>
                    </select>
                  </div>
                </div>

                <div className="form-group full">
                  <label>Message</label>
                  <textarea name="message" value={form.message} onChange={handleChange} rows={5} placeholder="Describe your needs or request..." />
                </div>

                <button type="submit" className="btn-solid form-submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
