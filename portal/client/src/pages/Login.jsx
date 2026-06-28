import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const registerJob = from?.startsWith('/apply/') ? from.split('/apply/')[1] : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from || homeForRole(user.role)} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const nextUser = await login(email, password);
      if (nextUser.force_password_change) {
        navigate('/change-password', { replace: true, state: { from } });
        return;
      }
      navigate(from && nextUser.role === 'applicant' ? from : homeForRole(nextUser.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <a className="login-home" href="https://www.alpharecovery.org">&larr; Alpha Recovery Home</a>
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Authorized Personnel Only</p>
          <h2>Secure Access</h2>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Enter Portal'}</button>
          <small><Link to="/forgot-password">Forgot password?</Link></small>
          <small>New applicant? <Link to={registerJob ? `/register?job=${encodeURIComponent(registerJob)}` : '/register'}>Create an account</Link>. Staff access is issued by Alpha Recovery.</small>
        </form>
      </section>
    </main>
  );
}
