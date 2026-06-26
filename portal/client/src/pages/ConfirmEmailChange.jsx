import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('Confirming email change...');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token') || '';
    if (!token) {
      setError('Confirmation token is missing.');
      return;
    }
    api('/api/auth/profile/email-change/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
      suppressAuthRedirect: true
    })
      .then(() => setStatus('Your portal email was updated. Sign in again with the new email if needed.'))
      .catch((err) => setError(err.message || 'Email confirmation failed.'));
  }, [params]);

  return (
    <main className="login-shell">
      <section className="auth-card">
        <h1>Email Confirmation</h1>
        {error ? <div className="form-error">{error}</div> : <p>{status}</p>}
        <Link to="/login">Return to Login</Link>
      </section>
    </main>
  );
}
