import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, employmentFileDownloadUrl, employmentFileViewUrl } from '../api/client.js';
import Badge from '../components/Badge.jsx';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PortalLayout from '../components/PortalLayout.jsx';
import { DocumentViewModal } from './portalShared.jsx';
import { APPLICATION_STATUS, SECTION_TITLES } from '../../../shared/applicationConfig.js';
import { displayLabel } from '../../../shared/constants.js';

function cleanKey(key) {
  return displayLabel(key.replace(/([A-Z])/g, ' $1').toLowerCase());
}

function ValueBlock({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  );
}

function flattenSection(section) {
  if (!section) return [];
  if (Array.isArray(section)) return section.map((item, index) => [`Item ${index + 1}`, JSON.stringify(item, null, 2)]);
  return Object.entries(section).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')]);
}

function ApplicationDetail({ selected, onRefresh }) {
  const [application, setApplication] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    setApplication(selected);
    setSaveError('');
  }, [selected]);

  if (!application) return <div className="panel"><h3>Select an Applicant</h3><p>Choose a submitted application from the table to review the full 16-section record.</p></div>;

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const data = await api(`/api/admin/employment-applications/${application.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: application.status, hr_notes: application.hr_notes || '' })
      });
      setApplication(data.application);
      await onRefresh();
    } catch (err) {
      setSaveError(err.message || 'Saving the review failed.');
    } finally {
      setSaving(false);
    }
  }

  const sectionMap = [
    ['positionInformation', application.payload.positionInformation],
    ['personalInformation', application.payload.personalInformation],
    ['workAuthorization', application.payload.workAuthorization],
    ['availability', application.payload.availability],
    ['militaryService', application.payload.militaryService],
    ['education', application.payload.education],
    ['certificationsAndLanguages', { certifications: application.payload.certifications, languages: application.payload.languages }],
    ['employmentHistory', application.payload.employmentHistory],
    ['governmentEligibility', application.payload.governmentEligibility],
    ['criminalHistory', application.payload.criminalHistory],
    ['drivingRecord', application.payload.drivingRecord],
    ['references', application.payload.references],
    ['backgroundAuthorization', application.payload.backgroundAuthorization],
    ['standardsOfConduct', application.payload.signatures?.standardsOfConduct],
    ['applicationReview', 'Completed prior to final certification'],
    ['applicantCertification', application.payload.applicantCertification || application.payload.signatures?.applicantCertification]
  ];

  return (
    <div className="panel employment-detail">
      <div className="record-header">
        <div>
          <h3>{application.full_name}</h3>
          <p>{application.role_title} / {application.department} / {application.email}</p>
        </div>
        <span className="panel-count">Score {application.score}/100</span>
      </div>

      <dl className="details-grid">
        <ValueBlock label="Role" value={application.role_title} />
        <ValueBlock label="Employment Type" value={application.employment_type} />
        <ValueBlock label="Confirmation Number" value={application.confirmation_number || 'Not assigned'} />
        <ValueBlock label="Department" value={application.department} />
        <ValueBlock label="Submitted" value={new Date(application.submitted_at).toLocaleString()} />
        <ValueBlock label="Phone" value={application.phone} />
      </dl>

      <div className="score-grid">
        {Object.entries(application.score_breakdown || {}).map(([key, value]) => (
          <div key={key}>
          <span>{cleanKey(key)}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="form-grid">
        <label>Status
          <select value={application.status} onChange={(event) => setApplication({ ...application, status: event.target.value })}>
            {APPLICATION_STATUS.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
          </select>
        </label>
        <label>HR Notes
          <textarea value={application.hr_notes || ''} onChange={(event) => setApplication({ ...application, hr_notes: event.target.value })} />
        </label>
      </div>
      {saveError && <div className="form-error">{saveError}</div>}
      <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Review'}</button>

      <div className="application-review-sections">
        <details open>
          <summary>Uploaded Documents ({application.files?.length || 0})</summary>
          <div className="stack-list">
            {application.files?.length ? application.files.map((file) => (
              <article className="list-card" key={file.id}>
                <div>
                  <strong>{file.label}</strong>
                  <small>{file.originalName}</small>
                </div>
                <div className="table-actions">
                  <button type="button" onClick={() => setViewer({ title: file.originalName || file.label, src: employmentFileViewUrl(application.id, file.id) })}>View</button>
                  <a className="button-link file-download" href={employmentFileDownloadUrl(application.id, file.id)}>Download</a>
                </div>
              </article>
            )) : <p>No files uploaded.</p>}
          </div>
        </details>
        {sectionMap.map(([key, value], index) => (
          <details key={key} open={index < 2}>
            <summary>{index + 1}. {SECTION_TITLES[index]}</summary>
            <dl className="details-grid">
              {flattenSection(value).map(([label, sectionValue]) => <ValueBlock key={label} label={cleanKey(label)} value={sectionValue} />)}
            </dl>
          </details>
        ))}
      </div>
      <DocumentViewModal title={viewer?.title} src={viewer?.src} onClose={() => setViewer(null)} />
    </div>
  );
}

export default function EmploymentAdmin() {
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [notificationStatus, setNotificationStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api('/api/admin/employment-applications');
      setApplications(data.applications);
      setSummary(data.summary || {});
      const requestedId = searchParams.get('application');
      if (requestedId && data.applications.some((application) => application.id === requestedId)) {
        setSelectedId(requestedId);
      } else if (!selectedId && data.applications[0]) {
        setSelectedId(data.applications[0].id);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const departments = useMemo(() => [...new Set(applications.map((item) => item.department))], [applications]);
  const roles = useMemo(() => [...new Set(applications.map((item) => item.role_title))], [applications]);
  const filtered = applications.filter((item) => {
    const term = query.toLowerCase();
    return (!term || item.full_name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term) || String(item.confirmation_number || '').toLowerCase().includes(term))
      && (!department || item.department === department)
      && (!role || item.role_title === role)
      && (!status || item.status === status)
      && (!notificationStatus || item.notification_status === notificationStatus);
  });
  const selected = applications.find((item) => item.id === selectedId) || null;

  return (
    <PortalLayout>
      <PageHeader eyebrow="Recruiting Module" title="Employment Applications" description="Review submitted applications, score breakdowns, documents, status, and HR notes." />
      {error && <div className="form-error">{error}</div>}
      <div className="admin-link-row">
        <Link className="button-link" to="/portal/admin">Operations Portal</Link>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><span>New</span><strong>{summary.new_count || 0}</strong></div>
        <div className="stat-card"><span>Email Failed</span><strong>{summary.notification_failed_count || 0}</strong></div>
        <div className="stat-card"><span>Submitted Today</span><strong>{summary.submitted_today_count || 0}</strong></div>
        <div className="stat-card"><span>Assigned To Me</span><strong>{summary.assigned_to_me_count || 0}</strong></div>
        <div className="stat-card"><span>Unassigned</span><strong>{summary.unassigned_count || 0}</strong></div>
      </div>
      <div className="panel form-grid">
        <label>Search Name, Email, or Confirmation Number<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="">All</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option>{APPLICATION_STATUS.map((item) => <option key={item} value={item}>{displayLabel(item)}</option>)}</select></label>
        <label>Email<select value={notificationStatus} onChange={(event) => setNotificationStatus(event.target.value)}><option value="">All</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="pending">Pending</option></select></label>
      </div>
      <div className="split-panel wide-detail">
        <DataTable
          rows={filtered}
          columns={[
            { key: 'full_name', label: 'Name', sortable: true },
            { key: 'confirmation_number', label: 'Confirmation', sortable: true, render: (row) => row.confirmation_number || 'Not assigned' },
            { key: 'role_title', label: 'Role', sortable: true },
            { key: 'employment_type', label: 'Employment Type', sortable: true },
            { key: 'department', label: 'Department', sortable: true },
            { key: 'submitted_at', label: 'Date Submitted', sortable: true, render: (row) => new Date(row.submitted_at).toLocaleDateString() },
            { key: 'score', label: 'Score', sortable: true, render: (row) => <span className="panel-count">{row.score}</span> },
            { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge value={row.status} /> },
            { key: 'notification_status', label: 'Email', sortable: true, render: (row) => <Badge value={row.notification_status === 'failed' ? 'Submitted - Notification Failed' : (row.notification_status || 'pending')} /> },
            { key: 'id', label: 'Review', render: (row) => <button type="button" onClick={() => setSelectedId(row.id)}>Open</button> }
          ]}
        />
        <ApplicationDetail selected={selected} onRefresh={load} />
      </div>
    </PortalLayout>
  );
}
