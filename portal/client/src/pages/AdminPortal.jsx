import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PortalLayout from '../components/PortalLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import RecruitingOperations from './RecruitingOperations.jsx';
import { api } from '../api/client.js';
import { usePortalData, currentSection } from './portalData.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  ApplicationsTable,
  CompaniesPanel,
  ContractorsTable,
  DocumentsPanel,
  ErrorState,
  JobBoardPanel,
  LibraryPanel,
  LoadingState,
  MessagesPanel,
  OperationsDashboard,
  RecentPanels,
  TasksPanel
} from './portalShared.jsx';
import { ROLES, displayLabel } from '../../../shared/constants.js';
import { useEffect, useMemo, useState } from 'react';

function pathsForRole(role) {
  const paths = [
    ['dashboard', '/api/admin/dashboard'],
    ['applications', '/api/applications'],
    ['jobs', '/api/jobs'],
    ['library', '/api/library'],
    ['companies', '/api/companies'],
    ['contractors', '/api/contractors'],
    ['documents', '/api/documents'],
    ['interviews', '/api/interviews'],
    ['tasks', '/api/tasks'],
    ['messages', '/api/messages'],
    ['users', ['admin', 'manager'].includes(role) ? '/api/admin/users' : '/api/users/directory']
  ];
  if (role === 'admin') paths.push(['activity', '/api/admin/activity']);
  return paths;
}

const sectionMeta = {
  dashboard: ['Recruiting & Onboarding Command Portal', 'Administrative Operations Center', 'Overview of application activity, required actions, and recruiting status.'],
  applications: ['Application Records', 'Applications', 'View, search, assign, and update every submitted application in the system.'],
  jobs: ['Recruiting Configuration', 'Job Board', 'Manage open roles, position details, and job posting workflow.'],
  library: ['Recruiting Library', 'Library', 'Manage reusable templates and employment application source records.'],
  companies: ['Company Records', 'Companies', 'Manage partner companies and organizational contacts.'],
  contractors: ['Contractor Records', 'Contractors', 'Manage contractor profiles, status, and linked company records.'],
  documents: ['Document Center', 'Documents', 'Review uploaded files, request documents, and track document status.'],
  interviews: ['Interview Workspace', 'Interviews', 'Schedule interviews and maintain candidate evaluation records.'],
  tasks: ['Task Queue', 'Tasks', 'Create, assign, and track internal follow-up work.'],
  messages: ['Communication Center', 'Messages', 'Send and review portal messages connected to applicants and users.'],
  activity: ['Audit Trail', 'Activity', 'Review application, document, and administrative activity records.'],
  'invite-users': ['Access Management', 'Invite Users', 'Invite portal users and assign their starting role.'],
  settings: ['Account Settings', 'Settings', 'Manage your portal account details and password.']
};

function InviteUsers({ users = [], currentUser, onRefresh }) {
  const manageableRoles = currentUser?.role === 'manager'
    ? ROLES.filter((role) => !['admin', 'applicant'].includes(role))
    : ROLES.filter((role) => role !== 'applicant');
  const [form, setForm] = useState({ email: '', role: manageableRoles[0] || 'recruiter' });
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inviteLink = token ? `${window.location.origin}/accept-invite?token=${token}` : '';

  async function submit(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    setCopied(false);
    try {
      const data = await api('/api/auth/dev/create-invite', { method: 'POST', body: JSON.stringify(form) });
      setToken(data.token);
      setNotice(data.warning || (data.email?.logged ? 'Invite created and email logged.' : 'Invite created and email sent.'));
      setForm({ email: '', role: manageableRoles[0] || 'recruiter' });
    } catch (err) {
      setToken('');
      setError(err.message);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  async function updateRole(row, role) {
    setNotice('');
    setError('');
    try {
      await api(`/api/auth/users/${row.id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setNotice(`${row.full_name}'s role was updated.`);
      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(row, status) {
    setNotice('');
    setError('');
    try {
      await api(`/api/auth/users/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`${row.full_name}'s access was updated.`);
      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(row) {
    if (!window.confirm(`Delete ${row.full_name || row.email}?`)) return;
    setNotice('');
    setError('');
    try {
      await api(`/api/auth/users/${row.id}`, { method: 'DELETE' });
      setNotice(`${row.full_name || row.email} was deleted.`);
      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="split-panel">
      <form className="panel-form" onSubmit={submit}>
        <h3>Create Invite</h3>
        <input type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {manageableRoles.map((role) => <option key={role} value={role}>{displayLabel(role)}</option>)}
        </select>
        <button type="submit">Send Invite</button>
      </form>
      {notice && <div className="success-message">{notice}</div>}
      {error && <div className="error-message">{error}</div>}
      {token && (
        <div className="invite-token">
          <span>Invite link</span>
          <code>{inviteLink}</code>
          <button type="button" onClick={copyInviteLink}>{copied ? 'Copied' : 'Copy Link'}</button>
        </div>
      )}
      <div className="panel">
        <h3>User Access</h3>
        <DataTable
          rows={users}
          columns={[
            { key: 'full_name', label: 'User', sortable: true },
            { key: 'email', label: 'Email', sortable: true },
            {
              key: 'role',
              label: 'Role',
              sortable: true,
              render: (row) => (
                <select value={row.role} disabled={row.id === currentUser?.id} onChange={(event) => updateRole(row, event.target.value)}>
                  {(row.role === 'admin' && !manageableRoles.includes('admin') ? ['admin'] : manageableRoles).map((role) => <option key={role} value={role}>{displayLabel(role)}</option>)}
                </select>
              )
            },
            {
              key: 'status',
              label: 'Access',
              sortable: true,
              render: (row) => (
                <select value={row.status || 'active'} disabled={row.id === currentUser?.id} onChange={(event) => updateStatus(row, event.target.value)}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="pending">Pending</option>
                </select>
              )
            },
            {
              key: 'delete',
              label: 'Delete',
              render: (row) => row.id === currentUser?.id || (currentUser?.role === 'manager' && row.role === 'admin') ? 'Locked' : (
                <button type="button" className="danger" onClick={() => deleteUser(row)}>Delete</button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}

function AccountSettings({ users = [], currentUser, onRefresh }) {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [emailForm, setEmailForm] = useState({ email: '', currentPassword: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const canManageUsers = ['admin', 'manager'].includes(currentUser.role);

  useEffect(() => {
    let mounted = true;
    api('/api/auth/profile')
      .then((data) => {
        if (!mounted) return;
        setProfile(data.profile);
        setEmailForm((current) => ({ ...current, email: data.profile.pending_email || data.profile.email || '' }));
      })
      .catch((err) => setError(err.message));
    return () => {
      mounted = false;
    };
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      const data = await api('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: profile.phone || '',
          location: profile.location || '',
          notification_preferences: profile.notification_preferences || {}
        })
      });
      setProfile(data.profile);
      await refreshUser();
      setNotice('Settings saved.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestEmailChange(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      await api('/api/auth/profile/email-change', {
        method: 'POST',
        body: JSON.stringify(emailForm)
      });
      setEmailForm((current) => ({ ...current, currentPassword: '' }));
      const data = await api('/api/auth/profile');
      setProfile(data.profile);
      setNotice('Confirmation sent to the new email address.');
    } catch (err) {
      setError(err.message);
    }
  }

  function updatePreference(key, value) {
    setProfile((current) => ({
      ...current,
      notification_preferences: {
        ...(current.notification_preferences || {}),
        [key]: value
      }
    }));
  }

  if (!profile) return <div className="empty-state">Loading settings...</div>;
  const preferences = profile.notification_preferences || {};

  return (
    <div className="settings-grid">
      <section className="panel">
        <h3>Profile Settings</h3>
        {notice && <div className="success-message">{notice}</div>}
        {error && <div className="error-message">{error}</div>}
        <form className="panel-form compact-form" onSubmit={saveProfile}>
          <div className="form-grid">
            <label>First Name<input value={profile.first_name || ''} readOnly /></label>
            <label>Last Name<input value={profile.last_name || ''} readOnly /></label>
            <label>Phone<input value={profile.phone || ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
            <label>Location<input value={profile.location || ''} onChange={(event) => setProfile({ ...profile, location: event.target.value })} /></label>
          </div>
          <div className="settings-checks">
            {[
              ['email_application_updates', 'Email application updates'],
              ['email_document_requests', 'Email document requests'],
              ['email_messages', 'Email portal messages'],
              ['portal_notifications', 'Portal notifications']
            ].map(([key, label]) => (
              <label className="check-row" key={key}>
                <input type="checkbox" checked={preferences[key] !== false} onChange={(event) => updatePreference(key, event.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <button type="submit">Save Settings</button>
        </form>
      </section>

      <section className="panel">
        <h3>Email & Security</h3>
        <p>Current email: {profile.email}</p>
        {profile.pending_email && <div className="empty-state">Pending confirmation: {profile.pending_email}</div>}
        <form className="panel-form compact-form" onSubmit={requestEmailChange}>
          <label>New Email<input type="email" value={emailForm.email} onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })} required /></label>
          <label>Current Password<input type="password" value={emailForm.currentPassword} onChange={(event) => setEmailForm({ ...emailForm, currentPassword: event.target.value })} required /></label>
          <button type="submit">Send Confirmation</button>
        </form>
        <Link className="button-link" to="/change-password">Change Password</Link>
      </section>

      {canManageUsers && (
        <section className="settings-wide">
          <InviteUsers users={users} currentUser={currentUser} onRefresh={onRefresh} />
        </section>
      )}
    </div>
  );
}

export default function AdminPortal() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const section = currentSection('/portal/admin', pathname);
  const paths = useMemo(() => pathsForRole(user.role), [user.role]);
  const { data, loading, error, refresh } = usePortalData(paths);
  const users = data.users?.users || [];
  const applications = data.applications?.applications || [];
  const documents = data.documents?.documents || [];
  const tasks = data.tasks?.tasks || [];
  const messages = data.messages?.messages || [];

  const canManageApplications = ['admin', 'hr'].includes(user.role);
  const canManageRecruiting = ['admin', 'hr'].includes(user.role);

  function content() {
    if (section === 'recruiting') return canManageRecruiting ? <RecruitingOperations applications={applications} data={data} onRefresh={refresh} /> : <ApplicationsTable applications={applications.filter((row) => !['Hired', 'Rejected', 'archived', 'rejected'].includes(row.status))} users={users} onRefresh={refresh} canUpdate={false} />;
    if (section === 'jobs') return <JobBoardPanel jobs={data.jobs?.jobs || []} canManage={user.role === 'admin'} onRefresh={refresh} applications={applications} employmentApplications={data.library?.employmentApplications || []} users={users} activity={data.activity?.activity || []} />;
    if (section === 'library') return <LibraryPanel library={data.library} onRefresh={refresh} />;
    if (section === 'applications') return <ApplicationsTable applications={applications} users={users} onRefresh={refresh} allowAssign={user.role === 'admin'} canUpdate={canManageApplications} allowRecover={canManageApplications} />;
    if (section === 'companies') return <CompaniesPanel companies={data.companies?.companies || []} onRefresh={refresh} canCreate={user.role === 'admin'} />;
    if (section === 'contractors') return <ContractorsTable contractors={data.contractors?.contractors || []} onRefresh={refresh} canManage={user.role === 'admin'} />;
    if (section === 'documents') return <DocumentsPanel documents={documents} users={users} onRefresh={refresh} canRequest={canManageApplications} />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} users={users} onRefresh={refresh} canCreate={canManageApplications} />;
    if (section === 'messages') return <MessagesPanel messages={messages} users={users} onRefresh={refresh} />;
    if (section === 'activity') {
      return (
        <DataTable
          rows={data.activity?.activity || []}
          columns={[
            { key: 'action', label: 'Action', sortable: true, render: (row) => <Badge value={row.action} /> },
            { key: 'actor_name', label: 'User', sortable: true, render: (row) => row.actor_name || 'System' },
            { key: 'summary', label: 'Details', sortable: true, render: (row) => row.target_url ? <Link to={row.target_url}>{row.summary}</Link> : row.summary },
            { key: 'created_at', label: 'Time', sortable: true, render: (row) => new Date(row.created_at).toLocaleString() }
          ]}
        />
      );
    }
    if (section === 'invite-users') return ['admin', 'manager'].includes(user.role) ? <InviteUsers users={users} currentUser={user} onRefresh={refresh} /> : <div className="empty-state">Only Admin and Manager roles can manage user access.</div>;
    if (section === 'settings') return <AccountSettings users={users} currentUser={user} onRefresh={refresh} />;
    return (
      <OperationsDashboard data={data} users={users} applications={applications} contractors={data.contractors?.contractors || []} documents={documents} tasks={tasks} messages={messages} />
    );
  }

  return (
    <PortalLayout>
      {section !== 'recruiting' && section !== 'jobs' && <PageHeader eyebrow={sectionMeta[section]?.[0] || 'Administrator Console'} title={sectionMeta[section]?.[1] || section.replace('-', ' ')} description={sectionMeta[section]?.[2] || 'Manage this administrative workspace.'} />}
      <ErrorState error={error} />
      <LoadingState loading={loading} />
      {!loading && content()}
    </PortalLayout>
  );
}
