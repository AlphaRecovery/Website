import { useMemo, useState } from 'react';
import { api, documentDownloadUrl, documentViewUrl, employmentFileDownloadUrl, employmentFileViewUrl } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { APPLICATION_STATUSES, displayLabel } from '../../../shared/constants.js';
import { DocumentViewModal } from './portalShared.jsx';

const portalStatuses = APPLICATION_STATUSES;
const employmentStatuses = ['New', 'Under Review', 'Interview Scheduled', 'Offer Extended', 'Hired', 'Rejected'];
const stageLabels = ['Application Received', 'Review', 'Document Verification', 'Interview Stage', 'Background Review', 'Offer Stage', 'Onboarding', 'Hired'];
const portalStageStatuses = ['submitted', 'review', 'review', 'interview', 'review', 'approved', 'onboarding', 'hired'];
const employmentStageStatuses = ['New', 'Under Review', 'Under Review', 'Interview Scheduled', 'Under Review', 'Offer Extended', 'Hired', 'Hired'];
const interviewTypes = ['phone', 'video', 'in-person', 'panel', 'technical', 'final'];
const interviewStatuses = ['draft', 'scheduling_link_sent', 'scheduled', 'candidate_confirmed', 'rescheduled', 'cancelled', 'completed'];

const iconPaths = {
  user: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm7 8a7 7 0 0 0-14 0',
  file: 'M7 3h7l4 4v14H7V3Zm7 0v5h5',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a5 5 0 0 1 10 0m-2 0a5 5 0 0 1 10 0',
  shield: 'M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Zm-2 9 2 2 4-5',
  mail: 'M3 6h18v12H3V6Zm0 0 9 7 9-7',
  clipboard: 'M9 4h6l1 2h3v15H5V6h3l1-2Zm0 6h6m-6 4h6',
  check: 'M20 6 9 17l-5-5',
  archive: 'M4 7h16v14H4V7Zm2-4h12v4H6V3Zm4 9h4',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v11m0 0 4-4m-4 4-4-4M5 19h14',
  chart: 'M5 19V9m7 10V5m7 14v-7',
  calendar: 'M7 3v4m10-4v4M4 8h16v12H4V8Z',
  clock: 'M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  printer: 'M7 8V3h10v5M6 17H4v-7h16v7h-2M7 14h10v7H7v-7Z',
  trash: 'M5 7h14M10 11v6m4-6v6M8 7l1-3h6l1 3m-9 0 1 14h8l1-14',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'M8 10l4 4 4-4',
  edit: 'M4 20h4l11-11-4-4L4 16v4Zm12-16 4 4',
  x: 'M6 6l12 12M18 6 6 18'
};

function Icon({ name, size = 20 }) {
  return (
    <svg className="roc-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name] || iconPaths.file} />
    </svg>
  );
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AR';
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString();
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeStatus(status = '') {
  const clean = String(status || '').toLowerCase();
  if (clean.includes('hired')) return 'hired';
  if (clean.includes('offer') || clean === 'approved') return 'approved';
  if (clean.includes('onboarding')) return 'onboarding';
  if (clean.includes('interview')) return 'interview';
  if (clean.includes('review')) return 'review';
  if (clean.includes('reject')) return 'rejected';
  if (clean.includes('archive')) return 'archived';
  if (clean.includes('submitted') || clean.includes('new')) return 'submitted';
  return clean || 'received';
}

function statusStage(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'interview') return 3;
  if (normalized === 'approved') return 5;
  if (normalized === 'onboarding') return 6;
  if (normalized === 'hired') return 7;
  if (normalized === 'review') return 1;
  return 0;
}

function isActiveRecruitingCandidate(applicant) {
  const normalized = normalizeStatus(applicant?.status);
  return !['hired', 'rejected', 'archived'].includes(normalized);
}

function isApplicationActivity(item = {}) {
  const action = String(item.action || '');
  const metadata = item.metadata || {};
  return action.includes('application') ||
    ['status_change', 'application_assigned', 'notification_failed'].includes(action) ||
    metadata.application_id ||
    metadata.employment_application_id ||
    metadata.confirmation_number;
}

function optionsForApplicant(applicant) {
  const standardStatuses = applicant?.source === 'employment' ? employmentStatuses : portalStatuses;
  const matchingStandard = standardStatuses.find((status) => String(status).toLowerCase() === String(applicant?.statusValue || applicant?.status || '').toLowerCase());
  if (!applicant?.statusValue || matchingStandard) return standardStatuses;
  return [applicant.statusValue, ...standardStatuses];
}

function statusValueForApplicant(applicant) {
  const standardStatuses = optionsForApplicant(applicant);
  const current = applicant?.statusValue || applicant?.status || '';
  return standardStatuses.find((status) => String(status).toLowerCase() === String(current).toLowerCase()) || current;
}

function stageStatusForApplicant(applicant, index) {
  const statuses = applicant?.source === 'employment' ? employmentStageStatuses : portalStageStatuses;
  return statuses[Math.min(index, statuses.length - 1)];
}

function normalizePortalApplication(app) {
  return {
    source: 'portal',
    id: app.id,
    confirmationNumber: app.confirmation_number || '',
    name: app.full_name || 'Unnamed Applicant',
    initials: initials(app.full_name),
    position: app.role_applied || 'Position not recorded',
    department: app.department || app.company?.name || 'Department not recorded',
    email: app.email || '',
    phone: app.phone || '',
    location: app.location || '',
    applied: app.created_at,
    status: app.status || 'received',
    statusValue: app.status || 'received',
    stage: statusStage(app.status),
    score: app.score ?? null,
    recruiter: app.assigned_recruiter?.full_name || 'Unassigned',
    recruiterId: app.assigned_recruiter?.id || app.assigned_recruiter_id || '',
    employment: app.employment_type || '',
    details: app,
    userId: app.user_id || ''
  };
}

function normalizeEmploymentApplication(app) {
  return {
    source: 'employment',
    id: app.id,
    confirmationNumber: app.confirmation_number || '',
    name: app.full_name || 'Unnamed Applicant',
    initials: initials(app.full_name),
    position: app.role_title || 'Position not recorded',
    department: app.department || 'Department not recorded',
    email: app.email || '',
    phone: app.phone || '',
    location: app.location || '',
    applied: app.submitted_at || app.created_at,
    status: app.status || 'New',
    statusValue: app.status || 'New',
    stage: statusStage(app.status),
    score: typeof app.score === 'number' ? app.score : null,
    recruiter: 'Unassigned',
    recruiterId: '',
    employment: app.employment_type || '',
    details: app,
    userId: app.user_id || ''
  };
}

function downloadText(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

function textareaToList(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function listToTextarea(value = []) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function normalizeDocumentRecord(doc) {
  return {
    id: doc.id,
    name: doc.name || 'Document',
    detail: displayLabel(doc.type || 'document'),
    status: doc.status || 'uploaded',
    applicationId: doc.application_id || null,
    contractorId: doc.contractor_id || null,
    ownerUserId: doc.owner_user_id || '',
    viewUrl: doc.file_path ? documentViewUrl(doc.id) : '',
    downloadUrl: doc.file_path ? documentDownloadUrl(doc.id) : ''
  };
}

function normalizeEmploymentFile(application, file) {
  return {
    id: `${application.id}-${file.id}`,
    name: file.label || file.originalName || 'Uploaded Document',
    detail: file.originalName || 'Employment application upload',
    status: 'uploaded',
    applicationId: application.id,
    contractorId: null,
    ownerUserId: application.userId || application.details?.user_id || '',
    viewUrl: employmentFileViewUrl(application.id, file.id),
    downloadUrl: employmentFileDownloadUrl(application.id, file.id)
  };
}

function Modal({ title, children, onClose, onSubmit, submitLabel = 'Save' }) {
  return (
    <div className="roc-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <form className="roc-modal" onSubmit={onSubmit}>
        <header>
          <div>
            <span>Recruiting Operations</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}><Icon name="x" size={16} /> Cancel</button>
        </header>
        {children}
        <button type="submit">{submitLabel}</button>
      </form>
    </div>
  );
}

function ActionButton({ icon, children, tone = 'default', disabled = false, onClick }) {
  return (
    <button type="button" className={`roc-action roc-action-${tone}`} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={17} />
      <span>{children}</span>
    </button>
  );
}

export default function RecruitingOperations({ applications = [], data = {}, onRefresh }) {
  const { user } = useAuth();
  const users = data.users?.users || [];
  const documents = data.documents?.documents || [];
  const tasks = data.tasks?.tasks || [];
  const messages = data.messages?.messages || [];
  const interviews = data.interviews?.interviews || [];
  const rawActivityRows = data.dashboard?.recentActivity || data.activity?.activity || [];
  const activityRows = rawActivityRows.filter(isApplicationActivity);
  const employmentApps = data.library?.employmentApplications || [];

  const allApplicants = useMemo(() => [
    ...applications.map(normalizePortalApplication),
    ...employmentApps
      .filter((employmentApp) => !applications.some((app) => app.employment_application_id === employmentApp.id))
      .map(normalizeEmploymentApplication)
  ].sort((a, b) => new Date(b.applied || 0) - new Date(a.applied || 0)), [applications, employmentApps]);

  const pipelineApplicants = useMemo(() => allApplicants.filter(isActiveRecruitingCandidate), [allApplicants]);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ department: '', role: '', status: '', recruiter: '', location: '', priority: '', employment: '', score: '' });
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState('');
  const [form, setForm] = useState({});
  const [activeTab, setActiveTab] = useState('Overview');
  const [activeMessageId, setActiveMessageId] = useState('');
  const [messageReply, setMessageReply] = useState('');
  const [viewer, setViewer] = useState(null);
  const [notice, setNotice] = useState('');

  const departments = [...new Set(pipelineApplicants.map((item) => item.department).filter(Boolean))];
  const roles = [...new Set(pipelineApplicants.map((item) => item.position).filter(Boolean))];
  const statuses = [...new Set(pipelineApplicants.map((item) => item.status).filter(Boolean))];
  const recruiters = [...new Set(pipelineApplicants.map((item) => item.recruiter).filter(Boolean))];
  const locations = [...new Set(pipelineApplicants.map((item) => item.location).filter(Boolean))];
  const employmentTypes = [...new Set(pipelineApplicants.map((item) => item.employment).filter(Boolean))];

  const filteredApplicants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pipelineApplicants.filter((applicant) => {
      const matchesQuery = !needle || [applicant.name, applicant.email, applicant.phone, applicant.id, applicant.confirmationNumber].some((value) => String(value || '').toLowerCase().includes(needle));
      const matchesScore = !filters.score || (Number(applicant.score || 0) >= Number(filters.score));
      return matchesQuery
        && (!filters.department || applicant.department === filters.department)
        && (!filters.role || applicant.position === filters.role)
        && (!filters.status || applicant.status === filters.status)
        && (!filters.recruiter || applicant.recruiter === filters.recruiter)
        && (!filters.location || applicant.location === filters.location)
        && (!filters.priority || normalizeStatus(applicant.status) === filters.priority)
        && (!filters.employment || applicant.employment === filters.employment)
        && matchesScore;
    });
  }, [pipelineApplicants, filters, query]);

  const selected = filteredApplicants.find((applicant) => applicant.id === selectedId) || filteredApplicants[0] || null;
  const linkedEmploymentApplication = selected?.source === 'portal'
    ? employmentApps.find((app) => app.id === selected.details?.employment_application_id)
    : null;
  const selectedDocuments = selected ? [
    ...documents
      .filter((doc) => doc.application_id === selected.id || (selected.userId && doc.owner_user_id === selected.userId))
      .map(normalizeDocumentRecord),
    ...((selected.source === 'employment' ? selected.details?.files : linkedEmploymentApplication?.files) || [])
      .map((file) => normalizeEmploymentFile(selected.source === 'employment' ? selected : { ...selected, id: linkedEmploymentApplication.id }, file))
  ] : [];
  const selectedTasks = selected ? tasks.filter((task) => (
    task.related_application_id === selected.id ||
    task.related_employment_application_id === selected.id ||
    (linkedEmploymentApplication?.id && task.related_employment_application_id === linkedEmploymentApplication.id)
  )) : [];
  const selectedMessages = selected ? messages.filter((message) => message.related_application_id === selected.id || (selected.userId && [message.sender_id, message.recipient_id].includes(selected.userId))) : [];
  const selectedInterviews = selected ? interviews.filter((interview) => (
    interview.related_application_id === selected.id ||
    interview.related_employment_application_id === selected.id ||
    (linkedEmploymentApplication?.id && interview.related_employment_application_id === linkedEmploymentApplication.id) ||
    (selected.userId && interview.candidate_user_id === selected.userId)
  )) : [];
  const activeMessage = selectedMessages.find((message) => message.id === activeMessageId) || selectedMessages[0] || null;
  const selectedActivity = selected ? activityRows.filter((row) => JSON.stringify(row.metadata || {}).includes(selected.id) || JSON.stringify(row.metadata || {}).includes(selected.name)) : activityRows;
  const activeInterview = selectedInterviews[0] || null;
  const interviewReady = selectedInterviews.some((interview) => interview.status === 'completed' && Number(interview.evaluation?.overall_score || 0) > 0);

  const counts = {
    total: pipelineApplicants.length,
    new: pipelineApplicants.filter((item) => ['submitted', 'received'].includes(normalizeStatus(item.status))).length,
    review: pipelineApplicants.filter((item) => normalizeStatus(item.status) === 'review').length,
    interview: pipelineApplicants.filter((item) => normalizeStatus(item.status) === 'interview').length,
    background: documents.filter((doc) => String(doc.type || '').includes('background') && !['cleared', 'rejected'].includes(doc.status)).length,
    offer: pipelineApplicants.filter((item) => normalizeStatus(item.status) === 'approved').length,
    onboarding: pipelineApplicants.filter((item) => normalizeStatus(item.status) === 'onboarding').length
  };

  const stats = [
    ['user', counts.total, 'Active Pipeline', ''],
    ['file', counts.new, 'New Applications', 'submitted'],
    ['search', counts.review, 'Under Review', 'review'],
    ['users', counts.interview, 'Interview Stage', 'interview'],
    ['shield', counts.background, 'Background Review', 'background'],
    ['mail', counts.offer, 'Offer Stage', 'approved'],
    ['clipboard', counts.onboarding, 'Onboarding', 'onboarding']
  ];

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setQuery('');
    setFilters({ department: '', role: '', status: '', recruiter: '', location: '', priority: '', employment: '', score: '' });
  }

  async function refreshAfter(message) {
    setNotice(message);
    await onRefresh?.();
  }

  async function setStatus(applicant, status) {
    if (!applicant) return;
    try {
      if (applicant.source === 'employment') {
        await api(`/api/admin/employment-applications/${applicant.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      } else {
        await api(`/api/applications/${applicant.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      }
      await refreshAfter('Applicant status updated.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  function nextStatus(applicant, direction) {
    if (!applicant) return '';
    const list = applicant.source === 'employment' ? employmentStatuses : portalStatuses;
    const index = Math.max(0, list.indexOf(applicant.statusValue));
    return list[Math.min(list.length - 1, Math.max(0, index + direction))];
  }

  async function saveNewApplicant(event) {
    event.preventDefault();
    try {
      await api('/api/applications', { method: 'POST', body: JSON.stringify(form) });
      setModal('');
      setForm({});
      await refreshAfter('Applicant record created.');
    } catch (err) {
      setNotice(err.message || 'Creating the applicant failed.');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    try {
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: form.recipient_id || selected?.userId,
          related_application_id: selected?.source === 'portal' ? selected.id : null,
          subject: form.subject,
          body: form.body
        })
      });
      setModal('');
      setForm({});
      await refreshAfter('Message sent.');
    } catch (err) {
      setNotice(err.message || 'Sending the message failed.');
    }
  }

  async function createTask(event) {
    event.preventDefault();
    try {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          assigned_to: form.assigned_to,
          related_application_id: selected?.source === 'portal' ? selected.id : null,
          title: form.title,
          description: form.description,
          due_at: form.due_at || null
        })
      });
      setModal('');
      setForm({});
      await refreshAfter('Task created.');
    } catch (err) {
      setNotice(err.message || 'Creating the task failed.');
    }
  }

  async function setWorkflowTaskStatus(task, status) {
    try {
      await api(`/api/tasks/${task.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await refreshAfter(status === 'complete' ? 'Workflow task completed.' : 'Workflow task reopened.');
    } catch (err) {
      setNotice(err.message || 'Updating the task failed.');
    }
  }

  function openInterviewModal(interview = null) {
    setForm(interview ? {
      ...interview,
      available_slots_text: listToTextarea(interview.available_slots || []),
      interviewer_ids: interview.interviewer_ids || [],
      evaluation_overall_score: interview.evaluation?.overall_score || '',
      evaluation_recommendation: interview.evaluation?.recommendation || '',
      evaluation_strengths: interview.evaluation?.strengths || '',
      evaluation_concerns: interview.evaluation?.concerns || '',
      evaluation_notes: interview.evaluation?.notes || ''
    } : {
      related_application_id: selected?.source === 'portal' ? selected.id : null,
      related_employment_application_id: selected?.source === 'employment' ? selected.id : linkedEmploymentApplication?.id || null,
      candidate_user_id: selected?.userId || '',
      candidate_name: selected?.name || '',
      candidate_email: selected?.email || '',
      role_title: selected?.position || '',
      interview_type: 'phone',
      scheduled_at: '',
      duration_minutes: 45,
      timezone: 'America/New_York',
      location: '',
      meeting_link: '',
      interviewer_ids: selected?.recruiterId ? [selected.recruiterId] : [user.id],
      instructions: '',
      preparation_materials: '',
      available_slots_text: '',
      send_scheduling_link: false,
      status: 'scheduled',
      internal_notes: '',
      evaluation_overall_score: '',
      evaluation_recommendation: '',
      evaluation_strengths: '',
      evaluation_concerns: '',
      evaluation_notes: ''
    });
    setModal('interview');
  }

  async function saveInterview(event) {
    event.preventDefault();
    const payload = {
      ...form,
      available_slots: textareaToList(form.available_slots_text),
      interviewer_ids: form.interviewer_ids || [],
      evaluation: {
        overall_score: form.evaluation_overall_score,
        recommendation: form.evaluation_recommendation || '',
        strengths: form.evaluation_strengths || '',
        concerns: form.evaluation_concerns || '',
        notes: form.evaluation_notes || ''
      }
    };
    delete payload.available_slots_text;
    delete payload.evaluation_overall_score;
    delete payload.evaluation_recommendation;
    delete payload.evaluation_strengths;
    delete payload.evaluation_concerns;
    delete payload.evaluation_notes;
    try {
      if (form.id) await api(`/api/interviews/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/api/interviews', { method: 'POST', body: JSON.stringify(payload) });
      setModal('');
      setForm({});
      await refreshAfter('Interview workflow saved.');
    } catch (err) {
      setNotice(err.message || 'Saving the interview failed.');
    }
  }

  async function requestDocument(event) {
    event.preventDefault();
    try {
      await api('/api/documents/request', {
        method: 'POST',
        body: JSON.stringify({
          owner_user_id: form.owner_user_id || selected?.userId,
          application_id: selected?.source === 'portal' ? selected.id : null,
          name: form.name,
          type: form.type,
          expires_at: form.expires_at || null
        })
      });
      setModal('');
      setForm({});
      await refreshAfter('Document request created.');
    } catch (err) {
      setNotice(err.message || 'Requesting the document failed.');
    }
  }

  function openShareDocument(doc) {
    if (!doc) return;
    setForm({
      recipient_id: selected?.userId || '',
      subject: `Shared document: ${doc.name}`,
      body: `A document has been shared for review.\n\nDocument: ${doc.name}\nDetails: ${doc.detail}${doc.viewUrl ? `\nView: ${window.location.origin}${doc.viewUrl}` : ''}`
    });
    setModal('share-document');
  }

  async function shareSelectedDocument(event) {
    event.preventDefault();
    try {
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: form.recipient_id,
          related_application_id: selected?.source === 'portal' ? selected.id : null,
          subject: form.subject,
          body: form.body
        })
      });
      setModal('');
      setForm({});
      await refreshAfter('Document share message sent.');
    } catch (err) {
      setNotice(err.message || 'Sharing the document failed.');
    }
  }

  async function replyToActiveMessage(event) {
    event.preventDefault();
    if (!activeMessage || !messageReply.trim()) return;
    const recipientId = activeMessage.sender_id === user.id ? activeMessage.recipient_id : activeMessage.sender_id;
    try {
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: recipientId,
          related_application_id: activeMessage.related_application_id || (selected?.source === 'portal' ? selected.id : null),
          related_contractor_id: activeMessage.related_contractor_id || null,
          subject: activeMessage.subject || `Application: ${selected?.position || 'Applicant'}`,
          body: messageReply
        })
      });
      setMessageReply('');
      await refreshAfter('Reply sent.');
    } catch (err) {
      setNotice(err.message || 'Sending the reply failed.');
    }
  }

  async function deleteApplicant() {
    if (!selected || selected.source !== 'portal') return;
    if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    try {
      await api(`/api/applications/${selected.id}`, { method: 'DELETE' });
      setSelectedId('');
      await refreshAfter('Applicant deleted.');
    } catch (err) {
      setNotice(err.message || 'Deleting the applicant failed.');
    }
  }

  function exportApplicants(format) {
    const rows = filteredApplicants.map((item) => ({
      confirmation_number: item.confirmationNumber || 'Not assigned',
      name: item.name,
      position: item.position,
      department: item.department,
      email: item.email,
      phone: item.phone,
      status: item.status,
      applied: formatDate(item.applied)
    }));
    if (format === 'csv') {
      const header = Object.keys(rows[0] || { confirmation_number: '', name: '', position: '', department: '', email: '', phone: '', status: '', applied: '' });
      const csv = [header.join(','), ...rows.map((row) => header.map((key) => JSON.stringify(row[key] || '')).join(','))].join('\n');
      downloadText('alpha-applicants.csv', csv, 'text/csv');
    } else {
      downloadText(`alpha-applicants.${format === 'pdf' ? 'txt' : 'json'}`, JSON.stringify(rows, null, 2), 'application/json');
    }
  }

  function generateReport(kind = 'recruiting') {
    downloadText(`${kind}-report.json`, JSON.stringify({ generated_at: new Date().toISOString(), counts, applicants: filteredApplicants }, null, 2), 'application/json');
  }

  const empty = !pipelineApplicants.length;

  return (
    <section className="roc-shell">
      <header className="roc-header">
        <div>
          <span className="roc-kicker">Recruiting Module</span>
          <h1>Recruiting Operations Center</h1>
          <p>Review, evaluate, process, and manage applicants throughout the Alpha Recovery hiring pipeline.</p>
        </div>
        <div className="roc-header-tools">
          <span><Icon name="calendar" size={16} /> {new Date().toLocaleDateString()}</span>
          <span><Icon name="clock" size={16} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="roc-user-chip">Welcome,<strong>{user.full_name}</strong><small>{displayLabel(user.role)}</small></span>
          <ActionButton icon="plus" tone="primary" onClick={() => { setForm({ recruiter_id: user.role === 'recruiter' ? user.id : '' }); setModal('new'); }}>New Applicant</ActionButton>
          <ActionButton icon="download" onClick={() => setModal('export')}>Export Applicants</ActionButton>
          <ActionButton icon="chart" onClick={() => generateReport('recruiting')}>Generate Report</ActionButton>
        </div>
      </header>

      {notice && <div className="roc-toast"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}

      <div className="roc-stat-row">
        {stats.map(([icon, value, label, status]) => (
          <button type="button" className="roc-stat" key={label} onClick={() => updateFilter('priority', status)}>
            <Icon name={icon} size={27} />
            <strong>{value}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="roc-workspace">
        <aside className="roc-panel roc-queue">
          <div className="roc-panel-title"><h2>Applicant Queue</h2></div>
          <label className="roc-search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant name, email, phone, or confirmation number" />
            <Icon name="search" size={18} />
          </label>
          <div className="roc-filter-head">
            <strong>Filters</strong>
            <button type="button" onClick={clearFilters}>Clear Filters</button>
          </div>
          <div className="roc-filter-grid">
            <select value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}><option value="">All Departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}><option value="">All Roles</option>{roles.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All Statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.recruiter} onChange={(event) => updateFilter('recruiter', event.target.value)}><option value="">All Recruiters</option>{recruiters.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">All Locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={filters.score} onChange={(event) => updateFilter('score', event.target.value)}><option value="">Any Score</option><option value="90">90+</option><option value="80">80+</option><option value="70">70+</option></select>
            <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">All Priorities</option>{['submitted', 'review', 'interview', 'approved', 'onboarding'].map((item) => <option key={item} value={item}>{displayLabel(item)}</option>)}</select>
            <select value={filters.employment} onChange={(event) => updateFilter('employment', event.target.value)}><option value="">All Types</option>{employmentTypes.map((item) => <option key={item}>{item}</option>)}</select>
          </div>

          <div className="roc-applicant-list">
            {filteredApplicants.map((applicant) => (
              <button type="button" key={`${applicant.source}-${applicant.id}`} className={`roc-applicant-card${selected?.id === applicant.id ? ' active' : ''}`} onClick={() => setSelectedId(applicant.id)}>
                <span className="roc-avatar-mini">{applicant.initials}</span>
                <span>
                  <strong>{applicant.name}</strong>
                  <small>{applicant.position}</small>
                  <small>{applicant.department}</small>
                </span>
                <span className="roc-card-meta">
                  <small>Confirmation: {applicant.confirmationNumber || 'Not assigned'}</small>
                  <small>Applied: {formatDate(applicant.applied)}</small>
                  <em>{displayLabel(applicant.status)}</em>
                  {applicant.score !== null && <b>Score: {applicant.score}%</b>}
                </span>
              </button>
            ))}
            {!filteredApplicants.length && <div className="roc-empty">{empty ? 'No active recruiting candidates are currently in the pipeline.' : 'No active candidates match the current filters.'}</div>}
          </div>
          <footer className="roc-pagination"><span>Showing {filteredApplicants.length} of {pipelineApplicants.length} active candidates</span></footer>
        </aside>

        <main className="roc-panel roc-profile">
          {selected ? (
            <>
              <div className="roc-profile-top">
                <div className="roc-portrait"><span>{selected.initials}</span></div>
                <div className="roc-profile-id">
                  <h2>{selected.name}</h2>
                  <strong>{selected.position}</strong>
                  <span>{selected.department}</span>
                  <dl>
                    <div><dt>Confirmation #:</dt><dd>{selected.confirmationNumber || 'Not assigned'}</dd></div>
                    <div><dt>Email:</dt><dd className="roc-red">{selected.email || 'Not recorded'}</dd></div>
                    <div><dt>Phone:</dt><dd>{selected.phone || 'Not recorded'}</dd></div>
                    <div><dt>Location:</dt><dd>{selected.location || 'Not recorded'}</dd></div>
                  </dl>
                </div>
                <dl className="roc-profile-meta">
                  <div><dt>Application Date:</dt><dd>{formatDate(selected.applied)}</dd></div>
                  <div><dt>Assigned Recruiter:</dt><dd>{selected.recruiter}</dd></div>
                  <div><dt>Employment Type:</dt><dd>{selected.employment || 'Not recorded'}</dd></div>
                  <div><dt>Current Status:</dt><dd className="roc-warn">{displayLabel(selected.status)}</dd></div>
                </dl>
                <div className="roc-profile-actions">
                  <ActionButton icon="mail" disabled={!selected.userId} onClick={() => { setForm({ recipient_id: selected.userId, subject: `Application: ${selected.position}` }); setModal('message'); }}>Message</ActionButton>
                  <ActionButton icon="calendar" onClick={() => openInterviewModal(activeInterview)}>Schedule Interview</ActionButton>
                  <ActionButton icon="check" onClick={() => { setForm({ assigned_to: user.id, title: `Follow up with ${selected.name}` }); setModal('task'); }}>Create Task</ActionButton>
                  <ActionButton icon="printer" onClick={() => window.print()}>Print Profile</ActionButton>
                  <ActionButton icon="file" onClick={() => generateReport(`applicant-${selected.id}`)}>Report</ActionButton>
                </div>
              </div>

              <section className="roc-progress">
                <h3>Application Progress</h3>
                <div className="roc-timeline">
                  {stageLabels.map((stage, index) => (
                    <button type="button" key={stage} className={index < selected.stage ? 'complete' : index === selected.stage ? 'current' : ''} onClick={() => setStatus(selected, stageStatusForApplicant(selected, index))}>
                      <span><Icon name={index === 0 ? 'users' : index === 1 ? 'search' : index === 4 ? 'shield' : index === 6 ? 'clipboard' : 'user'} size={19} /></span>
                      <strong>{stage}</strong>
                      {index === selected.stage && <small>Current</small>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="roc-stage-workspace">
                <header>
                  <div>
                    <span>Current Stage Workspace</span>
                    <h3>{stageLabels[selected.stage] || 'Application Workflow'}</h3>
                  </div>
                  {normalizeStatus(selected.status) === 'interview' && <button type="button" onClick={() => openInterviewModal(activeInterview)}>{activeInterview ? 'Manage Interview' : 'Schedule Interview'}</button>}
                </header>
                {normalizeStatus(selected.status) === 'interview' ? (
                  <div className="roc-stage-grid">
                    <div><strong>Application Review</strong><small>{selected.confirmationNumber || 'No confirmation'} / {selected.score === null ? 'No score' : `${selected.score}% score`}</small></div>
                    <div><strong>Documents</strong><small>{selectedDocuments.length} linked file{selectedDocuments.length === 1 ? '' : 's'}</small></div>
                    <div><strong>Interview</strong><small>{activeInterview ? `${displayLabel(activeInterview.status)} / ${activeInterview.scheduled_at ? new Date(activeInterview.scheduled_at).toLocaleString() : 'No time selected'}` : 'Not scheduled'}</small></div>
                    <div><strong>Completion Gate</strong><small>{interviewReady ? 'Ready to advance' : 'Complete interview and scorecard before advancing'}</small></div>
                  </div>
                ) : (
                  <div className="roc-stage-grid">
                    <div><strong>Required Review</strong><small>Confirm application data, documents, notes, and status before moving forward.</small></div>
                    <div><strong>Stage Controls</strong><small>Use the workflow actions on this page to create tasks, request documents, and communicate.</small></div>
                  </div>
                )}
                <div className="roc-workflow-tasks">
                  <h4>Workflow Tasks And Instructions</h4>
                  {selectedTasks.map((task) => (
                    <article className={task.status === 'complete' ? 'complete' : ''} key={task.id}>
                      <span>
                        <strong>{task.title}</strong>
                        <small>{task.description || 'No instructions recorded.'}</small>
                      </span>
                      <button type="button" onClick={() => setWorkflowTaskStatus(task, task.status === 'complete' ? 'open' : 'complete')}>
                        {task.status === 'complete' ? 'Reopen' : 'Complete'}
                      </button>
                    </article>
                  ))}
                  {!selectedTasks.length && <p>No workflow tasks are linked to this stage yet. Create a task to add required instructions.</p>}
                </div>
              </section>

              <nav className="roc-tabs">
                {['Overview', `Interview Workspace (${selectedInterviews.length})`, `Documents (${selectedDocuments.length})`, `Tasks (${selectedTasks.length})`, `Messages (${selectedMessages.length})`, 'Activity'].map((tab) => <button type="button" className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
              </nav>

              <section className="roc-detail-card">
                <header>
                  <h3>{activeTab}</h3>
                  {activeTab === 'Overview' && <button type="button" onClick={() => setModal('edit')}><Icon name="edit" size={14} /> Change Status</button>}
                </header>
                {activeTab === 'Overview' && (
                  <dl className="roc-info-grid">
                    <div><dt>Full Name:</dt><dd>{selected.name}</dd></div>
                    <div><dt>Phone:</dt><dd>{selected.phone || 'Not recorded'}</dd></div>
                    <div><dt>Email:</dt><dd className="roc-red">{selected.email || 'Not recorded'}</dd></div>
                    <div><dt>Source:</dt><dd>{selected.source === 'employment' ? 'Employment application' : 'Portal application'}</dd></div>
                    <div><dt>Position:</dt><dd>{selected.position}</dd></div>
                    <div><dt>Score:</dt><dd>{selected.score === null ? 'Not scored' : `${selected.score}%`}</dd></div>
                  </dl>
                )}
                {activeTab.startsWith('Interview Workspace') && (
                  <div className="roc-interview-workspace">
                    <div className="roc-interview-toolbar">
                      <button type="button" onClick={() => openInterviewModal(activeInterview)}>{activeInterview ? 'Edit Interview Workflow' : 'Schedule Interview'}</button>
                      <button type="button" disabled={!selected.userId || !activeInterview} onClick={() => {
                        setForm({ recipient_id: selected.userId, subject: `Interview: ${selected.position}`, body: `Interview details:\n\nType: ${displayLabel(activeInterview?.interview_type)}\nTime: ${activeInterview?.scheduled_at ? new Date(activeInterview.scheduled_at).toLocaleString() : 'Pending candidate selection'}\nLocation: ${activeInterview?.location || 'Not recorded'}\nMeeting Link: ${activeInterview?.meeting_link || 'Not recorded'}\n\n${activeInterview?.instructions || ''}` });
                        setModal('message');
                      }}>Send Confirmation</button>
                    </div>
                    {selectedInterviews.map((interview) => (
                      <article className="roc-interview-card" key={interview.id}>
                        <header>
                          <div>
                            <strong>{displayLabel(interview.interview_type)} Interview</strong>
                            <small>{interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Candidate selection pending'} / {displayLabel(interview.status)}</small>
                          </div>
                          <button type="button" onClick={() => openInterviewModal(interview)}>Manage</button>
                        </header>
                        <dl className="roc-info-grid">
                          <div><dt>Location</dt><dd>{interview.location || 'Not recorded'}</dd></div>
                          <div><dt>Meeting Link</dt><dd>{interview.meeting_link ? <a href={interview.meeting_link}>{interview.meeting_link}</a> : 'Not recorded'}</dd></div>
                          <div><dt>Interviewers</dt><dd>{(interview.interviewer_ids || []).map((id) => users.find((item) => item.id === id)?.full_name || id).join(', ') || 'Unassigned'}</dd></div>
                          <div><dt>Score</dt><dd>{interview.evaluation?.overall_score || 'Not scored'}</dd></div>
                        </dl>
                        <div className="roc-stage-grid">
                          <div><strong>Instructions</strong><small>{interview.instructions || 'No instructions recorded.'}</small></div>
                          <div><strong>Preparation Materials</strong><small><LinkifiedText text={interview.preparation_materials || 'No preparation materials recorded.'} /></small></div>
                          <div><strong>Internal Notes</strong><small>{interview.internal_notes || 'No internal notes recorded.'}</small></div>
                          <div><strong>Evaluation</strong><small>{interview.evaluation?.recommendation || 'No recommendation recorded.'}</small></div>
                        </div>
                      </article>
                    ))}
                    {!selectedInterviews.length && <div className="roc-empty">No interview workflow has been created for this applicant.</div>}
                  </div>
                )}
                {activeTab.startsWith('Documents') && (
                  <div className="roc-stack">
                    {selectedDocuments.map((doc) => (
                      <div key={doc.id}>
                        <span><strong>{doc.name}</strong><small>{doc.detail}</small></span>
                        <b>{displayLabel(doc.status)}</b>
                        <span className="table-actions">
                          {doc.viewUrl && <button type="button" onClick={() => setViewer({ title: doc.name, src: doc.viewUrl })}>View</button>}
                          {doc.downloadUrl && <a className="button-link" href={doc.downloadUrl}>Download</a>}
                          <button type="button" onClick={() => openShareDocument(doc)}>Share</button>
                        </span>
                      </div>
                    ))}
                    {!selectedDocuments.length && <div className="roc-empty">No documents are linked to this applicant.</div>}
                  </div>
                )}
                {activeTab.startsWith('Tasks') && <div className="roc-stack">{selectedTasks.map((task) => <div className={task.status === 'complete' ? 'complete' : ''} key={task.id}><span>{task.title}<small>{task.description}</small></span><b>{displayLabel(task.status)}</b></div>)}{!selectedTasks.length && <div className="roc-empty">No tasks are linked to this applicant.</div>}</div>}
                {activeTab.startsWith('Messages') && (
                  <div className="roc-message-workspace">
                    <div className="roc-stack">
                      {selectedMessages.map((message) => (
                        <button type="button" key={message.id} className={`roc-message-row${activeMessage?.id === message.id ? ' active' : ''}`} onClick={() => setActiveMessageId(message.id)}>
                          <span>{message.subject || 'Portal Message'}<small>{message.body}</small></span>
                          <b>{formatDate(message.created_at)}</b>
                        </button>
                      ))}
                      {!selectedMessages.length && <div className="roc-empty">No messages are linked to this applicant.</div>}
                    </div>
                    {activeMessage && (
                      <form className="roc-message-detail" onSubmit={replyToActiveMessage}>
                        <h4>{activeMessage.subject || 'Portal Message'}</h4>
                        <p><LinkifiedText text={activeMessage.body} /></p>
                        <small>{formatDate(activeMessage.created_at)}</small>
                        <textarea value={messageReply} onChange={(event) => setMessageReply(event.target.value)} placeholder="Reply to this message" required />
                        <button type="submit">Send Reply</button>
                      </form>
                    )}
                  </div>
                )}
                {activeTab === 'Activity' && <div className="roc-stack">{selectedActivity.map((item) => <div key={item.id}><span>{displayLabel(item.action)}</span><b>{formatDate(item.created_at)}</b></div>)}{!selectedActivity.length && <div className="roc-empty">No activity is linked to this applicant.</div>}</div>}
              </section>
            </>
          ) : (
            <div className="roc-empty roc-profile-empty">Create or receive an application to begin applicant review.</div>
          )}
        </main>

        <aside className="roc-panel roc-actions">
          <h2>Recruiter Actions</h2>
          <h3>Status Actions</h3>
          <button className="next" type="button" disabled={!selected} onClick={() => setStatus(selected, nextStatus(selected, 1))}>Move To Next Stage <Icon name="arrow" size={16} /></button>
          <button className="prev" type="button" disabled={!selected} onClick={() => setStatus(selected, nextStatus(selected, -1))}>Move To Previous Stage <Icon name="arrow" size={16} /></button>
          <select disabled={!selected} value={selected ? statusValueForApplicant(selected) : ''} onChange={(event) => setStatus(selected, event.target.value)}>
            {optionsForApplicant(selected).map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
          </select>
          <h3>Communication</h3>
          <button type="button" disabled={!selected?.userId} onClick={() => { setForm({ recipient_id: selected.userId, subject: `Application: ${selected.position}` }); setModal('message'); }}><Icon name="mail" size={16} />Send Message</button>
          <button type="button" disabled={!selected?.email} onClick={() => { window.location.href = `mailto:${selected.email}`; }}><Icon name="mail" size={16} />Send Email</button>
          <button type="button" disabled={!selected?.userId} onClick={() => { setForm({ owner_user_id: selected.userId, name: '', type: 'resume' }); setModal('document'); }}><Icon name="file" size={16} />Request Documents</button>
          <h3>Task Management</h3>
          <button type="button" disabled={!selected} onClick={() => { setForm({ assigned_to: user.id, title: `Follow up with ${selected.name}` }); setModal('task'); }}><Icon name="clipboard" size={16} />Create Task</button>
          <button type="button" disabled={!selected} onClick={() => openInterviewModal(activeInterview)}><Icon name="calendar" size={16} />Interview Workspace</button>
          <button type="button" onClick={() => setActiveTab(`Tasks (${selectedTasks.length})`)}><Icon name="clipboard" size={16} />View Tasks ({selectedTasks.length})</button>
          <h3>Applicant Reports</h3>
          {['Applicant Report', 'Interview Report', 'Hiring Report'].map((item) => <button type="button" disabled={!selected} key={item} onClick={() => generateReport(item.toLowerCase().replace(/\s+/g, '-'))}><Icon name="file" size={16} />{item}</button>)}
          <h3>Applicant Disposition</h3>
          <button className="danger" type="button" disabled={!selected} onClick={() => setStatus(selected, selected.source === 'employment' ? 'Rejected' : 'rejected')}><Icon name="archive" size={16} />Reject Applicant</button>
          <button className="danger" type="button" disabled={!selected || selected.source === 'employment'} onClick={() => setStatus(selected, 'archived')}><Icon name="archive" size={16} />Archive Applicant</button>
          <button className="danger" type="button" disabled={!selected || selected.source === 'employment' || user.role !== 'admin'} onClick={deleteApplicant}><Icon name="trash" size={16} />Delete Applicant</button>
        </aside>
      </div>

      <div className="roc-bottom-grid">
        <section className="roc-panel">
          <header className="roc-section-head"><h2>Recent Activity</h2><button type="button" onClick={() => generateReport('activity')}>Export</button></header>
          <div className="roc-activity-list">{activityRows.slice(0, 6).map((item) => <div key={item.id}><time>{formatTime(item.created_at)}</time><span>{displayLabel(item.action)}</span><small>{formatDate(item.created_at)}</small></div>)}{!activityRows.length && <div className="roc-empty">No activity has been recorded.</div>}</div>
        </section>
        <section className="roc-panel">
          <header className="roc-section-head"><h2>Upcoming Calendar</h2><button type="button" onClick={() => { setForm({ assigned_to: user.id, title: '' }); setModal('task'); }}>Add Task</button></header>
          <div className="roc-calendar-list">{tasks.filter((task) => task.due_at).slice(0, 4).map((task) => <article key={task.id}><div><span>{new Date(task.due_at).toLocaleString('en', { month: 'short' })}</span><strong>{new Date(task.due_at).getDate()}</strong></div><p><small>{formatTime(task.due_at)}</small>{task.title}<em>{displayLabel(task.status)}</em></p><b>{users.find((item) => item.id === task.assigned_to)?.full_name || 'Unassigned'}</b></article>)}{!tasks.some((task) => task.due_at) && <div className="roc-empty">No dated tasks are scheduled.</div>}</div>
        </section>
        <section className="roc-panel">
          <header className="roc-section-head"><h2>Pipeline Overview</h2><button type="button" onClick={() => generateReport('pipeline')}>View Report</button></header>
          <div className="roc-pipeline-table">{stats.map(([, value, label]) => <div key={label}><span>{label}</span><b>{value}</b><meter min="0" max={Math.max(1, counts.total)} value={value}>{value}</meter><small>{counts.total ? Math.round((value / counts.total) * 100) : 0}%</small></div>)}</div>
        </section>
      </div>

      {modal === 'new' && (
        <Modal title="New Applicant" onClose={() => setModal('')} onSubmit={saveNewApplicant} submitLabel="Save Applicant">
          <div className="roc-modal-grid">
            <label>First Name<input value={form.first_name || ''} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required /></label>
            <label>Last Name<input value={form.last_name || ''} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required /></label>
            <label>Email<input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label>Phone<input value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Last 4 of SSN<input value={form.ssn_last4 || ''} onChange={(event) => setForm({ ...form, ssn_last4: event.target.value.replace(/\D/g, '').slice(0, 4) })} required /></label>
            <label>Position<input value={form.position || ''} onChange={(event) => setForm({ ...form, position: event.target.value })} required /></label>
            <label>Department<input value={form.department || ''} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
            <label>Recruiter<select value={form.recruiter_id || ''} onChange={(event) => setForm({ ...form, recruiter_id: event.target.value })}><option value="">Unassigned</option>{users.filter((item) => item.role === 'recruiter' || item.role === 'admin').map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
            <label className="roc-field-wide">Notes<textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          </div>
        </Modal>
      )}

      {modal === 'export' && (
        <Modal title="Export Applicants" onClose={() => setModal('')} onSubmit={(event) => { event.preventDefault(); exportApplicants(form.format || 'csv'); setModal(''); }} submitLabel="Export">
          <label>Format<select value={form.format || 'csv'} onChange={(event) => setForm({ ...form, format: event.target.value })}><option value="csv">CSV</option><option value="excel">Excel JSON</option><option value="pdf">PDF Text</option></select></label>
        </Modal>
      )}

      {modal === 'message' && (
        <Modal title="Send Message" onClose={() => setModal('')} onSubmit={sendMessage} submitLabel="Send Message">
          <div className="roc-modal-grid">
            <label>Recipient<select value={form.recipient_id || ''} onChange={(event) => setForm({ ...form, recipient_id: event.target.value })} required><option value="">Select recipient</option>{users.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}</select></label>
            <label>Subject<input value={form.subject || ''} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
            <label className="roc-field-wide">Message<textarea value={form.body || ''} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></label>
          </div>
        </Modal>
      )}

      {modal === 'share-document' && (
        <Modal title="Share Document" onClose={() => setModal('')} onSubmit={shareSelectedDocument} submitLabel="Share Document">
          <div className="roc-modal-grid">
            <label>Recipient<select value={form.recipient_id || ''} onChange={(event) => setForm({ ...form, recipient_id: event.target.value })} required><option value="">Select recipient</option>{users.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}</select></label>
            <label>Subject<input value={form.subject || ''} onChange={(event) => setForm({ ...form, subject: event.target.value })} required /></label>
            <label className="roc-field-wide">Message<textarea value={form.body || ''} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></label>
          </div>
        </Modal>
      )}

      {modal === 'task' && (
        <Modal title="Create Task" onClose={() => setModal('')} onSubmit={createTask} submitLabel="Create Task">
          <div className="roc-modal-grid">
            <label>Assigned To<select value={form.assigned_to || ''} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} required><option value="">Select user</option>{users.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}</select></label>
            <label>Due Date<input type="datetime-local" value={form.due_at || ''} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></label>
            <label className="roc-field-wide">Task Name<input value={form.title || ''} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
            <label className="roc-field-wide">Description<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div>
        </Modal>
      )}

      {modal === 'interview' && (
        <Modal title="Interview Management" onClose={() => setModal('')} onSubmit={saveInterview} submitLabel="Save Interview Workflow">
          <div className="roc-modal-grid">
            <label>Interview Type<select value={form.interview_type || 'phone'} onChange={(event) => setForm({ ...form, interview_type: event.target.value })}>{interviewTypes.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}</select></label>
            <label>Status<select value={form.status || 'scheduled'} onChange={(event) => setForm({ ...form, status: event.target.value })}>{interviewStatuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}</select></label>
            <label>Date and Time<input type="datetime-local" value={form.scheduled_at || ''} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} /></label>
            <label>Duration Minutes<input type="number" min="15" value={form.duration_minutes || 45} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} /></label>
            <label>Location Details<input value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Phone number, office address, room, etc." /></label>
            <label>Meeting Link<input value={form.meeting_link || ''} onChange={(event) => setForm({ ...form, meeting_link: event.target.value })} placeholder="Zoom, Teams, Google Meet, or custom URL" /></label>
            <label className="roc-field-wide">Assigned Interviewers<select multiple value={form.interviewer_ids || []} onChange={(event) => setForm({ ...form, interviewer_ids: Array.from(event.target.selectedOptions).map((option) => option.value) })}>{users.filter((item) => ['admin', 'recruiter'].includes(item.role)).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
            <label className="roc-field-wide">Available Slots For Candidate<textarea value={form.available_slots_text || ''} onChange={(event) => setForm({ ...form, available_slots_text: event.target.value })} placeholder={'2026-06-01T10:00\n2026-06-01T14:00'} /></label>
            <label className="roc-field-wide roc-check-row"><input type="checkbox" checked={Boolean(form.send_scheduling_link)} onChange={(event) => setForm({ ...form, send_scheduling_link: event.target.checked })} /> Send candidate scheduling link</label>
            <label className="roc-field-wide">Instructions<textarea value={form.instructions || ''} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
            <label className="roc-field-wide">Preparation Materials<textarea value={form.preparation_materials || ''} onChange={(event) => setForm({ ...form, preparation_materials: event.target.value })} placeholder="Paste links or instructions for prep materials" /></label>
            <label className="roc-field-wide">Internal Notes<textarea value={form.internal_notes || ''} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} /></label>
            <label>Overall Score<input type="number" min="0" max="100" value={form.evaluation_overall_score || ''} onChange={(event) => setForm({ ...form, evaluation_overall_score: event.target.value })} /></label>
            <label>Recommendation<select value={form.evaluation_recommendation || ''} onChange={(event) => setForm({ ...form, evaluation_recommendation: event.target.value })}><option value="">Select</option><option value="Advance">Advance</option><option value="Hold">Hold</option><option value="Do Not Advance">Do Not Advance</option></select></label>
            <label>Strengths<textarea value={form.evaluation_strengths || ''} onChange={(event) => setForm({ ...form, evaluation_strengths: event.target.value })} /></label>
            <label>Concerns<textarea value={form.evaluation_concerns || ''} onChange={(event) => setForm({ ...form, evaluation_concerns: event.target.value })} /></label>
            <label className="roc-field-wide">Evaluation Notes<textarea value={form.evaluation_notes || ''} onChange={(event) => setForm({ ...form, evaluation_notes: event.target.value })} /></label>
          </div>
        </Modal>
      )}

      {modal === 'document' && (
        <Modal title="Request Documents" onClose={() => setModal('')} onSubmit={requestDocument} submitLabel="Request Documents">
          <div className="roc-modal-grid">
            <label>Owner<select value={form.owner_user_id || ''} onChange={(event) => setForm({ ...form, owner_user_id: event.target.value })} required><option value="">Select owner</option>{users.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({displayLabel(item.role)})</option>)}</select></label>
            <label>Document Type<select value={form.type || 'resume'} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="resume">Resume</option><option value="background_check">Background Check</option><option value="id">ID</option><option value="license">License</option><option value="other">Other</option></select></label>
            <label>Name<input value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Due Date<input type="date" value={form.expires_at || ''} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label>
          </div>
        </Modal>
      )}

      {modal === 'edit' && selected && (
        <Modal title="Change Status" onClose={() => setModal('')} onSubmit={(event) => { event.preventDefault(); setStatus(selected, form.status || statusValueForApplicant(selected)); setModal(''); }} submitLabel="Save Status">
          <label>Status<select value={form.status || statusValueForApplicant(selected)} onChange={(event) => setForm({ ...form, status: event.target.value })}>{optionsForApplicant(selected).map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}</select></label>
        </Modal>
      )}
      <DocumentViewModal title={viewer?.title} src={viewer?.src} onClose={() => setViewer(null)} />
    </section>
  );
}
