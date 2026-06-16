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
import { useState } from 'react';

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
  ['activity', '/api/admin/activity'],
  ['users', '/api/admin/users']
];

function InviteUsers({ onRefresh }) {
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

  return (
    <div className="panel">
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
    </div>
  );
}

export default function AdminPortal() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const section = currentSection('/portal/admin', pathname);
  const { data, loading, error, refresh } = usePortalData(paths);
  const users = data.users?.users || [];
  const applications = data.applications?.applications || [];
  const documents = data.documents?.documents || [];
  const tasks = data.tasks?.tasks || [];
  const messages = data.messages?.messages || [];

  function content() {
    if (section === 'recruiting') return <RecruitingOperations applications={applications} data={data} onRefresh={refresh} />;
    if (section === 'jobs') return <JobBoardPanel jobs={data.jobs?.jobs || []} canManage onRefresh={refresh} applications={applications} employmentApplications={data.library?.employmentApplications || []} users={users} activity={data.activity?.activity || []} />;
    if (section === 'library') return <LibraryPanel library={data.library} onRefresh={refresh} />;
    if (section === 'applications') return <ApplicationsTable applications={applications} users={users} onRefresh={refresh} allowAssign />;
    if (section === 'companies') return <CompaniesPanel companies={data.companies?.companies || []} onRefresh={refresh} canCreate />;
    if (section === 'contractors') return <ContractorsTable contractors={data.contractors?.contractors || []} onRefresh={refresh} canManage />;
    if (section === 'documents') return <DocumentsPanel documents={documents} users={users} onRefresh={refresh} canRequest />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} users={users} onRefresh={refresh} canCreate />;
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
    if (section === 'invite-users') return <InviteUsers onRefresh={refresh} />;
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
      {section !== 'recruiting' && section !== 'jobs' && <PageHeader eyebrow={section === 'dashboard' ? 'Recruiting & Onboarding Command Portal' : 'Administrator Console'} title={section === 'dashboard' ? 'Administrative Operations Center' : section.replace('-', ' ')} description={section === 'dashboard' ? '' : 'Manage users, companies, applications, contractors, documents, tasks, messages, and audit records.'} />}
      <ErrorState error={error} />
      <LoadingState loading={loading} />
      {!loading && content()}
    </PortalLayout>
  );
}
