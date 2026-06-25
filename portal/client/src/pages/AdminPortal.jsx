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
import { useMemo, useState } from 'react';

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
    ['users', role === 'admin' ? '/api/admin/users' : '/api/users/directory']
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
  const [form, setForm] = useState({ email: '', role: 'applicant' });
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
      setForm({ email: '', role: 'applicant' });
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

  return (
    <div className="split-panel">
      <form className="panel-form" onSubmit={submit}>
        <h3>Create Invite</h3>
        <input type="email" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {ROLES.map((role) => <option key={role} value={role}>{displayLabel(role)}</option>)}
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
                  {ROLES.map((role) => <option key={role} value={role}>{displayLabel(role)}</option>)}
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
            }
          ]}
        />
      </div>
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
    if (section === 'applications') return <ApplicationsTable applications={applications} users={users} onRefresh={refresh} allowAssign={user.role === 'admin'} canUpdate={canManageApplications} />;
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
            { key: 'user_id', label: 'User ID', sortable: true },
            { key: 'created_at', label: 'Time', sortable: true, render: (row) => new Date(row.created_at).toLocaleString() }
          ]}
        />
      );
    }
    if (section === 'invite-users') return user.role === 'admin' ? <InviteUsers users={users} currentUser={user} onRefresh={refresh} /> : <div className="empty-state">Only Admin can manage user access.</div>;
    if (section === 'settings') {
      return (
        <div className="panel">
          <h3>Account Details</h3>
          <p>{user.full_name}<br />{user.email}</p>
          <Link className="button-link" to="/change-password">Change Password</Link>
        </div>
      );
    }
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
