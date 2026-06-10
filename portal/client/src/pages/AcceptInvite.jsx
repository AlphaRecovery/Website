import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { homeForRole, useAuth } from '../auth/AuthContext.jsx';

export default function AcceptInvite() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ full_name: '', phone: '', location: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('Invite token is missing.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const data = await api('/api/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({
          token,
          full_name: form.full_name,
          phone: form.phone,
          location: form.location,
          password: form.password
        })
      });
      navigate(homeForRole(data.user.role), { replace: true });
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
          <p className="eyebrow">Portal Invitation</p>
          <h2>Accept Invite</h2>
          <label>
            Full Name
            <input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} autoComplete="name" required />
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
          <button type="submit" disabled={busy || !token}>{busy ? 'Accepting...' : 'Accept Invite'}</button>
        </form>
      </section>
    </main>
  );
}
