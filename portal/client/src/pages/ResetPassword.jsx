import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        {done ? (
          <div className="auth-card">
            <p className="eyebrow">Password Reset</p>
            <h2>Password Updated</h2>
            <p>Your password has been changed. Sign in with your new password.</p>
            <Link className="button-link" to="/login">Go to Sign In</Link>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <p className="eyebrow">Password Reset</p>
            <h2>Choose a New Password</h2>
            {!token && <div className="form-error">This reset link is missing its token. Request a new link from the <Link to="/forgot-password">forgot password</Link> page.</div>}
            <label>
              New Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={8} />
            </label>
            <label>
              Confirm New Password
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={8} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={busy || !token}>{busy ? 'Updating...' : 'Set New Password'}</button>
            <small><Link to="/login">Back to sign in</Link></small>
          </form>
        )}
      </section>
    </main>
  );
}
