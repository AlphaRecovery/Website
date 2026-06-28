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
  AccountSettingsPanel,
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

function RetentionDryRun() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadDryRun() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/retention-cleanup/dry-run');
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totals = summary ? [
    ['Draft warnings', summary.draftWarnings],
    ['Draft deletions', summary.draftsDeleted],
    ['Account warnings', summary.accountWarnings],
    ['Account deletions', summary.accountsDeleted],
    ['Protected applicants', summary.skippedProtectedUsers]
  ] : [];
  const detailRows = [
    ...(summary?.details?.draftWarnings || []).map((row) => ({ ...row, action: 'Warn draft owner', type: 'Draft' })),
    ...(summary?.details?.draftsDeleted || []).map((row) => ({ ...row, action: 'Delete draft', type: 'Draft' })),
    ...(summary?.details?.accountWarnings || []).map((row) => ({ ...row, action: 'Warn inactive applicant', type: 'Applicant' })),
    ...(summary?.details?.accountsDeleted || []).map((row) => ({ ...row, action: 'Delete inactive account', type: 'Applicant' }))
  ];

  return (
    <section className="panel retention-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Retention Dry Run</h3>
          <p>Preview applicant draft and inactive-account cleanup before the scheduled job makes changes.</p>
        </div>
        <button type="button" onClick={loadDryRun} disabled={loading}>{loading ? 'Checking...' : 'Run Dry Run'}</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {summary && (
        <>
          <div className="retention-summary">
            {totals.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <DataTable
            rows={detailRows}
            columns={[
              { key: 'action', label: 'Action', sortable: true },
              { key: 'type', label: 'Record', sortable: true },
              { key: 'email', label: 'Email', sortable: true },
              { key: 'role_title', label: 'Role / Name', sortable: true, render: (row) => row.role_title || row.full_name || 'Not recorded' },
              { key: 'age_days', label: 'Age', sortable: true, render: (row) => `${row.age_days || 0} days` }
            ]}
          />
          {!detailRows.length && <div className="empty-state">No warning or deletion candidates in the current dry run.</div>}
        </>
      )}
    </section>
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
    if (section === 'library') return <LibraryPanel library={data.library} onRefresh={refresh} users={users} canManage={user.role === 'admin'} />;
    if (section === 'applications') return <ApplicationsTable applications={applications} users={users} onRefresh={refresh} allowAssign={user.role === 'admin'} canUpdate={canManageApplications} allowRecover={canManageApplications} />;
    if (section === 'companies') return <CompaniesPanel companies={data.companies?.companies || []} onRefresh={refresh} canCreate={user.role === 'admin'} />;
    if (section === 'contractors') return <ContractorsTable contractors={data.contractors?.contractors || []} onRefresh={refresh} canManage={user.role === 'admin'} />;
    if (section === 'documents') return <DocumentsPanel documents={documents} users={users} onRefresh={refresh} canRequest={canManageApplications} />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} users={users} onRefresh={refresh} canCreate={canManageApplications} />;
    if (section === 'messages') return <MessagesPanel messages={messages} users={users} onRefresh={refresh} />;
    if (section === 'activity') {
      return (
        <>
          <RetentionDryRun />
          <DataTable
            rows={data.activity?.activity || []}
            columns={[
              { key: 'action', label: 'Action', sortable: true, render: (row) => <Badge value={row.action} /> },
              { key: 'actor_name', label: 'User', sortable: true, render: (row) => row.actor_name || 'System' },
              { key: 'summary', label: 'Details', sortable: true, render: (row) => row.target_url ? <Link to={row.target_url}>{row.summary}</Link> : row.summary },
              { key: 'created_at', label: 'Time', sortable: true, render: (row) => new Date(row.created_at).toLocaleString() }
            ]}
          />
        </>
      );
    }
    if (section === 'invite-users') return ['admin', 'manager'].includes(user.role) ? <InviteUsers users={users} currentUser={user} onRefresh={refresh} /> : <div className="empty-state">Only Admin and Manager roles can manage user access.</div>;
    if (section === 'settings') {
      return (
        <AccountSettingsPanel>
          {['admin', 'manager'].includes(user.role) && <InviteUsers users={users} currentUser={user} onRefresh={refresh} />}
        </AccountSettingsPanel>
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
