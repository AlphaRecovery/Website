import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../auth/AuthContext.jsx';

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  const forced = Boolean(user.force_password_change);

  async function submit(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const nextUser = await changePassword(currentPassword, newPassword);
      navigate((location.state?.from && location.state.from !== '/change-password') ? location.state.from : homeForRole(nextUser.role), { replace: true });
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
          <p className="eyebrow">{forced ? 'Password Update Required' : 'Account Security'}</p>
          <h2>Change Your Password</h2>
          <label>
            Current Password
            <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          <label>
            New Password
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} />
          </label>
          <label>
            Confirm New Password
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? 'Updating...' : 'Save New Password'}</button>
          {forced
            ? <small>For security, you must change the temporary password before accessing the portal.</small>
            : <small><Link to={homeForRole(user.role)}>Cancel and return to the portal</Link></small>}
        </form>
      </section>
    </main>
  );
}
