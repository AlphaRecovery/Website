import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/Badge.jsx';
import DataTable from '../components/DataTable.jsx';
import { DocumentList, MessageThread, TaskList } from '../components/Lists.jsx';
import StatCard from '../components/StatCard.jsx';
import { api, documentDownloadUrl, documentViewUrl, uploadDocument } from '../api/client.js';
import { APPLICATION_STATUSES, COMPANY_TYPES, DOCUMENT_TYPES, TASK_STATUSES, displayLabel } from '../../../shared/constants.js';
import { useAuth } from '../auth/AuthContext.jsx';

export function ErrorState({ error }) {
  if (!error) return null;
  return <div className="form-error panel-error">{error}</div>;
}

export function LoadingState({ loading }) {
  if (!loading) return null;
  return <div className="empty-state">Loading portal data...</div>;
}

export function DashboardStats({ stats = {} }) {
  return (
    <section className="stat-grid">
      <StatCard label="Total Applicants" value={stats.totalApplicants ?? 0} />
      <StatCard label="Active Contractors" value={stats.activeContractors ?? 0} />
      <StatCard label="Pending Reviews" value={stats.pendingReviews ?? 0} />
      <StatCard label="Expiring Documents" value={stats.expiringDocuments ?? 0} />
      <StatCard label="Active Companies" value={stats.activeCompanies ?? 0} />
    </section>
  );
}

function isPendingApplication(status = '') {
  return ['new', 'submitted', 'received', 'review', 'under review', 'screening'].includes(String(status).toLowerCase());
}

function isInterview(status = '') {
  return String(status).toLowerCase().includes('interview');
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AR';
}

function toTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toDate(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString();
}

export function OperationsDashboard({ data = {}, users = [], applications = [], contractors = [], documents = [], tasks = [], messages = [] }) {
  const library = data.library || {};
  const employmentApplications = library.employmentApplications || [];
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const pendingApplications = [
    ...applications.filter((app) => isPendingApplication(app.status)),
    ...employmentApplications.filter((app) => isPendingApplication(app.status))
  ];
  const interviewsScheduled = [
    ...applications.filter((app) => isInterview(app.status)),
    ...employmentApplications.filter((app) => isInterview(app.status))
  ].length;
  const contractorsAwaiting = contractors.filter((row) => ['pending', 'review', 'submitted'].includes(String(row.status).toLowerCase())).length;
  const expiringDocuments = data.dashboard?.stats?.expiringDocuments ?? documents.filter((doc) => doc.expires_at && new Date(doc.expires_at).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000).length;
  const openTasks = tasks.filter((task) => ['open', 'in_progress', 'blocked'].includes(task.status)).length;
  const unreadMessages = messages.filter((message) => !message.read_at).length;
  const pendingActions = pendingApplications.length + contractorsAwaiting + expiringDocuments + openTasks + unreadMessages;

  const recentApplications = [
    ...employmentApplications.map((app) => ({
      id: app.id,
      name: app.full_name,
      position: app.role_title,
      date: app.submitted_at,
      status: app.status
    })),
    ...applications.map((app) => ({
      id: app.id,
      name: app.full_name,
      position: app.role_applied,
      date: app.created_at,
      status: app.status
    }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 10);

  const requiredActions = [
    ['Background Authorizations Missing', documents.filter((doc) => /background/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length],
    ['I-9 Required', documents.filter((doc) => /i-?9/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length],
    ['Resume Missing', documents.filter((doc) => /resume/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length],
    ['Contractor Agreement Pending', documents.filter((doc) => /agreement|contractor/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length],
    ['Insurance Verification Pending', documents.filter((doc) => /insurance/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length],
    ['W-9 Form Required', documents.filter((doc) => /w-?9/i.test(`${doc.name} ${doc.type}`) && ['requested', 'pending'].includes(doc.status)).length]
  ];

  const pipeline = [
    ['Applications Received', applications.length + employmentApplications.length],
    ['Screening', pendingApplications.length],
    ['Interview', interviewsScheduled],
    ['Offer', applications.filter((app) => ['approved', 'offer', 'conditional offer'].includes(String(app.status).toLowerCase())).length + employmentApplications.filter((app) => /offer/i.test(app.status)).length],
    ['Onboarding', applications.filter((app) => app.status === 'onboarding').length + employmentApplications.filter((app) => /onboarding/i.test(app.status)).length],
    ['Active Personnel', contractors.filter((row) => row.status === 'active').length]
  ];

  const activity = (data.activity?.activity || data.dashboard?.recentActivity || []).slice(0, 8);
  const metricCards = [
    ['Applications Pending', pendingApplications.length],
    ['Interviews Scheduled', interviewsScheduled],
    ['Contractors Awaiting Approval', contractorsAwaiting],
    ['Expiring Documents', expiringDocuments],
    ['Open Tasks', openTasks],
    ['Unread Messages', unreadMessages]
  ];

  return (
    <section className="ops-dashboard">
      <div className="ops-status-row">
        <span>Today: {new Date().toLocaleDateString()}</span>
        <span>Active Users: {activeUsers}</span>
        <span>Pending Actions: {pendingActions}</span>
        <span>System Status: <strong>Online</strong></span>
      </div>

      <div className="ops-metrics">
        {metricCards.map(([label, value]) => (
          <article key={label} className="ops-metric">
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>

      <div className="ops-grid">
        <section className="panel ops-panel ops-large">
          <div className="record-header">
            <h3>Recent Applications</h3>
            <Badge value={`${recentApplications.length} Records`} />
          </div>
          <div className="ops-table">
            <div className="ops-table-head"><span>Name</span><span>Position</span><span>Date Applied</span><span>Status</span></div>
            {recentApplications.map((app) => (
              <div className="ops-table-row" key={app.id}>
                <span className="ops-person"><em>{initials(app.name)}</em>{app.name}</span>
                <span>{app.position || 'Not selected'}</span>
                <span>{toDate(app.date)}</span>
                <span><Badge value={app.status || 'new'} /></span>
              </div>
            ))}
            {!recentApplications.length && <div className="empty-state">No applications have entered the system yet.</div>}
          </div>
        </section>

        <section className="panel ops-panel">
          <div className="record-header">
            <h3>Required Actions</h3>
            <Badge value={`${requiredActions.reduce((sum, [, count]) => sum + count, 0)} Open`} />
          </div>
          <div className="action-list">
            {requiredActions.map(([label, count]) => (
              <div key={label}><span>{label}</span><strong>{count}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel ops-panel">
          <h3>Recruiting Pipeline</h3>
          <div className="pipeline-list">
            {pipeline.map(([label, count], index) => (
              <div key={label} style={{ '--depth': index }}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel ops-panel ops-large">
          <div className="record-header">
            <h3>Recent Activity</h3>
            <Badge value={`${activity.length} Updates`} />
          </div>
          <div className="activity-feed">
            {activity.map((item) => (
              <div key={item.id}>
                <time>{toTime(item.created_at)}</time>
                <span>{displayLabel(item.action || 'activity')}</span>
                <small>{item.metadata?.title || item.metadata?.role || item.metadata?.status || item.metadata?.email || 'System record updated'}</small>
              </div>
            ))}
            {!activity.length && <div className="empty-state">No activity yet. New applications, uploads, messages, and status changes will appear here.</div>}
          </div>
        </section>

        <section className="panel ops-panel">
          <h3>System Status</h3>
          <div className="system-list">
            {['Applications Database', 'Document Repository', 'Background Check System', 'Communications Hub', 'Audit & Compliance System'].map((item) => (
              <div key={item}><span>{item}</span><strong>Online</strong></div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

const emptyJob = {
  title: '',
  slug: '',
  id: '',
  location: 'Nationwide',
  department: 'Admin',
  employmentType: 'Full Time',
  payRange: 'Based on role, experience, and assignment',
  travelRequirement: 'Varies by assignment',
  backgroundRequirement: 'Tier 2 public trust investigation required',
  clearanceRequirement: 'Tier 2 - Public Trust Position',
  applicationDeadline: '',
  applicationDeadlineTime: '23:59',
  positionsNeeded: 1,
  internalPositionNumber: '',
  assignedRecruiterId: null,
  reportsTo: '',
  supervises: '',
  summary: '',
  positionSummary: '',
  responsibilities: [],
  dailyDuties: [],
  weeklyDuties: [],
  performanceExpectations: [],
  leadershipResponsibilities: [],
  administrativeResponsibilities: [],
  requiredQualifications: [],
  preferredQualifications: [],
  education: [],
  experience: [],
  licenses: [],
  certifications: [],
  skills: [],
  physicalRequirements: [],
  benefits: [],
  insurance: [],
  pto: [],
  retirement: [],
  training: [],
  equipment: [],
  otherBenefits: [],
  hiringProcess: ['Application Submitted', 'Application Review', 'Document Verification', 'Interview', 'Background Review', 'Offer', 'Onboarding', 'Hire'],
  workEnvironment: [],
  settings: {
    publicVisibility: true,
    internalOnly: false,
    allowRemoteApplications: true,
    allowContractorApplications: false,
    allowResumeUpload: true,
    allowCoverLetter: false,
    allowAdditionalDocuments: true,
    allowCertificationsUpload: false,
    allowPortfolioUpload: false,
    automaticClosing: false,
    autoArchivePosition: false,
    autoNotifyRecruiter: true,
    autoNotifyHiringManager: false,
    emailNotifications: true,
    portalNotifications: true,
    recruiterAlerts: true,
    managerAlerts: false,
    postingExpirationDate: '',
    positionOpenDate: '',
    notificationSettings: ''
  },
  status: 'open',
  applyUrl: ''
};

const jobTabs = ['Overview', 'Requirements', 'Responsibilities', 'Benefits', 'Hiring Process', 'Settings', 'Activity'];
const jobStatuses = ['open', 'draft', 'paused', 'closed', 'archived'];
const applicationStages = ['submitted', 'received', 'review', 'interview', 'approved', 'onboarding', 'rejected', 'archived'];

function listToText(value = []) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function textToList(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function jobSlug(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(value) {
  if (!value) return 'Not recorded';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function closeTimestamp(dateValue, timeValue = '23:59') {
  if (!dateValue) return null;
  const normalizedTime = timeValue || '23:59';
  const target = new Date(`${dateValue}T${normalizedTime.length === 5 ? `${normalizedTime}:59` : normalizedTime}`).getTime();
  return Number.isNaN(target) ? null : target;
}

function closeCountdown(dateValue, timeValue = '23:59', nowValue = Date.now()) {
  const target = closeTimestamp(dateValue, timeValue);
  if (!target) return 'No close date set';
  const diff = target - nowValue;
  if (diff <= 0) return 'Expired';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${Math.max(1, Math.ceil(diff / 1000))}s left`;
}

function daysUntil(value) {
  if (!value) return 'No close date set';
  const target = new Date(`${value}T23:59:59`).getTime();
  if (Number.isNaN(target)) return 'No close date set';
  const days = Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function normalizeJobApplication(row, employmentById = new Map()) {
  const employment = row.employment_application_id ? employmentById.get(row.employment_application_id) : null;
  return {
    id: row.id,
    confirmationNumber: row.confirmation_number || employment?.confirmation_number || '',
    source: 'portal',
    employmentId: row.employment_application_id || '',
    userId: row.user_id || '',
    name: row.full_name || employment?.full_name || 'Unnamed Applicant',
    email: row.email || employment?.email || '',
    phone: row.phone || employment?.phone || '',
    roleTitle: row.role_applied || employment?.role_title || '',
    roleSlug: employment?.role_slug || jobSlug(row.role_applied),
    employmentType: row.employment_type || employment?.employment_type || '',
    dateApplied: row.created_at || employment?.submitted_at || '',
    status: row.status || employment?.status || 'submitted',
    score: employment?.score ?? row.score ?? null,
    recruiterId: row.assigned_recruiter_id || '',
    portalRow: row,
    employmentRow: employment
  };
}

function buildApplicationRows(applications = [], employmentApplications = []) {
  const employmentById = new Map(employmentApplications.map((row) => [row.id, row]));
  const linkedEmploymentIds = new Set(applications.map((row) => row.employment_application_id).filter(Boolean));
  return [
    ...applications.map((row) => normalizeJobApplication(row, employmentById)),
    ...employmentApplications.filter((row) => !linkedEmploymentIds.has(row.id)).map((row) => ({
      id: row.id,
      confirmationNumber: row.confirmation_number || '',
      source: 'employment',
      employmentId: row.id,
      userId: row.user_id || '',
      name: row.full_name || 'Unnamed Applicant',
      email: row.email || '',
      phone: row.phone || '',
      roleTitle: row.role_title || '',
      roleSlug: row.role_slug || jobSlug(row.role_title),
      employmentType: row.employment_type || '',
      dateApplied: row.submitted_at || row.created_at || '',
      status: row.status || 'New',
      score: row.score ?? null,
      recruiterId: row.assigned_recruiter_id || '',
      portalRow: null,
      employmentRow: row
    }))
  ];
}

function matchesJob(application, job) {
  if (!job) return false;
  return application.roleSlug === job.slug || String(application.roleTitle || '').toLowerCase() === String(job.title || '').toLowerCase();
}

function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

function listBlock(title, items = []) {
  return (
    <div className="jmc-list-block">
      <h4>{title}</h4>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No {title.toLowerCase()} recorded.</p>}
    </div>
  );
}

function LinkifiedText({ text = '' }) {
  const parts = String(text).split(/(https?:\/\/[^\s]+|\/api\/[^\s]+)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (/^(https?:\/\/|\/api\/)/.test(part)) {
      return <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer">{part}</a>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function DocumentViewModal({ title = 'Document Viewer', src, onClose }) {
  if (!src) return null;
  return (
    <div className="modal-backdrop document-viewer-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="document-viewer-modal">
        <header>
          <div>
            <span className="eyebrow">Document Preview</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <iframe title={title} src={src} />
      </div>
    </div>
  );
}

function FieldList({ label, value, onChange }) {
  return (
    <label>{label}<textarea value={listToText(value)} onChange={(event) => onChange(textToList(event.target.value))} /></label>
  );
}

function JobForm({ form, setForm, users = [], onSubmit, onCancel, submitLabel }) {
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSetting(field, value) {
    setForm((current) => ({ ...current, settings: { ...(current.settings || {}), [field]: value } }));
  }

  return (
    <form className="jmc-modal-card jmc-job-form" onSubmit={onSubmit}>
      <div className="record-header">
        <div>
          <h3>{submitLabel}</h3>
          <p>Every field here saves to the job record used by the portal.</p>
        </div>
        <button type="button" onClick={onCancel}>Close</button>
      </div>
      <div className="form-grid">
        <label>Title<input value={form.title || ''} onChange={(event) => update('title', event.target.value)} required /></label>
        <label>Job ID<input value={form.id || ''} onChange={(event) => update('id', event.target.value)} placeholder={jobSlug(form.title)} /></label>
        <label>Slug<input value={form.slug || ''} onChange={(event) => update('slug', event.target.value)} placeholder={jobSlug(form.title)} /></label>
        <label>Department<input value={form.department || ''} onChange={(event) => update('department', event.target.value)} /></label>
        <label>Location<input value={form.location || ''} onChange={(event) => update('location', event.target.value)} /></label>
        <label>Employment Type<input value={form.employmentType || ''} onChange={(event) => update('employmentType', event.target.value)} /></label>
        <label>Status<select value={form.status || 'open'} onChange={(event) => update('status', event.target.value)}>{jobStatuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}</select></label>
        <label>Assigned Recruiter<select value={form.assignedRecruiterId || ''} onChange={(event) => update('assignedRecruiterId', event.target.value || null)}><option value="">Unassigned</option>{users.filter((user) => ['admin', 'recruiter'].includes(user.role)).map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label>
        <label>Posting Close Date<input type="date" value={form.applicationDeadline || ''} onChange={(event) => update('applicationDeadline', event.target.value)} /></label>
        <label>Posting Close Time<input type="time" value={form.applicationDeadlineTime || '23:59'} onChange={(event) => update('applicationDeadlineTime', event.target.value)} /></label>
        <label>Positions Needed<input type="number" min="1" value={form.positionsNeeded || 1} onChange={(event) => update('positionsNeeded', Math.max(1, Number(event.target.value || 1)))} /></label>
        <label>Internal Position #<input value={form.internalPositionNumber || ''} onChange={(event) => update('internalPositionNumber', event.target.value)} /></label>
        <label>Pay Range<input value={form.payRange || ''} onChange={(event) => update('payRange', event.target.value)} /></label>
        <label>Travel<input value={form.travelRequirement || ''} onChange={(event) => update('travelRequirement', event.target.value)} /></label>
        <label>Background<input value={form.backgroundRequirement || ''} onChange={(event) => update('backgroundRequirement', event.target.value)} /></label>
        <label>Clearance<input value={form.clearanceRequirement || ''} onChange={(event) => update('clearanceRequirement', event.target.value)} /></label>
        <label>Reports To<input value={form.reportsTo || ''} onChange={(event) => update('reportsTo', event.target.value)} /></label>
        <label>Supervises<input value={form.supervises || ''} onChange={(event) => update('supervises', event.target.value)} /></label>
        <label>Apply Link<input value={form.applyUrl || ''} onChange={(event) => update('applyUrl', event.target.value)} placeholder="/apply/role-slug" /></label>
        <label>Short Summary<textarea value={form.summary || ''} onChange={(event) => update('summary', event.target.value)} /></label>
        <label>Position Summary<textarea value={form.positionSummary || ''} onChange={(event) => update('positionSummary', event.target.value)} /></label>
        <FieldList label="Responsibilities" value={form.responsibilities} onChange={(value) => update('responsibilities', value)} />
        <FieldList label="Daily Duties" value={form.dailyDuties} onChange={(value) => update('dailyDuties', value)} />
        <FieldList label="Weekly Duties" value={form.weeklyDuties} onChange={(value) => update('weeklyDuties', value)} />
        <FieldList label="Performance Expectations" value={form.performanceExpectations} onChange={(value) => update('performanceExpectations', value)} />
        <FieldList label="Leadership Responsibilities" value={form.leadershipResponsibilities} onChange={(value) => update('leadershipResponsibilities', value)} />
        <FieldList label="Administrative Responsibilities" value={form.administrativeResponsibilities} onChange={(value) => update('administrativeResponsibilities', value)} />
        <FieldList label="Required Qualifications" value={form.requiredQualifications} onChange={(value) => update('requiredQualifications', value)} />
        <FieldList label="Preferred Qualifications" value={form.preferredQualifications} onChange={(value) => update('preferredQualifications', value)} />
        <FieldList label="Education" value={form.education} onChange={(value) => update('education', value)} />
        <FieldList label="Experience" value={form.experience} onChange={(value) => update('experience', value)} />
        <FieldList label="Licenses" value={form.licenses} onChange={(value) => update('licenses', value)} />
        <FieldList label="Certifications" value={form.certifications} onChange={(value) => update('certifications', value)} />
        <FieldList label="Skills" value={form.skills} onChange={(value) => update('skills', value)} />
        <FieldList label="Physical Requirements" value={form.physicalRequirements} onChange={(value) => update('physicalRequirements', value)} />
        <FieldList label="Work Environment" value={form.workEnvironment} onChange={(value) => update('workEnvironment', value)} />
        <FieldList label="Benefits" value={form.benefits} onChange={(value) => update('benefits', value)} />
        <FieldList label="Insurance" value={form.insurance} onChange={(value) => update('insurance', value)} />
        <FieldList label="PTO" value={form.pto} onChange={(value) => update('pto', value)} />
        <FieldList label="Retirement" value={form.retirement} onChange={(value) => update('retirement', value)} />
        <FieldList label="Training" value={form.training} onChange={(value) => update('training', value)} />
        <FieldList label="Equipment" value={form.equipment} onChange={(value) => update('equipment', value)} />
        <FieldList label="Other Benefits" value={form.otherBenefits} onChange={(value) => update('otherBenefits', value)} />
        <FieldList label="Hiring Process" value={form.hiringProcess} onChange={(value) => update('hiringProcess', value)} />
        <label>Notification Settings<textarea value={form.settings?.notificationSettings || ''} onChange={(event) => updateSetting('notificationSettings', event.target.value)} /></label>
      </div>
      <div className="jmc-settings-grid">
        {[
          ['publicVisibility', 'Public Visibility'],
          ['internalOnly', 'Internal Only'],
          ['allowRemoteApplications', 'Allow Remote Applications'],
          ['allowContractorApplications', 'Allow Contractor Applications'],
          ['allowResumeUpload', 'Allow Resume Upload'],
          ['allowCoverLetter', 'Allow Cover Letter'],
          ['allowAdditionalDocuments', 'Allow Additional Documents'],
          ['allowCertificationsUpload', 'Allow Certifications Upload'],
          ['allowPortfolioUpload', 'Allow Portfolio Upload'],
          ['automaticClosing', 'Auto Close Position'],
          ['autoArchivePosition', 'Auto Archive Position'],
          ['autoNotifyRecruiter', 'Auto Notify Recruiter'],
          ['autoNotifyHiringManager', 'Auto Notify Hiring Manager'],
          ['emailNotifications', 'Email Notifications'],
          ['portalNotifications', 'Portal Notifications'],
          ['recruiterAlerts', 'Recruiter Alerts'],
          ['managerAlerts', 'Manager Alerts']
        ].map(([key, label]) => (
          <label className="jmc-check" key={key}><input type="checkbox" checked={Boolean(form.settings?.[key])} onChange={(event) => updateSetting(key, event.target.checked)} />{label}</label>
        ))}
      </div>
      <div className="form-grid">
        <label>Posting Expiration Date<input type="date" value={form.settings?.postingExpirationDate || ''} onChange={(event) => updateSetting('postingExpirationDate', event.target.value)} /></label>
        <label>Position Open Date<input type="date" value={form.settings?.positionOpenDate || ''} onChange={(event) => updateSetting('positionOpenDate', event.target.value)} /></label>
      </div>
      <div className="table-actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function JobBoardPanel({ jobs = [], canManage = false, onRefresh, applications = [], employmentApplications = [], users = [], activity = [] }) {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [form, setForm] = useState({ ...emptyJob });
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ department: '', status: '', location: '', employmentType: '', clearance: '', recruiter: '' });
  const [activeTab, setActiveTab] = useState('Overview');
  const [statFilter, setStatFilter] = useState('');
  const [modal, setModal] = useState('');
  const [cardMenu, setCardMenu] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [timerNow, setTimerNow] = useState(Date.now());
  const { user } = useAuth();
  const selectedJob = jobs.find((job) => job.slug === selectedSlug) || jobs[0] || null;
  const applicationRows = useMemo(() => buildApplicationRows(applications, employmentApplications), [applications, employmentApplications]);
  const recruiterUsers = users.filter((row) => ['admin', 'recruiter'].includes(row.role));
  const selectedApplications = applicationRows.filter((row) => matchesJob(row, selectedJob));

  useEffect(() => {
    if (!selectedSlug && jobs[0]) setSelectedSlug(jobs[0].slug);
  }, [jobs, selectedSlug]);

  useEffect(() => {
    if (!canManage || !selectedJob) return;
    setForm({ ...emptyJob, ...selectedJob, settings: { ...emptyJob.settings, ...(selectedJob.settings || {}) } });
  }, [canManage, selectedJob]);

  useEffect(() => {
    if (!canManage) return undefined;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [canManage]);

  const stats = useMemo(() => {
    const expiringLimit = timerNow + 14 * 24 * 60 * 60 * 1000;
    return [
      ['Open Positions', jobs.filter((job) => job.status === 'open').length, 'open'],
      ['Draft Positions', jobs.filter((job) => job.status === 'draft').length, 'draft'],
      ['Closed Positions', jobs.filter((job) => job.status === 'closed').length, 'closed'],
      ['Positions Expiring Soon', jobs.filter((job) => {
        const closeAt = closeTimestamp(job.applicationDeadline, job.applicationDeadlineTime);
        return closeAt && closeAt <= expiringLimit && closeAt >= timerNow;
      }).length, 'expiring'],
      ['Archived Positions', jobs.filter((job) => job.status === 'archived').length, 'archived']
    ];
  }, [jobs, timerNow]);

  const filteredJobs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const status = statFilter && jobStatuses.includes(statFilter) ? statFilter : filters.status;
      if (status && job.status !== status) return false;
      if (filters.department && job.department !== filters.department) return false;
      if (filters.location && job.location !== filters.location) return false;
      if (filters.employmentType && job.employmentType !== filters.employmentType) return false;
      if (filters.clearance && job.clearanceRequirement !== filters.clearance) return false;
      if (filters.recruiter && job.assignedRecruiterId !== filters.recruiter) return false;
      if (statFilter === 'expiring') {
        const closeAt = closeTimestamp(job.applicationDeadline, job.applicationDeadlineTime);
        if (!closeAt || closeAt < timerNow || closeAt > timerNow + 14 * 24 * 60 * 60 * 1000) return false;
      }
      if (!term) return true;
      return [job.title, job.department, job.location, job.id, job.slug].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [filters, jobs, query, statFilter, timerNow]);

  function clearFilters() {
    setFilters({ department: '', status: '', location: '', employmentType: '', clearance: '', recruiter: '' });
    setStatFilter('');
  }

  function editPosition(job = selectedJob) {
    if (!job) return;
    setSelectedSlug(job.slug);
    setForm({ ...emptyJob, ...job, settings: { ...emptyJob.settings, ...(job.settings || {}) } });
    setModal('job');
    setCardMenu('');
  }

  function buildPayload(source = form) {
    const slug = source.slug || jobSlug(source.title);
    return {
      ...source,
      slug,
      id: source.id || slug,
      applicationDeadlineTime: source.applicationDeadlineTime || '23:59',
      positionsNeeded: Math.max(1, Number(source.positionsNeeded || 1)),
      applyUrl: source.applyUrl || `/apply/${slug}`,
      settings: { ...emptyJob.settings, ...(source.settings || {}) }
    };
  }

  function startNewJob() {
    setSelectedSlug('');
    setForm({ ...emptyJob, settings: { ...emptyJob.settings } });
    setModal('job');
  }

  async function saveJob(event) {
    event.preventDefault();
    const payload = buildPayload();
    if (selectedJob && selectedSlug) {
      await api(`/api/jobs/${selectedSlug}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify(payload) });
      setSelectedSlug(payload.slug);
    }
    setModal('');
    onRefresh();
  }

  async function patchJob(patch) {
    if (!selectedJob) return;
    const payload = buildPayload({ ...selectedJob, ...patch });
    await api(`/api/jobs/${selectedJob.slug}`, { method: 'PATCH', body: JSON.stringify(payload) });
    onRefresh();
  }

  async function patchSpecificJob(job, patch) {
    if (!job) return;
    const payload = buildPayload({ ...job, ...patch });
    await api(`/api/jobs/${job.slug}`, { method: 'PATCH', body: JSON.stringify(payload) });
    setSelectedSlug(payload.slug);
    onRefresh();
  }

  async function patchJobSetting(key, value) {
    if (!selectedJob) return;
    await patchJob({ settings: { ...(selectedJob.settings || {}), [key]: value } });
  }

  async function resetHiringProcess() {
    if (!selectedJob || !window.confirm('Reset this position to the default Alpha hiring workflow?')) return;
    await patchJob({ hiringProcess: emptyJob.hiringProcess });
  }

  async function duplicateJob(job = selectedJob) {
    if (!job) return;
    const suffix = Date.now().toString().slice(-6);
    const payload = buildPayload({
      ...job,
      title: `${job.title} Copy`,
      slug: `${job.slug}-copy-${suffix}`,
      id: `${job.id || job.slug}-copy-${suffix}`,
      status: 'draft'
    });
    await api('/api/jobs', { method: 'POST', body: JSON.stringify(payload) });
    setSelectedSlug(payload.slug);
    onRefresh();
  }

  async function deleteJob(job = selectedJob) {
    if (!job || !window.confirm(`Delete ${job.title}? This cannot be undone.`)) return;
    await api(`/api/jobs/${job.slug}`, { method: 'DELETE' });
    setSelectedSlug('');
    setForm({ ...emptyJob });
    onRefresh();
  }

  function previewJob(job = selectedJob) {
    if (!job) return;
    setCardMenu('');
    window.open(job.applyUrl || `/apply/${job.slug}`, '_blank', 'noopener,noreferrer');
  }

  function generateReport() {
    const report = {
      job: selectedJob,
      generatedAt: new Date().toISOString()
    };
    downloadFile(`${selectedJob?.slug || 'job'}-position-report.json`, JSON.stringify(report, null, 2), 'application/json');
  }

  function generateActivityReport() {
    const rows = activity.filter((item) => {
      const text = `${item.action || ''} ${item.metadata?.title || ''} ${item.metadata?.job_id || ''} ${item.metadata?.job_slug || ''} ${item.metadata?.role || ''}`.toLowerCase();
      return selectedJob && (text.includes(selectedJob.slug.toLowerCase()) || text.includes(selectedJob.title.toLowerCase()));
    });
    const report = {
      jobId: selectedJob?.id || selectedJob?.slug,
      title: selectedJob?.title,
      activity: rows,
      generatedAt: new Date().toISOString()
    };
    downloadFile(`${selectedJob?.slug || 'job'}-activity-report.json`, JSON.stringify(report, null, 2), 'application/json');
  }

  async function moveApplication(row, status) {
    if (!row.portalRow) return;
    await api(`/api/applications/${row.portalRow.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onRefresh();
  }

  function openApplicant(row) {
    const prefix = user?.role === 'recruiter' ? '/portal/recruiter' : '/portal/admin';
    window.location.href = `${prefix}/recruiting`;
  }

  async function sendApplicantMessage(event) {
    event.preventDefault();
    if (!selectedApplication?.userId || !messageBody.trim()) return;
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: selectedApplication.userId,
        related_application_id: selectedApplication.portalRow?.id || null,
        subject: `Update regarding ${selectedJob?.title || 'your application'}`,
        body: messageBody
      })
    });
    setMessageBody('');
    setModal('');
    onRefresh();
  }

  async function scheduleInterview(event) {
    event.preventDefault();
    if (!selectedApplication) return;
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        assigned_to: selectedJob?.assignedRecruiterId || user.id,
        related_application_id: selectedApplication.portalRow?.id || null,
        title: `Schedule interview with ${selectedApplication.name}`,
        description: `Interview task for ${selectedJob?.title || selectedApplication.roleTitle}.`,
        due_at: taskDue || null
      })
    });
    setTaskDue('');
    setModal('');
    onRefresh();
  }

  if (canManage) {
    const selectedRecruiter = recruiterUsers.find((row) => row.id === selectedJob?.assignedRecruiterId);
    const activityRows = activity.filter((item) => {
      const text = `${item.action || ''} ${item.metadata?.title || ''} ${item.metadata?.job_id || ''} ${item.metadata?.job_slug || ''} ${item.metadata?.role || ''}`.toLowerCase();
      return selectedJob && (text.includes(selectedJob.slug.toLowerCase()) || text.includes(selectedJob.title.toLowerCase()));
    });
    return (
      <section className="jmc-shell">
        <div className="jmc-hero">
          <div>
            <span>Recruiting Module</span>
            <h2>Job Management Center</h2>
            <p>Create, publish, manage, monitor, and track Alpha Recovery employment opportunities.</p>
          </div>
        </div>

        <div className="jmc-action-bar">
          <button type="button" onClick={startNewJob}>Add Position</button>
          <button type="button" onClick={() => patchJob({ status: 'open', settings: { ...(selectedJob?.settings || {}), publicVisibility: true } })} disabled={!selectedJob}>Publish Position</button>
          <button type="button" onClick={() => patchJob({ status: 'draft', settings: { ...(selectedJob?.settings || {}), publicVisibility: false } })} disabled={!selectedJob}>Unpublish Position</button>
          <button type="button" onClick={() => previewJob()} disabled={!selectedJob}>Preview Position</button>
          <button type="button" onClick={() => duplicateJob()} disabled={!selectedJob}>Duplicate Position</button>
          <button type="button" onClick={() => setModal('assign')} disabled={!selectedJob}>Assign Recruiter</button>
          <button type="button" onClick={generateReport} disabled={!selectedJob}>Generate Report</button>
          <button type="button" className="warning" onClick={() => patchJob({ status: 'archived' })} disabled={!selectedJob}>Archive Position</button>
          <button type="button" className="danger" onClick={() => deleteJob()} disabled={!selectedJob || user?.role !== 'admin'}>Delete Position</button>
        </div>

        <div className="jmc-stat-row">
          {stats.map(([label, value, key]) => (
            <button type="button" className={`jmc-stat${statFilter === key ? ' active' : ''}`} key={label} onClick={() => setStatFilter(statFilter === key ? '' : key)}>
              <strong>{value}</strong>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="jmc-workspace">
          <aside className="jmc-panel jmc-left">
            <div className="record-header">
              <h3>Position Management</h3>
              <button type="button" onClick={clearFilters}>Clear Filters</button>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs by title, department, location, or job ID..." />
            <div className="jmc-filter-grid">
              <label>Department<select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="">All Departments</option>{uniqueOptions(jobs, 'department').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All Statuses</option>{jobStatuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}</select></label>
              <label>Location<select value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })}><option value="">All Locations</option>{uniqueOptions(jobs, 'location').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Employment Type<select value={filters.employmentType} onChange={(event) => setFilters({ ...filters, employmentType: event.target.value })}><option value="">All Types</option>{uniqueOptions(jobs, 'employmentType').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Clearance Level<select value={filters.clearance} onChange={(event) => setFilters({ ...filters, clearance: event.target.value })}><option value="">All Clearance Levels</option>{uniqueOptions(jobs, 'clearanceRequirement').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Recruiter<select value={filters.recruiter} onChange={(event) => setFilters({ ...filters, recruiter: event.target.value })}><option value="">All Recruiters</option>{recruiterUsers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            </div>
            <div className="jmc-job-stack">
              {filteredJobs.map((job) => (
                <article className={`jmc-job-card${selectedJob?.slug === job.slug ? ' active' : ''}`} key={job.slug}>
                  <button type="button" className="jmc-job-main" onClick={() => { setSelectedSlug(job.slug); setActiveTab('Overview'); setCardMenu(''); }} onDoubleClick={() => previewJob(job)}>
                    <span className={`jmc-status ${job.status}`}>{displayLabel(job.status)}</span>
                    <strong>{job.title}</strong>
                    <small>{job.department} / {job.location} / {job.employmentType}</small>
                    <small>Needed: {job.positionsNeeded || 1}</small>
                    <small>Close: {toDate(job.applicationDeadline)} {job.applicationDeadline ? job.applicationDeadlineTime || '23:59' : ''} / {closeCountdown(job.applicationDeadline, job.applicationDeadlineTime, timerNow)}</small>
                    <small>Created: {toDate(job.createdAt || job.postedDate)} / Updated: {relativeTime(job.modifiedAt || job.postedDate)}</small>
                    <small>Recruiter: {recruiterUsers.find((person) => person.id === job.assignedRecruiterId)?.full_name || 'Unassigned'}</small>
                  </button>
                  <button type="button" className="jmc-card-menu-button" aria-label={`Open actions for ${job.title}`} onClick={() => { setSelectedSlug(job.slug); setCardMenu(cardMenu === job.slug ? '' : job.slug); }}>...</button>
                  {cardMenu === job.slug && (
                    <div className="jmc-card-menu">
                      <button type="button" onClick={() => editPosition(job)}>Edit Position</button>
                      <button type="button" onClick={() => previewJob(job)}>Preview Position</button>
                      <button type="button" onClick={() => { duplicateJob(job); setCardMenu(''); }}>Duplicate</button>
                      <button type="button" onClick={() => { patchSpecificJob(job, { status: 'closed' }); setCardMenu(''); }}>Close Position</button>
                      <button type="button" onClick={() => { patchSpecificJob(job, { status: 'archived' }); setCardMenu(''); }}>Archive Position</button>
                      <button type="button" className="danger" disabled={user?.role !== 'admin'} onClick={() => { deleteJob(job); setCardMenu(''); }}>Delete Position</button>
                    </div>
                  )}
                </article>
              ))}
              {!filteredJobs.length && <div className="empty-state">No positions match the current search and filters.</div>}
            </div>
          </aside>

          <main className="jmc-panel jmc-center">
            {selectedJob ? (
              <>
                <div className="record-header">
                  <div>
                    <h3>Position Workspace</h3>
                    <p>{selectedJob.title} / {selectedJob.department} / {selectedJob.location}</p>
                  </div>
                  <Badge value={`Job ID: ${selectedJob.id || selectedJob.slug}`} />
                </div>
                <div className="jmc-meta-grid">
                  <div><span>Position Title</span><strong>{selectedJob.title}</strong></div>
                  <div><span>Department</span><strong>{selectedJob.department}</strong></div>
                  <div><span>Location</span><strong>{selectedJob.location}</strong></div>
                  <div><span>Employment Type</span><strong>{selectedJob.employmentType}</strong></div>
                  <div><span>Positions Needed</span><strong>{selectedJob.positionsNeeded || 1}</strong></div>
                  <div><span>Status</span><strong><i className={`jmc-dot ${selectedJob.status}`} />{displayLabel(selectedJob.status)}</strong></div>
                  <div><span>Job ID</span><strong>{selectedJob.id || selectedJob.slug}</strong></div>
                  <div><span>Internal Position #</span><strong>{selectedJob.internalPositionNumber || 'Not recorded'}</strong></div>
                  <div><span>Created Date</span><strong>{formatDateTime(selectedJob.createdAt || selectedJob.postedDate)}</strong></div>
                  <div><span>Last Modified Date</span><strong>{formatDateTime(selectedJob.modifiedAt || selectedJob.postedDate)}</strong></div>
                  <div><span>Assigned Recruiter</span><strong>{selectedRecruiter?.full_name || 'Unassigned'}</strong></div>
                  <div><span>Posting Close Date</span><strong>{toDate(selectedJob.applicationDeadline)}</strong></div>
                  <div><span>Posting Close Time</span><strong>{selectedJob.applicationDeadline ? selectedJob.applicationDeadlineTime || '23:59' : 'Not recorded'}</strong></div>
                  <div><span>Close Timer</span><strong>{closeCountdown(selectedJob.applicationDeadline, selectedJob.applicationDeadlineTime, timerNow)}</strong></div>
                </div>
                <div className="jmc-tabs">
                  {jobTabs.map((tab) => <button type="button" className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
                </div>
                <div className="jmc-tab-panel">
                  {activeTab === 'Overview' && (
                    <>
                      <div className="jmc-tab-actions"><button type="button" onClick={() => editPosition(selectedJob)}>Edit Overview</button><button type="button" onClick={() => previewJob(selectedJob)}>Open Public Preview</button></div>
                      <div className="jmc-overview-grid">
                        <dl>
                          <div><dt>Title</dt><dd>{selectedJob.title}</dd></div>
                          <div><dt>Department</dt><dd>{selectedJob.department}</dd></div>
                          <div><dt>Location</dt><dd>{selectedJob.location}</dd></div>
                          <div><dt>Employment Type</dt><dd>{selectedJob.employmentType}</dd></div>
                          <div><dt>Positions Needed</dt><dd>{selectedJob.positionsNeeded || 1}</dd></div>
                          <div><dt>Travel</dt><dd>{selectedJob.travelRequirement}</dd></div>
                          <div><dt>Clearance</dt><dd>{selectedJob.clearanceRequirement}</dd></div>
                          <div><dt>Compensation</dt><dd>{selectedJob.payRange}</dd></div>
                          <div><dt>Background Requirements</dt><dd>{selectedJob.backgroundRequirement}</dd></div>
                        </dl>
                        <article>
                          <h4>Summary</h4>
                          <p>{selectedJob.positionSummary || selectedJob.summary || 'No summary recorded.'}</p>
                          <div className="jmc-two-up">
                            <div><span>Reports To</span><strong>{selectedJob.reportsTo || 'Not recorded'}</strong></div>
                            <div><span>Supervisory Duties</span><strong>{selectedJob.supervises || 'Not recorded'}</strong></div>
                          </div>
                        </article>
                      </div>
                    </>
                  )}
                  {activeTab === 'Requirements' && <><div className="jmc-tab-actions"><button type="button" onClick={() => editPosition(selectedJob)}>Edit Requirements</button></div><div className="jmc-list-grid">{listBlock('Education Requirements', selectedJob.education)}{listBlock('Experience Requirements', selectedJob.experience)}{listBlock('License Requirements', selectedJob.licenses)}{listBlock('Certification Requirements', selectedJob.certifications)}{listBlock('Skill Requirements', selectedJob.skills)}{listBlock('Physical Requirements', selectedJob.physicalRequirements)}{listBlock('Security Requirements', [selectedJob.backgroundRequirement, ...(selectedJob.requiredQualifications || [])].filter(Boolean))}{listBlock('Travel Requirements', [selectedJob.travelRequirement].filter(Boolean))}</div></>}
                  {activeTab === 'Responsibilities' && <><div className="jmc-tab-actions"><button type="button" onClick={() => editPosition(selectedJob)}>Edit Responsibilities</button></div><div className="jmc-list-grid">{listBlock('Primary Responsibilities', selectedJob.responsibilities)}{listBlock('Daily Duties', selectedJob.dailyDuties)}{listBlock('Weekly Duties', selectedJob.weeklyDuties || [])}{listBlock('Performance Expectations', selectedJob.performanceExpectations)}{listBlock('Leadership Responsibilities', selectedJob.leadershipResponsibilities || [])}{listBlock('Administrative Responsibilities', selectedJob.administrativeResponsibilities || [])}</div></>}
                  {activeTab === 'Benefits' && <><div className="jmc-tab-actions"><button type="button" onClick={() => editPosition(selectedJob)}>Edit Benefits</button></div><div className="jmc-list-grid">{listBlock('Insurance', selectedJob.insurance)}{listBlock('Retirement', selectedJob.retirement)}{listBlock('PTO', selectedJob.pto)}{listBlock('Training', selectedJob.training)}{listBlock('Equipment', selectedJob.equipment)}{listBlock('Company Benefits', selectedJob.benefits || selectedJob.companyBenefits || [])}{listBlock('Additional Benefits', selectedJob.otherBenefits || selectedJob.additionalBenefits || [])}</div></>}
                  {activeTab === 'Hiring Process' && <><div className="jmc-tab-actions"><button type="button" onClick={() => { setForm({ ...emptyJob, ...selectedJob, settings: { ...emptyJob.settings, ...(selectedJob.settings || {}) } }); setModal('job'); }}>Customize Stages</button><button type="button" onClick={resetHiringProcess}>Reset To Default Workflow</button></div><div className="jmc-stage-list">{(selectedJob.hiringProcess || emptyJob.hiringProcess).map((stage, index) => <div key={`${stage}-${index}`}><strong>{stage}</strong>{index < (selectedJob.hiringProcess || emptyJob.hiringProcess).length - 1 && <span>↓</span>}</div>)}</div></>}
                  {activeTab === 'Settings' && (
                    <div className="jmc-settings-tab">
                      {[
                        ['Visibility Settings', [['publicVisibility', 'Public Position'], ['internalOnly', 'Internal Only']]],
                        ['Application Settings', [['allowRemoteApplications', 'Allow Remote Applications'], ['allowContractorApplications', 'Allow Contractor Applications'], ['allowResumeUpload', 'Allow Resume Upload'], ['allowCoverLetter', 'Allow Cover Letter'], ['allowAdditionalDocuments', 'Allow Additional Documents'], ['allowCertificationsUpload', 'Allow Certifications Upload'], ['allowPortfolioUpload', 'Allow Portfolio Upload']]],
                        ['Automation Settings', [['automaticClosing', 'Auto Close Position'], ['autoArchivePosition', 'Auto Archive Position'], ['autoNotifyRecruiter', 'Auto Notify Recruiter'], ['autoNotifyHiringManager', 'Auto Notify Hiring Manager']]],
                        ['Notifications Settings', [['emailNotifications', 'Email Notifications'], ['portalNotifications', 'Portal Notifications'], ['recruiterAlerts', 'Recruiter Alerts'], ['managerAlerts', 'Manager Alerts']]]
                      ].map(([group, rows]) => (
                        <section className="jmc-settings-group" key={group}>
                          <h4>{group}</h4>
                          {rows.map(([key, label]) => <label className="jmc-switch" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(selectedJob.settings?.[key])} onChange={(event) => patchJobSetting(key, event.target.checked)} /><i /></label>)}
                        </section>
                      ))}
                      <section className="jmc-settings-group">
                        <h4>Deadline Settings</h4>
                        <label>Posting Close Date<input type="date" value={selectedJob.applicationDeadline || ''} onChange={(event) => patchJob({ applicationDeadline: event.target.value })} /></label>
                        <label>Posting Close Time<input type="time" value={selectedJob.applicationDeadlineTime || '23:59'} onChange={(event) => patchJob({ applicationDeadlineTime: event.target.value })} /></label>
                        <div><span>Close Timer</span><strong>{closeCountdown(selectedJob.applicationDeadline, selectedJob.applicationDeadlineTime, timerNow)}</strong></div>
                        <label>Posting Expiration Date<input type="date" value={selectedJob.settings?.postingExpirationDate || ''} onChange={(event) => patchJobSetting('postingExpirationDate', event.target.value)} /></label>
                        <label>Position Open Date<input type="date" value={selectedJob.settings?.positionOpenDate || ''} onChange={(event) => patchJobSetting('positionOpenDate', event.target.value)} /></label>
                        <label>Notification Notes<textarea value={selectedJob.settings?.notificationSettings || ''} onChange={(event) => patchJobSetting('notificationSettings', event.target.value)} /></label>
                      </section>
                      <button type="button" onClick={() => editPosition(selectedJob)}>Edit Settings</button>
                    </div>
                  )}
                  {activeTab === 'Activity' && (
                    <>
                      <div className="jmc-tab-actions"><button type="button" onClick={generateActivityReport}>Generate Activity Report</button></div>
                      <div className="jmc-activity-timeline">
                        {activityRows.map((item) => (
                          <div key={item.id}>
                            <time>{formatDateTime(item.created_at)}</time>
                            <strong>{displayLabel(item.action)}</strong>
                            <span>{users.find((person) => person.id === item.user_id)?.full_name || item.user_id || 'System'}</span>
                            <p>{item.metadata?.title || item.metadata?.status || item.metadata?.job_id || item.metadata?.role || 'Position activity recorded.'}</p>
                          </div>
                        ))}
                        {!activityRows.length && <div className="empty-state">No position activity has been recorded for this job yet.</div>}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : <div className="empty-state">Create a position to begin managing jobs.</div>}
          </main>
        </div>

        {modal === 'job' && (
          <div className="jmc-modal">
            <JobForm form={form} setForm={setForm} users={users} onSubmit={saveJob} onCancel={() => setModal('')} submitLabel={selectedJob && selectedSlug ? 'Save Position' : 'Create Position'} />
          </div>
        )}
        {modal === 'assign' && (
          <div className="jmc-modal">
            <form className="jmc-modal-card" onSubmit={(event) => { event.preventDefault(); patchJob({ assignedRecruiterId: form.assignedRecruiterId || null }); setModal(''); }}>
              <h3>Assign Recruiter</h3>
              <label>Recruiter<select value={form.assignedRecruiterId || ''} onChange={(event) => setForm({ ...form, assignedRecruiterId: event.target.value || null })}><option value="">Unassigned</option>{recruiterUsers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
              <div className="table-actions"><button type="submit">Assign Recruiter</button><button type="button" onClick={() => setModal('')}>Cancel</button></div>
            </form>
          </div>
        )}
        {modal === 'message' && (
          <div className="jmc-modal">
            <form className="jmc-modal-card" onSubmit={sendApplicantMessage}>
              <h3>Message Applicant</h3>
              <p>{selectedApplication?.name}</p>
              <label>Message<textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} required /></label>
              {!selectedApplication?.userId && <div className="form-error">This applicant does not have a portal account to receive messages.</div>}
              <div className="table-actions"><button type="submit" disabled={!selectedApplication?.userId}>Send Message</button><button type="button" onClick={() => setModal('')}>Cancel</button></div>
            </form>
          </div>
        )}
        {modal === 'interview' && (
          <div className="jmc-modal">
            <form className="jmc-modal-card" onSubmit={scheduleInterview}>
              <h3>Schedule Interview Task</h3>
              <p>{selectedApplication?.name}</p>
              <label>Due At<input type="datetime-local" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label>
              <div className="table-actions"><button type="submit">Create Task</button><button type="button" onClick={() => setModal('')}>Cancel</button></div>
            </form>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="jobs-portal">
      <div className="job-board-list panel">
        <div className="record-header">
          <div>
            <h3>Open Roles</h3>
            <p>{jobs.length} role{jobs.length === 1 ? '' : 's'} available</p>
          </div>
          {canManage && <button type="button" onClick={startNewJob}>Add Job</button>}
        </div>
        <div className="job-list-stack">
          {jobs.map((job) => (
            <button type="button" key={job.slug} className={`job-list-item${selectedJob?.slug === job.slug ? ' active' : ''}`} onClick={() => setSelectedSlug(job.slug)}>
              <span>
                <strong>{job.title}</strong>
                <small>{job.department} / {job.location} / {job.employmentType}</small>
              </span>
              <Badge value={job.status} />
            </button>
          ))}
          {!jobs.length && <div className="empty-state">No jobs are posted yet.</div>}
        </div>
      </div>

      {canManage ? (
        <form className="panel job-editor" onSubmit={saveJob}>
          <div className="record-header">
            <div>
              <h3>{selectedJob ? 'Edit Job' : 'Create Job'}</h3>
              <p>Changes update the Alpha job board data source.</p>
            </div>
            {selectedJob && <button type="button" className="danger" onClick={deleteJob}>Delete</button>}
          </div>
          <div className="form-grid">
            <label>Title<input value={form.title || ''} onChange={(event) => update('title', event.target.value)} required /></label>
            <label>Slug<input value={form.slug || ''} onChange={(event) => update('slug', event.target.value)} placeholder={jobSlug(form.title)} /></label>
            <label>Department<input value={form.department || ''} onChange={(event) => update('department', event.target.value)} /></label>
            <label>Location<input value={form.location || ''} onChange={(event) => update('location', event.target.value)} /></label>
            <label>Employment Type<input value={form.employmentType || ''} onChange={(event) => update('employmentType', event.target.value)} /></label>
            <label>Status<select value={form.status || 'open'} onChange={(event) => update('status', event.target.value)}><option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label>
            <label>Pay Range<input value={form.payRange || ''} onChange={(event) => update('payRange', event.target.value)} /></label>
            <label>Travel<input value={form.travelRequirement || ''} onChange={(event) => update('travelRequirement', event.target.value)} /></label>
            <label>Background<input value={form.backgroundRequirement || ''} onChange={(event) => update('backgroundRequirement', event.target.value)} /></label>
            <label>Clearance<input value={form.clearanceRequirement || ''} onChange={(event) => update('clearanceRequirement', event.target.value)} /></label>
            <label>Apply Link<input value={form.applyUrl || ''} onChange={(event) => update('applyUrl', event.target.value)} placeholder="/apply/role-slug" /></label>
            <label>Short Summary<textarea value={form.summary || ''} onChange={(event) => update('summary', event.target.value)} /></label>
            <label>Position Summary<textarea value={form.positionSummary || ''} onChange={(event) => update('positionSummary', event.target.value)} /></label>
            <label>Responsibilities<textarea value={form.responsibilitiesText ?? listToText(form.responsibilities)} onChange={(event) => update('responsibilitiesText', event.target.value)} /></label>
            <label>Required Qualifications<textarea value={form.requiredQualificationsText ?? listToText(form.requiredQualifications)} onChange={(event) => update('requiredQualificationsText', event.target.value)} /></label>
            <label>Preferred Qualifications<textarea value={form.preferredQualificationsText ?? listToText(form.preferredQualifications)} onChange={(event) => update('preferredQualificationsText', event.target.value)} /></label>
            <label>Work Environment<textarea value={form.workEnvironmentText ?? listToText(form.workEnvironment)} onChange={(event) => update('workEnvironmentText', event.target.value)} /></label>
          </div>
          <button type="submit">Save Job</button>
        </form>
      ) : (
        <div className="panel job-detail-panel">
          {selectedJob ? (
            <>
              <div className="record-header">
                <div>
                  <h3>{selectedJob.title}</h3>
                  <p>{selectedJob.department} / {selectedJob.location} / {selectedJob.employmentType}</p>
                </div>
                <a className="button-link" href={selectedJob.applyUrl || `/apply/${selectedJob.slug}`}>Apply</a>
              </div>
              <dl className="details-grid">
                <div><dt>Pay Range</dt><dd>{selectedJob.payRange}</dd></div>
                <div><dt>Travel</dt><dd>{selectedJob.travelRequirement}</dd></div>
                <div><dt>Background</dt><dd>{selectedJob.backgroundRequirement}</dd></div>
                <div><dt>Clearance</dt><dd>{selectedJob.clearanceRequirement}</dd></div>
              </dl>
              <h4>Position Summary</h4>
              <p>{selectedJob.positionSummary || selectedJob.summary}</p>
              <h4>Key Responsibilities</h4>
              <ul>{(selectedJob.responsibilities || []).map((item) => <li key={item}>{item}</li>)}</ul>
              <h4>Required Qualifications</h4>
              <ul>{(selectedJob.requiredQualifications || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          ) : (
            <div className="empty-state">Select a role to view details.</div>
          )}
        </div>
      )}
    </section>
  );
}

const templateDefaults = {
  title: '',
  type: 'NDA',
  audience: 'Applicant / Contractor / Company',
  description: '',
  body: '',
  status: 'active'
};

export function LibraryPanel({ library, onRefresh }) {
  const [templateForm, setTemplateForm] = useState(templateDefaults);
  const [editingId, setEditingId] = useState('');
  const jobs = library?.jobs || [];
  const employmentApplications = library?.employmentApplications || [];
  const portalApplications = library?.portalApplications || [];
  const templates = library?.templates || [];

  function editTemplate(template) {
    setEditingId(template.id);
    setTemplateForm(template);
  }

  function updateTemplate(field, value) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTemplate(event) {
    event.preventDefault();
    if (editingId) {
      await api(`/api/library/templates/${editingId}`, { method: 'PATCH', body: JSON.stringify(templateForm) });
    } else {
      await api('/api/library/templates', { method: 'POST', body: JSON.stringify(templateForm) });
    }
    setEditingId('');
    setTemplateForm(templateDefaults);
    onRefresh();
  }

  async function deleteTemplate(template) {
    if (!window.confirm(`Delete ${template.title}?`)) return;
    await api(`/api/library/templates/${template.id}`, { method: 'DELETE' });
    if (editingId === template.id) {
      setEditingId('');
      setTemplateForm(templateDefaults);
    }
    onRefresh();
  }

  return (
    <div className="library-grid">
      <section className="panel library-card">
        <h3>Job Roles And Descriptions</h3>
        <p>{jobs.length} role descriptions in the Alpha job board.</p>
        <div className="stack-list compact-list">
          {jobs.map((job) => (
            <article key={job.slug}>
              <strong>{job.title}</strong>
              <small>{job.department} / {job.location} / {job.employmentType} / {displayLabel(job.status)}</small>
              <p>{job.summary || job.positionSummary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel library-card">
        <h3>Employment Applications</h3>
        <p>{employmentApplications.length} full employment application record{employmentApplications.length === 1 ? '' : 's'}.</p>
        <DataTable
          rows={employmentApplications}
          columns={[
            { key: 'confirmation_number', label: 'Confirmation', sortable: true, render: (row) => row.confirmation_number || 'Not assigned' },
            { key: 'full_name', label: 'Applicant', sortable: true },
            { key: 'role_title', label: 'Role', sortable: true },
            { key: 'department', label: 'Department', sortable: true },
            { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> },
            { key: 'submitted_at', label: 'Submitted', sortable: true, render: (row) => row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : 'Not submitted' }
          ]}
        />
      </section>

      <section className="panel library-card">
        <h3>Portal Application Records</h3>
        <p>{portalApplications.length} portal application status record{portalApplications.length === 1 ? '' : 's'}.</p>
        <DataTable
          rows={portalApplications}
          columns={[
            { key: 'confirmation_number', label: 'Confirmation', sortable: true, render: (row) => row.confirmation_number || 'Not assigned' },
            { key: 'full_name', label: 'Applicant', sortable: true },
            { key: 'role_applied', label: 'Role', sortable: true },
            { key: 'email', label: 'Email', sortable: true },
            { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> }
          ]}
        />
      </section>

      <section className="panel library-card">
        <h3>Templates And Agency Forms</h3>
        <form className="panel-form compact-form" onSubmit={saveTemplate}>
          <div className="form-grid">
            <label>Title<input value={templateForm.title} onChange={(event) => updateTemplate('title', event.target.value)} required /></label>
            <label>Type<input value={templateForm.type} onChange={(event) => updateTemplate('type', event.target.value)} placeholder="NDA, Conflict of Interest, Background Check" required /></label>
            <label>Audience<input value={templateForm.audience} onChange={(event) => updateTemplate('audience', event.target.value)} /></label>
            <label>Status<select value={templateForm.status} onChange={(event) => updateTemplate('status', event.target.value)}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <label>Description<textarea value={templateForm.description} onChange={(event) => updateTemplate('description', event.target.value)} /></label>
            <label>Template Body<textarea value={templateForm.body} onChange={(event) => updateTemplate('body', event.target.value)} /></label>
          </div>
          <div className="table-actions">
            <button type="submit">{editingId ? 'Save Template' : 'Add Template'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(''); setTemplateForm(templateDefaults); }}>Cancel</button>}
          </div>
        </form>
        <div className="stack-list compact-list">
          {templates.map((template) => (
            <article key={template.id}>
              <div className="record-header">
                <div>
                  <strong>{template.title}</strong>
                  <small>{template.type} / {template.audience}</small>
                </div>
                <Badge value={template.status} />
              </div>
              <p>{template.description || 'No description provided.'}</p>
              <div className="table-actions">
                <button type="button" onClick={() => editTemplate(template)}>Edit</button>
                <button type="button" className="danger" onClick={() => deleteTemplate(template)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ApplicationsTable({ applications = [], users = [], onRefresh, allowAssign = false }) {
  async function updateStatus(row, status) {
    await api(`/api/applications/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onRefresh();
  }

  async function assignRecruiter(row, recruiterId) {
    await api(`/api/applications/${row.id}/assign-recruiter`, { method: 'PATCH', body: JSON.stringify({ recruiter_id: recruiterId }) });
    onRefresh();
  }

  return (
    <DataTable
      rows={applications}
      columns={[
        { key: 'confirmation_number', label: 'Confirmation', sortable: true, render: (row) => row.confirmation_number || 'Not assigned' },
        { key: 'full_name', label: 'Applicant', sortable: true },
        { key: 'role_applied', label: 'Role', sortable: true },
        { key: 'employment_type', label: 'Employment Type', sortable: true, render: (row) => row.employment_type || 'Not recorded' },
        { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> },
        { key: 'assigned_recruiter', label: 'Recruiter', render: (row) => row.assigned_recruiter?.full_name || 'Unassigned' },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <div className="table-actions">
              <select value={row.status} onChange={(event) => updateStatus(row, event.target.value)}>
                {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
              </select>
              {allowAssign && (
                <select value={row.assigned_recruiter_id || ''} onChange={(event) => assignRecruiter(row, event.target.value)}>
                  <option value="">Unassigned</option>
                  {users.filter((user) => user.role === 'recruiter').map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              )}
            </div>
          )
        }
      ]}
    />
  );
}

export function CompaniesPanel({ companies = [], onRefresh, canCreate = false }) {
  const [form, setForm] = useState({ name: '', type: 'private investigation firm', point_of_contact: '', email: '', phone: '' });

  async function createCompany(event) {
    event.preventDefault();
    await api('/api/companies', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', type: 'private investigation firm', point_of_contact: '', email: '', phone: '' });
    onRefresh();
  }

  return (
    <div className="split-panel">
      {canCreate && (
        <form className="panel-form" onSubmit={createCompany}>
          <h3>Create Company</h3>
          <input placeholder="Company name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {COMPANY_TYPES.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}
          </select>
          <input placeholder="Point of contact" value={form.point_of_contact} onChange={(event) => setForm({ ...form, point_of_contact: event.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <button type="submit">Create Company</button>
        </form>
      )}
      <DataTable
        rows={companies}
        columns={[
          { key: 'name', label: 'Company', sortable: true },
          { key: 'type', label: 'Type', sortable: true, render: (row) => displayLabel(row.type) },
          { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> },
          { key: 'point_of_contact', label: 'Contact', sortable: true }
        ]}
      />
    </div>
  );
}

export function ContractorsTable({ contractors = [], onRefresh, canManage = false }) {
  async function setStatus(row, status) {
    await api(`/api/contractors/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onRefresh();
  }

  return (
    <DataTable
      rows={contractors}
      columns={[
        { key: 'full_name', label: 'Name', sortable: true },
        { key: 'role', label: 'Role', sortable: true },
        { key: 'location', label: 'Location', sortable: true },
        { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => canManage ? (
            <button type="button" onClick={() => setStatus(row, row.status === 'active' ? 'inactive' : 'active')}>
              {row.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          ) : 'View only'
        }
      ]}
    />
  );
}

export function DocumentsPanel({ documents = [], users = [], onRefresh, canRequest = false }) {
  const [form, setForm] = useState({ owner_user_id: '', name: '', type: 'resume' });
  const [shareDoc, setShareDoc] = useState(null);
  const [shareForm, setShareForm] = useState({ recipient_id: '', body: '' });
  const [viewer, setViewer] = useState(null);

  async function requestDoc(event) {
    event.preventDefault();
    await api('/api/documents/request', { method: 'POST', body: JSON.stringify(form) });
    setForm({ owner_user_id: '', name: '', type: 'resume' });
    onRefresh();
  }

  async function upload(id, file) {
    if (!file) return;
    await uploadDocument(id, file);
    onRefresh();
  }

  async function shareDocument(event) {
    event.preventDefault();
    if (!shareDoc || !shareForm.recipient_id) return;
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: shareForm.recipient_id,
        related_application_id: shareDoc.application_id || null,
        related_contractor_id: shareDoc.contractor_id || null,
        subject: `Shared document: ${shareDoc.name}`,
        body: `${shareForm.body || 'Please review the attached document record.'}\n\nDocument: ${shareDoc.name}\nType: ${displayLabel(shareDoc.type)}\nView: ${window.location.origin}${documentViewUrl(shareDoc.id)}`
      })
    });
    setShareDoc(null);
    setShareForm({ recipient_id: '', body: '' });
    onRefresh();
  }

  return (
    <div className="split-panel">
      {canRequest && (
        <form className="panel-form" onSubmit={requestDoc}>
          <h3>Request Document</h3>
          <select value={form.owner_user_id} onChange={(event) => setForm({ ...form, owner_user_id: event.target.value })} required>
            <option value="">Select user</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name} ({displayLabel(user.role)})</option>)}
          </select>
          <input placeholder="Document name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}
          </select>
          <button type="submit">Request</button>
        </form>
      )}
      <div className="stack-list">
        {documents.map((doc) => (
          <article className="list-card" key={doc.id}>
            <div>
              <strong>{doc.name}</strong>
              <small>{displayLabel(doc.type)}</small>
            </div>
            <Badge value={doc.status} />
            {doc.file_path ? (
              <div className="table-actions">
                <button type="button" onClick={() => setViewer({ title: doc.name, src: documentViewUrl(doc.id) })}>View</button>
                <a className="button-link" href={documentDownloadUrl(doc.id)}>Download</a>
                {users.length > 0 && <button type="button" onClick={() => { setShareDoc(doc); setShareForm({ recipient_id: doc.owner_user_id || '', body: '' }); }}>Share</button>}
              </div>
            ) : <input type="file" onChange={(event) => upload(doc.id, event.target.files?.[0])} />}
          </article>
        ))}
        {!documents.length && <div className="empty-state">No documents requested.</div>}
      </div>
      {shareDoc && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="confirm-modal" onSubmit={shareDocument}>
            <h2>Share Document</h2>
            <p>Send a portal message about {shareDoc.name}.</p>
            <select value={shareForm.recipient_id} onChange={(event) => setShareForm({ ...shareForm, recipient_id: event.target.value })} required>
              <option value="">Select recipient</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}
            </select>
            <textarea value={shareForm.body} onChange={(event) => setShareForm({ ...shareForm, body: event.target.value })} placeholder="Message" />
            <div className="table-actions">
              <button type="submit">Send Share Message</button>
              <button type="button" onClick={() => setShareDoc(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <DocumentViewModal title={viewer?.title} src={viewer?.src} onClose={() => setViewer(null)} />
    </div>
  );
}

export function TasksPanel({ tasks = [], users = [], onRefresh, canCreate = false }) {
  const [form, setForm] = useState({ assigned_to: '', title: '', description: '' });

  async function createTask(event) {
    event.preventDefault();
    await api('/api/tasks', { method: 'POST', body: JSON.stringify(form) });
    setForm({ assigned_to: '', title: '', description: '' });
    onRefresh();
  }

  async function setTaskStatus(task, status) {
    await api(`/api/tasks/${task.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onRefresh();
  }

  return (
    <div className="split-panel">
      {canCreate && (
        <form className="panel-form" onSubmit={createTask}>
          <h3>Create Task</h3>
          <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} required>
            <option value="">Assign to</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name} ({displayLabel(user.role)})</option>)}
          </select>
          <input placeholder="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <textarea placeholder="Task details" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <button type="submit">Create Task</button>
        </form>
      )}
      <div className="stack-list">
        {tasks.map((task) => (
          <article className="list-card" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <small>{task.description || 'No details provided'}</small>
            </div>
            <select value={task.status} onChange={(event) => setTaskStatus(task, event.target.value)}>
              {TASK_STATUSES.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
            </select>
          </article>
        ))}
        {!tasks.length && <div className="empty-state">No tasks assigned.</div>}
      </div>
    </div>
  );
}

export function MessagesPanel({ messages = [], users = [], onRefresh }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ recipient_id: '', subject: '', body: '' });
  const [reply, setReply] = useState('');
  const [activeThreadId, setActiveThreadId] = useState('');

  const userMap = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users]);
  const threads = useMemo(() => {
    const groups = new Map();
    for (const message of messages) {
      const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      const subject = message.subject || 'Portal Message';
      const key = `${otherUserId || 'system'}::${subject}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          subject,
          otherUserId,
          otherUser: userMap[otherUserId],
          messages: [],
          unread: 0,
          latest: message
        });
      }
      const thread = groups.get(key);
      thread.messages.push(message);
      if (message.recipient_id === user.id && !message.read_at) thread.unread += 1;
      if (new Date(message.created_at) > new Date(thread.latest.created_at)) thread.latest = message;
    }
    return [...groups.values()]
      .map((thread) => ({ ...thread, messages: thread.messages.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }))
      .sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at));
  }, [messages, user.id, userMap]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0] || null;

  useEffect(() => {
    if (!activeThreadId && threads[0]) setActiveThreadId(threads[0].id);
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (!activeThread || !activeThread.unread) return;
    let active = true;
    api('/api/messages/read-thread', {
      method: 'PATCH',
      body: JSON.stringify({
        sender_id: activeThread.otherUserId,
        subject: activeThread.subject === 'Portal Message' ? '' : activeThread.subject
      })
    })
      .then(() => {
        if (!active) return;
        onRefresh();
        window.dispatchEvent(new Event('portal-notifications-refresh'));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeThread?.id, activeThread?.unread]);

  async function sendMessage(event) {
    event.preventDefault();
    await api('/api/messages', { method: 'POST', body: JSON.stringify(form) });
    setForm({ recipient_id: '', subject: '', body: '' });
    onRefresh();
    window.dispatchEvent(new Event('portal-notifications-refresh'));
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!activeThread || !reply.trim()) return;
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: activeThread.otherUserId,
        subject: activeThread.subject,
        body: reply
      })
    });
    setReply('');
    onRefresh();
    window.dispatchEvent(new Event('portal-notifications-refresh'));
  }

  function nameFor(id) {
    if (id === user.id) return 'You';
    return userMap[id]?.full_name || 'Portal User';
  }

  return (
    <div className="messages-shell">
      <aside className="thread-list">
        <form className="new-message-form" onSubmit={sendMessage}>
          <h3>New Message</h3>
          <select value={form.recipient_id} onChange={(event) => setForm({ ...form, recipient_id: event.target.value })} required>
            <option value="">Recipient</option>
            {users.filter((item) => item.id !== user.id).map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}
          </select>
          <input placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          <textarea placeholder="Message" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
          <button type="submit">Send</button>
        </form>

        <div className="thread-items">
          {threads.map((thread) => (
            <button type="button" key={thread.id} className={`thread-item${activeThread?.id === thread.id ? ' active' : ''}`} onClick={() => setActiveThreadId(thread.id)}>
              <span>
                <strong>{thread.otherUser?.full_name || 'Portal User'}</strong>
                <small>{thread.subject}</small>
              </span>
              {thread.unread > 0 && <em>{thread.unread}</em>}
            </button>
          ))}
          {!threads.length && <div className="empty-state">No message threads yet.</div>}
        </div>
      </aside>

      <section className="thread-view">
        {activeThread ? (
          <>
            <header className="thread-header">
              <div>
                <h3>{activeThread.otherUser?.full_name || 'Portal User'}</h3>
                <p>{activeThread.subject}</p>
              </div>
              <Badge value={activeThread.unread ? `${activeThread.unread} New` : 'Open'} />
            </header>
            <div className="thread-messages">
              {activeThread.messages.map((message) => (
                <article key={message.id} className={`chat-bubble${message.sender_id === user.id ? ' mine' : ''}`}>
                  <small>{nameFor(message.sender_id)} / {new Date(message.created_at).toLocaleString()}</small>
                  <p><LinkifiedText text={message.body} /></p>
                </article>
              ))}
            </div>
            <form className="reply-form" onSubmit={sendReply}>
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={`Reply to ${activeThread.otherUser?.full_name || 'this thread'}`} required />
              <button type="submit">Reply</button>
            </form>
          </>
        ) : (
          <div className="empty-state">Select a thread to read and reply.</div>
        )}
      </section>
    </div>
  );
}

export function NotesPanel({ application, onRefresh }) {
  const [note, setNote] = useState('');

  async function addNote(event) {
    event.preventDefault();
    if (!application || !note.trim()) return;
    await api(`/api/applications/${application.id}/notes`, { method: 'POST', body: JSON.stringify({ note, visibility: 'internal' }) });
    setNote('');
    onRefresh();
  }

  if (!application) return <div className="empty-state">Select an application to add notes.</div>;

  return (
    <form className="panel-form" onSubmit={addNote}>
      <h3>Add Internal Note</h3>
      <p>{application.full_name} - {application.role_applied}</p>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note" />
      <button type="submit">Add Note</button>
    </form>
  );
}

export function RecentPanels({ documents = [], tasks = [], messages = [] }) {
  return (
    <section className="three-grid">
      <div className="panel">
        <h3>Requested Documents</h3>
        <DocumentList documents={documents.slice(0, 4)} />
      </div>
      <div className="panel">
        <h3>Required Actions</h3>
        <TaskList tasks={tasks.slice(0, 4)} />
      </div>
      <div className="panel">
        <h3>Messages</h3>
        <MessageThread messages={messages.slice(0, 3)} />
      </div>
    </section>
  );
}
