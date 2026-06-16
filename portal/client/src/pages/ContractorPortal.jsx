import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PortalLayout from '../components/PortalLayout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePortalData, currentSection } from './portalData.js';
import { ContractorsTable, DocumentsPanel, ErrorState, JobBoardPanel, LoadingState, MessagesPanel, RecentPanels, TasksPanel } from './portalShared.jsx';

const paths = [
  ['contractors', '/api/contractors'],
  ['jobs', '/api/jobs'],
  ['documents', '/api/documents'],
  ['tasks', '/api/tasks'],
  ['messages', '/api/messages'],
  ['activity', '/api/activity'],
  ['companies', '/api/companies'],
  ['users', '/api/users/directory']
];

export default function ContractorPortal() {
  const { user } = useAuth();
  const section = currentSection('/portal/contractor', useLocation().pathname);
  const { data, loading, error, refresh } = usePortalData(paths);
  const contractors = data.contractors?.contractors || [];
  const documents = data.documents?.documents || [];
  const tasks = data.tasks?.tasks || [];
  const messages = data.messages?.messages || [];
  const users = data.users?.users || [];

  function content() {
    if (section === 'jobs') return <JobBoardPanel jobs={data.jobs?.jobs || []} onRefresh={refresh} />;
    if (section === 'profile') return <ContractorsTable contractors={contractors} onRefresh={refresh} />;
    if (section === 'documents') return <DocumentsPanel documents={documents} onRefresh={refresh} />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} onRefresh={refresh} />;
    if (section === 'messages') return <MessagesPanel messages={messages} users={users} onRefresh={refresh} />;
    if (section === 'settings') {
      return (
        <div className="panel">
          <h3>Account Details</h3>
          <p>{user.full_name}<br />{user.email}</p>
          <Link className="button-link" to="/change-password">Change Password</Link>
        </div>
      );
    }
    return <RecentPanels documents={documents} tasks={tasks} messages={messages} />;
  }

  return (
    <PortalLayout>
      <PageHeader eyebrow="Contractor Portal" title={section === 'dashboard' ? 'Required Actions' : section} description="View your profile, requested documents, tasks, messages, and recent activity." />
      <ErrorState error={error} />
      <LoadingState loading={loading} />
      {!loading && content()}
    </PortalLayout>
  );
}
