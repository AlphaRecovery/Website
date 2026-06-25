import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

const roleHomes = {
  admin: '/portal/admin',
  recruiter: '/portal/recruiter',
  hr: '/portal/admin',
  manager: '/portal/admin',
  read_only: '/portal/admin',
  contractor: '/portal/contractor',
  applicant: '/portal/applicant'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/auth/me', { suppressAuthRedirect: true })
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleAuthRequired() {
      setUser(null);
      setLoading(false);
    }
    window.addEventListener('portal-auth-required', handleAuthRequired);
    return () => window.removeEventListener('portal-auth-required', handleAuthRequired);
  }, []);

  async function login(email, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST', body: '{}', suppressAuthRedirect: true });
    } catch (err) {
      if (err.status !== 401) throw err;
    } finally {
      setUser(null);
    }
  }

  async function changePassword(currentPassword, newPassword) {
    const data = await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(() => ({ user, loading, login, logout, changePassword, roleHomes }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeForRole(role) {
  return roleHomes[role] || '/login';
}
