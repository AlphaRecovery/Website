import { useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PortalLayout from '../components/PortalLayout.jsx';
import RecruitingOperations from './RecruitingOperations.jsx';
import { usePortalData, currentSection } from './portalData.js';
import {
  ApplicationsTable,
  CompaniesPanel,
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
  ['activity', '/api/activity'],
  ['users', '/api/users/directory']
];

export default function RecruiterPortal() {
  const section = currentSection('/portal/recruiter', useLocation().pathname);
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
    if (section === 'applications') return <ApplicationsTable applications={applications} users={users} onRefresh={refresh} />;
    if (section === 'companies') return <CompaniesPanel companies={data.companies?.companies || []} onRefresh={refresh} />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} users={users} onRefresh={refresh} canCreate />;
    if (section === 'messages') return <MessagesPanel messages={messages} users={users} onRefresh={refresh} />;
    return (
      <OperationsDashboard data={data} users={users} applications={applications} contractors={data.contractors?.contractors || []} documents={documents} tasks={tasks} messages={messages} />
    );
  }

  return (
    <PortalLayout>
      {section !== 'recruiting' && section !== 'jobs' && <PageHeader eyebrow={section === 'dashboard' ? 'Recruiting & Onboarding Command Portal' : 'Recruiter Console'} title={section === 'dashboard' ? 'Administrative Operations Center' : section} description={section === 'dashboard' ? '' : 'Review applications, update statuses, add notes, request documents, create tasks, and message candidates.'} />}
      <ErrorState error={error} />
      <LoadingState loading={loading} />
      {!loading && content()}
    </PortalLayout>
  );
}
