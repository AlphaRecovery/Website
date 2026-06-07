import { useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PortalLayout from '../components/PortalLayout.jsx';
import ProgressTracker from '../components/ProgressTracker.jsx';
import Badge from '../components/Badge.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePortalData, currentSection } from './portalData.js';
import { DocumentsPanel, ErrorState, JobBoardPanel, LoadingState, MessagesPanel, RecentPanels, TasksPanel } from './portalShared.jsx';

const paths = [
  ['applications', '/api/applications'],
  ['drafts', '/api/application/drafts'],
  ['jobs', '/api/jobs'],
  ['documents', '/api/documents'],
  ['interviews', '/api/interviews'],
  ['tasks', '/api/tasks'],
  ['messages', '/api/messages'],
  ['activity', '/api/activity'],
  ['users', '/api/users/directory']
];

export default function ApplicantPortal() {
  const { user } = useAuth();
  const section = currentSection('/portal/applicant', useLocation().pathname);
  const { data, loading, error, refresh } = usePortalData(paths);
  const application = data.applications?.applications?.[0] || null;
  const drafts = data.drafts?.drafts || [];
  const documents = data.documents?.documents || [];
  const interviews = data.interviews?.interviews || [];
  const tasks = data.tasks?.tasks || [];
  const messages = data.messages?.messages || [];
  const users = data.users?.users || [];

  function applicationPanel() {
    if (!application && !drafts.length) return <div className="empty-state">No application is linked to this account.</div>;
    return (
      <div className="stack-list">
        {drafts.map((draft) => (
          <article className="panel" key={draft.id}>
            <div className="record-header">
              <div>
                <h3>{draft.role_title || draft.payload?.positionInformation?.roleTitle || 'Draft Application'}</h3>
                <p>Saved draft / Section {draft.section > 14 ? draft.section + 1 : draft.section} of 17 / Last saved {new Date(draft.updated_at || draft.created_at).toLocaleString()}</p>
              </div>
              <a className="button-link" href={`/apply/${draft.role_slug}`}>Resume Draft</a>
            </div>
          </article>
        ))}
        {application && <div className="panel">
          <div className="record-header">
            <div>
              <h3>{application.full_name}</h3>
              <p>{application.role_applied}</p>
            </div>
            <Badge value={application.status} />
          </div>
          <ProgressTracker status={application.status} />
          <dl className="details-grid">
            <div><dt>Application Number</dt><dd>{application.confirmation_number || 'Not assigned'}</dd></div>
            <div><dt>Email</dt><dd>{application.email}</dd></div>
            <div><dt>Phone</dt><dd>{application.phone}</dd></div>
            <div><dt>Experience</dt><dd>{application.experience}</dd></div>
            <div><dt>Message</dt><dd>{application.message}</dd></div>
          </dl>
        </div>}
      </div>
    );
  }

  function content() {
    if (section === 'jobs') return <JobBoardPanel jobs={data.jobs?.jobs || []} onRefresh={refresh} />;
    if (section === 'application') return applicationPanel();
    if (section === 'documents') return <DocumentsPanel documents={documents} onRefresh={refresh} />;
    if (section === 'tasks') return <TasksPanel tasks={tasks} onRefresh={refresh} />;
    if (section === 'interviews') {
      return (
        <div className="stack-list">
          {interviews.map((interview) => (
            <article className="panel" key={interview.id}>
              <div className="record-header">
                <div>
                  <h3>{interview.role_title || 'Interview'}</h3>
                  <p>{interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Time not confirmed'} / {interview.interview_type}</p>
                </div>
                {interview.schedule_token && <a className="button-link" href={`/schedule/${interview.schedule_token}`}>Choose Time</a>}
              </div>
              <p>{interview.instructions || 'Interview instructions will appear here when available.'}</p>
              <dl className="details-grid">
                <div><dt>Status</dt><dd>{interview.status}</dd></div>
                <div><dt>Location</dt><dd>{interview.location || 'Not recorded'}</dd></div>
                <div><dt>Meeting Link</dt><dd>{interview.meeting_link ? <a href={interview.meeting_link}>{interview.meeting_link}</a> : 'Not recorded'}</dd></div>
                <div><dt>Preparation</dt><dd>{interview.preparation_materials || 'No preparation materials recorded.'}</dd></div>
              </dl>
            </article>
          ))}
          {!interviews.length && <div className="empty-state">No interviews have been scheduled yet.</div>}
        </div>
      );
    }
    if (section === 'messages') return <MessagesPanel messages={messages} users={users} onRefresh={refresh} />;
    if (section === 'settings') return <div className="panel"><h3>Settings</h3><p>{user.full_name}<br />{user.email}</p></div>;
    return (
      <>
        {applicationPanel()}
        <RecentPanels documents={documents} tasks={tasks} messages={messages} />
      </>
    );
  }

  return (
    <PortalLayout>
      <PageHeader eyebrow="Applicant Portal" title={section === 'dashboard' ? 'Application Status' : section} description="Track application progress, respond to document requests, and receive portal messages." />
      <ErrorState error={error} />
      <LoadingState loading={loading} />
      {!loading && content()}
    </PortalLayout>
  );
}
