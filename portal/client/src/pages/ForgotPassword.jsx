import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setSent(true);
      if (data.dev_reset_token) setDevToken(data.dev_reset_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        {sent ? (
          <div className="auth-card">
            <p className="eyebrow">Password Reset</p>
            <h2>Check Your Email</h2>
            <p>If an account exists for {email}, a password reset link has been sent. The link expires in 1 hour.</p>
            {devToken && (
              <small>
                Development mode: <Link to={`/reset-password?token=${devToken}`}>open the reset link</Link>.
              </small>
            )}
            <small><Link to="/login">Back to sign in</Link></small>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <p className="eyebrow">Password Reset</p>
            <h2>Forgot Password</h2>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send Reset Link'}</button>
            <small>Remembered it? <Link to="/login">Back to sign in</Link>.</small>
          </form>
        )}
      </section>
    </main>
  );
}
