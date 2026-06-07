import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { homeForRole, useAuth } from '../auth/AuthContext.jsx';

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const job = params.get('job');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={job ? `/apply/${job}` : homeForRole(user.role)} replace />;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/register-applicant', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          location: form.location,
          password: form.password
        })
      });
      await login(form.email, form.password);
      navigate(job ? `/apply/${job}` : '/portal/applicant', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Applicant Access</p>
          <h2>Create Account</h2>
          <label>
            Full Name
            <input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(event) => update('email', event.target.value)} type="email" autoComplete="email" required />
          </label>
          <div className="form-grid compact">
            <label>
              Phone
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="tel" />
            </label>
            <label>
              Location
              <input value={form.location} onChange={(event) => update('location', event.target.value)} autoComplete="address-level1" />
            </label>
          </div>
          <label>
            Password
            <input value={form.password} onChange={(event) => update('password', event.target.value)} type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <label>
            Confirm Password
            <input value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} type="password" autoComplete="new-password" required minLength={8} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create Account'}</button>
          <small>Already have an account? <Link to="/login">Sign in</Link>.</small>
        </form>
      </section>
    </main>
  );
}
