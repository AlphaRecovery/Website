import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, apiUrl } from '../api/client.js';
import RoleBadge from './RoleBadge.jsx';

const nav = {
  admin: [
    ['Dashboard', '/portal/admin', 'applications'],
    ['Recruiting', '/portal/admin/recruiting', 'recruiting'],
    ['Job Board', '/portal/admin/jobs'],
    ['Library', '/portal/admin/library'],
    ['Applications', '/portal/admin/applications', 'applications'],
    ['Companies', '/portal/admin/companies'],
    ['Contractors', '/portal/admin/contractors'],
    ['Documents', '/portal/admin/documents', 'documents'],
    ['Tasks', '/portal/admin/tasks', 'tasks'],
    ['Messages', '/portal/admin/messages', 'messages'],
    ['Activity', '/portal/admin/activity'],
    ['Invite Users', '/portal/admin/invite-users'],
    ['Settings', '/portal/admin/settings']
  ],
  recruiter: [
    ['Dashboard', '/portal/recruiter', 'applications'],
    ['Recruiting', '/portal/recruiter/recruiting', 'recruiting'],
    ['Job Board', '/portal/recruiter/jobs'],
    ['Library', '/portal/recruiter/library'],
    ['Applications', '/portal/recruiter/applications', 'applications'],
    ['Companies', '/portal/recruiter/companies'],
    ['Tasks', '/portal/recruiter/tasks', 'tasks'],
    ['Messages', '/portal/recruiter/messages', 'messages']
  ],
  hr: [
    ['Dashboard', '/portal/admin', 'applications'],
    ['Applications', '/portal/admin/applications', 'applications'],
    ['Recruiting', '/portal/admin/recruiting', 'recruiting'],
    ['Documents', '/portal/admin/documents', 'documents'],
    ['Tasks', '/portal/admin/tasks', 'tasks'],
    ['Messages', '/portal/admin/messages', 'messages'],
    ['Settings', '/portal/admin/settings']
  ],
  manager: [
    ['Dashboard', '/portal/admin', 'applications'],
    ['Applications', '/portal/admin/applications', 'applications'],
    ['Documents', '/portal/admin/documents', 'documents'],
    ['Messages', '/portal/admin/messages', 'messages'],
    ['Settings', '/portal/admin/settings']
  ],
  read_only: [
    ['Dashboard', '/portal/admin', 'applications'],
    ['Applications', '/portal/admin/applications', 'applications'],
    ['Documents', '/portal/admin/documents', 'documents'],
    ['Settings', '/portal/admin/settings']
  ],
  contractor: [
    ['Dashboard', '/portal/contractor', 'tasks'],
    ['Job Board', '/portal/contractor/jobs'],
    ['My Profile', '/portal/contractor/profile'],
    ['Documents', '/portal/contractor/documents', 'documents'],
    ['Tasks', '/portal/contractor/tasks', 'tasks'],
    ['Messages', '/portal/contractor/messages', 'messages'],
    ['Settings', '/portal/contractor/settings']
  ],
  applicant: [
    ['Status', '/portal/applicant', 'applications'],
    ['Job Board', '/portal/applicant/jobs'],
    ['My Application', '/portal/applicant/application', 'applications'],
    ['Interviews', '/portal/applicant/interviews', 'interviews'],
    ['Tasks', '/portal/applicant/tasks', 'tasks'],
    ['Documents', '/portal/applicant/documents', 'documents'],
    ['Messages', '/portal/applicant/messages', 'messages'],
    ['Settings', '/portal/applicant/settings']
  ]
};

export default function Sidebar({ mobileOpen = false, isMobileNav = false, onNavigate }) {
  const { user, logout } = useAuth();
  const items = nav[user.role] || [];
  const location = useLocation();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const data = await api('/api/notifications');
        if (active) setCounts(data.notifications || {});
      } catch {
        if (active) setCounts({});
      }
    }
    loadNotifications();
    const stream = new EventSource(apiUrl('/api/notifications/stream'), { withCredentials: true });
    stream.addEventListener('notifications', (event) => {
      if (!active) return;
      try {
        setCounts(JSON.parse(event.data));
      } catch {
        loadNotifications();
      }
    });
    stream.onerror = () => {
      loadNotifications();
    };
    window.addEventListener('portal-notifications-refresh', loadNotifications);
    const timer = window.setInterval(loadNotifications, 60000);
    return () => {
      active = false;
      stream.close();
      window.removeEventListener('portal-notifications-refresh', loadNotifications);
      window.clearInterval(timer);
    };
  }, [user.id]);

  useEffect(() => {
    const currentItem = items.find(([, to]) => location.pathname === to);
    const countKey = currentItem?.[2];
    if (!countKey || countKey === 'messages' || !counts[countKey]) return;
    markSeen(countKey);
  }, [counts, items, location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') onNavigate?.();
    }
    document.body.classList.add('portal-nav-lock');
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('portal-nav-lock');
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen, onNavigate]);

  async function markSeen(countKey) {
    if (!countKey || countKey === 'messages') return;
    try {
      await api('/api/notifications/seen', { method: 'POST', body: JSON.stringify({ key: countKey }) });
      setCounts((current) => ({ ...current, [countKey]: 0 }));
    } catch {
      // Keep navigation smooth even if the acknowledgement request fails.
    }
  }

  return (
    <aside
      className={`sidebar${mobileOpen ? ' open' : ''}`}
      id="portal-sidebar"
      aria-hidden={isMobileNav && !mobileOpen ? 'true' : undefined}
      inert={isMobileNav && !mobileOpen ? '' : undefined}
    >
      <div className="sidebar-brand">
        <span>ALPHA</span>
        <strong>RECOVERY</strong>
      </div>
      <nav>
        {items.map(([label, to, countKey]) => {
          const count = countKey ? Number(counts[countKey] || 0) : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to.split('/').length <= 3}
              onClick={() => {
                markSeen(countKey);
                onNavigate?.();
              }}
            >
              <span>{label}</span>
              {count > 0 && <span className="nav-count" aria-label={`${count} new alerts`}>{count > 99 ? '99+' : count}</span>}
            </NavLink>
          );
        })}
      </nav>
      <footer className="sidebar-user">
        <RoleBadge role={user.role} />
        <div>{user.full_name}</div>
        <small>{user.email}</small>
        <button type="button" onClick={logout}>Log Out</button>
      </footer>
    </aside>
  );
}
