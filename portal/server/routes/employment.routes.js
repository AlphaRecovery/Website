import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import {
  commitEmploymentSubmission,
  getDb,
  id,
  insert,
  now,
  patchEmploymentApplication,
  saveDb,
  updateEmploymentNotification
} from '../data/store.js';
import { logActivity } from '../auth.js';
import { logFileAccessDenied, sendStoredFileResponse } from '../fileResponses.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canAssignEmploymentApplication, canManageEmploymentApplication, canReviewEmploymentApplication } from '../policies.js';
import { pushNotificationsForAll } from '../notifications.js';
import { sendEmail } from '../email.js';
import { deleteStoredFile, isRemoteStoragePath, storeUploadedFile } from '../storage.js';
import { publicErrorMessage } from '../security.js';
import { buildApplicationPdf } from '../applicationPdf.js';
import { APPLICATION_STATUS, APPLICATION_TOTAL_SECTIONS, degreeMeetsRequirement, EXPERIENCE_ALTERNATIVE_MIN_YEARS, ROLE_BY_SLUG, ROLE_CONFIGS, UPLOAD_LABELS } from '../../shared/applicationConfig.js';

const router = express.Router();
const applicationUploadsDir = path.join(config.uploadsDir, 'employment-applications');
fs.mkdirSync(applicationUploadsDir, { recursive: true });

const upload = multer({
  dest: applicationUploadsDir,
  limits: { fileSize: config.maxUploadFileBytes, files: config.maxUploadFiles },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

const CRIMINAL_SCREENING = [
  'felonyConviction',
  'misdemeanorConviction',
  'pendingCharges',
  'deferredAdjudication',
  'militaryCourtMartial',
  'registryRequired'
];

function publicRole(role) {
  return {
    slug: role.slug,
    title: role.title,
    department: role.department,
    location: role.location,
    employmentType: role.employmentType,
    travel: role.travel,
    drivingRequired: role.drivingRequired,
    languageRole: role.languageRole,
    certs: role.certs,
    uploads: role.uploads,
    requiredEducation: role.requiredEducation,
    minimumRelevantExperienceYears: role.minimumRelevantExperienceYears
  };
}

function completedRows(rows, keys) {
  return rows.filter((row) => keys.every((key) => String(row?.[key] || '').trim()));
}

function calculateEmploymentYears(employers) {
  let totalDays = 0;
  for (const employer of employers || []) {
    if (!employer.employer || !employer.title || !employer.startDate) continue;
    const start = new Date(employer.startDate);
    const end = employer.endDate ? new Date(employer.endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;
    totalDays += Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  }
  return totalDays / 365.25;
}

function usesExperienceEducationAlternative(role, education = {}) {
  return Boolean((role.requiredEducation || []).length && education?.useExperienceAlternative === true);
}

function requiredEducationErrors(role, education) {
  const errors = [];
  const requirements = role.requiredEducation || [];
  if (usesExperienceEducationAlternative(role, education)) return errors;
  const completed = completedRows(education?.degrees || [], ['school', 'degree', 'graduationYear']);

  if (requirements.length && !completed.length) {
    errors.push('Enter the required education history for this position.');
    return errors;
  }

  for (const requirement of requirements) {
    if (!completed.some((degree) => degreeMeetsRequirement(degree.degree, requirement))) {
      errors.push(`${requirement} education requirement not satisfied.`);
    }
  }

  return errors;
}

function requiredUploads(role, payload) {
  const uploads = [{ field: 'resume', status: role.uploads.resume || 'required' }];
  if (payload?.militaryService?.served === 'Yes') {
    uploads.push({ field: 'dd214', status: payload.militaryService.dischargeType === 'Still Serving' ? 'conditional' : 'required' });
  }
  if (usesExperienceEducationAlternative(role, payload?.education)) {
    uploads.push({ field: 'educationExperienceNarrative', status: 'required' });
  } else if (role.uploads.degree) {
    uploads.push({ field: 'degree', status: role.uploads.degree });
  }
  if (role.uploads.driversLicense) uploads.push({ field: 'driversLicense', status: role.uploads.driversLicense });
  return uploads.filter((item) => item.status === 'required');
}

function validateApplication(payload, role, files = {}) {
  const errors = [];
  const personal = payload.personalInformation || {};
  const signatures = payload.signatures || {};
  const employers = payload.employmentHistory?.employers || [];
  const references = payload.references || [];
  const backgroundAuthorization = payload.backgroundAuthorization || {};
  const applicantCertification = payload.applicantCertification || {};
  const criminal = payload.criminalHistory || {};

  if (!personal.fullName) errors.push('Full legal name is required.');
  if (!personal.email) errors.push('Email address is required.');
  if (!/^\d{4}$/.test(personal.ssnLast4 || '')) errors.push('Last 4 of SSN is required.');
  if (!payload.positionInformation?.desiredStartDate) errors.push('Desired start date is required.');
  if (!payload.positionInformation?.desiredPay) errors.push('Desired salary or hourly rate is required.');
  if (!payload.education?.highestLevel) errors.push('Highest education level is required.');
  errors.push(...requiredEducationErrors(role, payload.education));
  if (!completedRows(employers, ['employer', 'title', 'startDate']).length) errors.push('Employment history requires at least one employer with a start date.');
  if (usesExperienceEducationAlternative(role, payload.education) && calculateEmploymentYears(employers) < EXPERIENCE_ALTERNATIVE_MIN_YEARS) {
    errors.push(`Education alternative requires at least ${EXPERIENCE_ALTERNATIVE_MIN_YEARS} years of documented relevant experience.`);
  }
  if ((role.minimumRelevantExperienceYears || 0) > 0 && calculateEmploymentYears(employers) < role.minimumRelevantExperienceYears) {
    errors.push(`Employment history must document at least ${role.minimumRelevantExperienceYears} years of relevant experience.`);
  }
  if (references.filter((item) => item.name && item.phone).length < 3) errors.push('Professional references require at least 3 references.');
  if (role.languageRole === 'required' && !(payload.languages || []).length) {
    errors.push('At least one language is required for this role.');
  }
  if (!backgroundAuthorization.fullLegalName) errors.push('Background authorization full legal name is required.');
  if (!backgroundAuthorization.dateOfBirth) errors.push('Background authorization date of birth is required.');
  if (!/^\d{3}-?\d{2}-?\d{4}$/.test(backgroundAuthorization.socialSecurityNumber || '')) errors.push('Background authorization Social Security Number is required.');
  if (!backgroundAuthorization.currentAddress) errors.push('Background authorization current address is required.');
  if (!backgroundAuthorization.typedSignature || !signatures.backgroundAuthorization) errors.push('Background Investigation Authorization signature is required.');
  if (!backgroundAuthorization.signatureDate) errors.push('Background Investigation Authorization date is required.');
  if (!backgroundAuthorization.printedName) errors.push('Background Investigation Authorization printed name is required.');
  if (!signatures.standardsOfConduct) errors.push('Standards of Conduct signature is required.');
  if (!applicantCertification.typedFullLegalName || !signatures.applicantCertification) errors.push('Applicant Certification signature is required.');
  if (!applicantCertification.date) errors.push('Applicant Certification date is required.');
  if (CRIMINAL_SCREENING.some((key) => !criminal[key])) errors.push('Answer every Criminal History question.');
  if (!criminal.acknowledgment) errors.push('Criminal History certification is required.');

  if (role.drivingRequired) {
    const availability = payload.availability || {};
    const driving = payload.drivingRecord || {};
    if (!availability.travelAvailability) errors.push('Travel availability is required.');
    if (!availability.reliableTransportation || !availability.validDriversLicense || !availability.vehicleInsurance) {
      errors.push('Driving eligibility questions are required.');
    }
    if (!driving.validLicense || !driving.licenseNumber || !driving.state) {
      errors.push('Driving record section is required for this role.');
    }
  }

  for (const item of requiredUploads(role, payload)) {
    if (!files[item.field]?.length) {
      errors.push(`${UPLOAD_LABELS[item.field] || item.field} upload is required.`);
    }
  }

  return errors;
}

function departmentConfirmationPrefix(department) {
  const value = String(department || '').toLowerCase();
  if (value.includes('field')) return 'FO';
  if (value.includes('isd') || value.includes('intelligence')) return 'ISD';
  return 'AD';
}

function confirmationNumberFor(role, payload) {
  const personal = payload.personalInformation || {};
  const last4 = String(personal.ssnLast4 || '').replace(/\D/g, '').slice(-4);
  if (!/^\d{4}$/.test(last4)) throw new Error('Last 4 of SSN is required.');
  const db = getDb();
  const exists = (candidate) => (
    (db.employment_application_submissions || []).some((row) => row.confirmation_number === candidate) ||
    db.employment_applications.some((row) => row.confirmation_number === candidate)
  );
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `${departmentConfirmationPrefix(role.department)}-${new Date().getFullYear()}-0${last4}-${token}`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error('Unable to generate a unique confirmation number. Please try again.');
}

function sanitizePayload(payload) {
  return {
    ...payload,
    account: { portalAccountCreated: true }
  };
}

function visibleEmploymentApplications(user) {
  const rows = getDb().employment_applications;
  if (user.role === 'admin' || user.role === 'recruiter') return rows.filter((row) => canReviewEmploymentApplication(user, row));
  if (user.role === 'applicant') return rows.filter((row) => row.email === user.email || row.user_id === user.id);
  return [];
}

function submittedApplicationFor(db, userId, roleSlug) {
  return (
    db.employment_applications.find((row) => row.user_id === userId && row.role_slug === roleSlug) ||
    (db.employment_application_submissions || []).find((row) => row.user_id === userId && row.role_slug === roleSlug)
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flattenUploadedFiles(files = {}) {
  return Object.entries(files).flatMap(([field, items]) => (
    (items || []).map((file) => ({
      field,
      label: UPLOAD_LABELS[field] || field,
      file
    }))
  ));
}

function applicationPortalPath(applicationId) {
  return `/admin${applicationId ? `?application=${encodeURIComponent(applicationId)}` : ''}`;
}

function applicationEmailText({ role, payload, confirmation, uploads, applicationId }) {
  const personal = payload.personalInformation || {};
  const reviewUrl = `${config.publicPortalUrl.replace(/\/$/, '')}${applicationPortalPath(applicationId)}`;
  return [
    `Position: ${role.title}`,
    `Reference: ${confirmation}`,
    `Review in portal: ${reviewUrl}`,
    '',
    'Applicant',
    `Name: ${personal.fullName || 'Not provided'}`,
    `Email: ${personal.email || 'Not provided'}`,
    `Phone: ${personal.phone || 'Not provided'}`,
    '',
    'Uploaded Files',
    uploads.length ? uploads.map((upload) => `- ${upload.label}: ${upload.file.originalname}`).join('\n') : 'No files uploaded.',
    '',
    'The full completed application and uploads are stored in the portal applicant record.'
  ].join('\n');
}

function applicationEmailHtml({ role, payload, confirmation, uploads, applicationId }) {
  const personal = payload.personalInformation || {};
  const reviewUrl = `${config.publicPortalUrl.replace(/\/$/, '')}${applicationPortalPath(applicationId)}`;
  const uploadList = uploads.length
    ? `<ul>${uploads.map((upload) => `<li><strong>${escapeHtml(upload.label)}:</strong> ${escapeHtml(upload.file.originalname)}</li>`).join('')}</ul>`
    : '<p>No files uploaded.</p>';

  return `
    <h2>Alpha Recovery Employment Application</h2>
    <p><strong>Position:</strong> ${escapeHtml(role.title)}</p>
    <p><strong>Reference:</strong> ${escapeHtml(confirmation)}</p>
    <p><a href="${escapeHtml(reviewUrl)}">Review this application in the portal</a></p>
    <h3>Applicant</h3>
    <p>
      <strong>Name:</strong> ${escapeHtml(personal.fullName || 'Not provided')}<br>
      <strong>Email:</strong> ${escapeHtml(personal.email || 'Not provided')}<br>
      <strong>Phone:</strong> ${escapeHtml(personal.phone || 'Not provided')}
    </p>
    <h3>Uploaded Files</h3>
    ${uploadList}
    <p>The full completed application and uploads are stored in the portal applicant record.</p>
  `;
}

async function removeTemporaryUploads(files = {}) {
  await Promise.all(flattenUploadedFiles(files).map(async ({ file }) => {
    try {
      await fs.promises.unlink(file.path);
    } catch {
    }
  }));
}

async function removeStoredFiles(files = []) {
  await Promise.all(files.map((file) => deleteStoredFile(file.path).catch((error) => {
    console.error('Stored file cleanup failed:', error);
  })));
}

async function persistApplicationPdf({ applicationId, role, payload, confirmation, files }) {
  const filename = `${role.slug || 'alpha-recovery'}-application${confirmation ? `-${confirmation}` : ''}.pdf`;
  const tempPath = path.join(applicationUploadsDir, `${applicationId}-${filename}`);
  const applicationPdf = await buildApplicationPdf({ payload, role, confirmation, uploads: files });
  await fs.promises.writeFile(tempPath, applicationPdf);
  const storedPath = await storeUploadedFile({
    path: tempPath,
    originalname: filename,
    mimetype: 'application/pdf',
    size: applicationPdf.length
  }, `employment-applications/${applicationId}/application`);
  return {
    id: id(),
    field: 'applicationPdf',
    label: 'Completed Application PDF',
    originalName: filename,
    size: applicationPdf.length,
    mimeType: 'application/pdf',
    path: storedPath,
    uploadedAt: now()
  };
}

async function persistUploadedApplicationFiles(files = {}, applicationId, onStored = null) {
  const stored = [];
  for (const upload of flattenUploadedFiles(files)) {
    const storedPath = await storeUploadedFile(upload.file, `employment-applications/${applicationId}/${upload.field}`);
    const record = {
      id: id(),
      field: upload.field,
      label: upload.label,
      originalName: upload.file.originalname,
      size: upload.file.size || 0,
      mimeType: upload.file.mimetype || '',
      path: storedPath,
      uploadedAt: now()
    };
    stored.push(record);
    if (onStored) onStored(record);
  }
  return stored;
}

export function employmentApplicationRecord({ applicationId, user, role, payload, confirmation, files, submittedAt }) {
  const personal = payload.personalInformation || {};
  return {
    id: applicationId,
    user_id: user.id,
    email: personal.email.toLowerCase(),
    role_slug: role.slug,
    role_title: role.title,
    department: role.department,
    location: role.location,
    employment_type: role.employmentType,
    full_name: personal.fullName || '',
    phone: personal.phone || '',
    confirmation_number: confirmation,
    status: APPLICATION_STATUS[0],
    score: 0,
    score_breakdown: {},
    payload,
    files,
    submitted_at: submittedAt
  };
}

export function employmentSubmissionRecord({ user, role, payload, confirmation, uploads, applicationId, submittedAt, emailTo, emailCc }) {
  const personal = payload.personalInformation || {};
  return {
    user_id: user.id,
    email: personal.email.toLowerCase(),
    role_slug: role.slug,
    role_title: role.title,
    department: role.department,
    location: role.location,
    employment_type: role.employmentType,
    full_name: personal.fullName || '',
    confirmation_number: confirmation,
    delivery: 'portal',
    employment_application_id: applicationId,
    email_to: emailTo,
    email_cc: emailCc,
    email_status: 'pending',
    uploaded_files: uploads.map((upload) => ({
      field: upload.field,
      label: upload.label,
      original_name: upload.file.originalname,
      size: upload.file.size || 0,
      mime_type: upload.file.mimetype || ''
    })),
    submitted_at: submittedAt
  };
}

function interviewCompleteForEmploymentApplication(applicationId) {
  return getDb().interviews.some((row) => (
    row.related_employment_application_id === applicationId &&
    row.status === 'completed' &&
    Number(row.evaluation?.overall_score || 0) > 0
  ));
}

function canMoveEmploymentStatus(currentStatus, nextStatus, applicationId) {
  const current = String(currentStatus || '').toLowerCase();
  const next = String(nextStatus || '').toLowerCase();
  const leavingInterview = current.includes('interview') && !next.includes('interview') && next !== 'rejected';
  if (!leavingInterview || interviewCompleteForEmploymentApplication(applicationId)) return { ok: true };
  return { ok: false, error: 'Complete the interview workspace, including interview status and evaluation scorecard, before advancing this candidate.' };
}

router.get('/application/roles', (req, res) => {
  res.json({
    roles: ROLE_CONFIGS.map(publicRole),
    uploadLimits: {
      maxFileBytes: config.maxUploadFileBytes,
      maxRequestBytes: config.maxUploadRequestBytes,
      maxFiles: config.maxUploadFiles
    }
  });
});

router.get('/application/roles/:slug', (req, res) => {
  const role = ROLE_BY_SLUG[req.params.slug];
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json({
    role: publicRole(role),
    uploadLimits: {
      maxFileBytes: config.maxUploadFileBytes,
      maxRequestBytes: config.maxUploadRequestBytes,
      maxFiles: config.maxUploadFiles
    }
  });
});

router.get('/application/draft', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Create or sign in to an applicant account before starting an application.' });
  const schema = z.object({ roleSlug: z.string().min(2) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Role slug is required.' });
  const draft = getDb().employment_application_drafts.find((row) => row.user_id === req.user.id && row.role_slug === parsed.data.roleSlug);
  const submitted = submittedApplicationFor(getDb(), req.user.id, parsed.data.roleSlug);
  res.json({ draft: draft || null, submitted: submitted || null });
});

router.get('/application/drafts', requireAuth, requireRole('applicant'), (req, res) => {
  const drafts = getDb().employment_application_drafts
    .filter((row) => row.user_id === req.user.id)
    .slice()
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  res.json({ drafts });
});

router.post('/application/draft', requireAuth, requireRole('applicant'), (req, res) => {
  const schema = z.object({
    roleSlug: z.string().min(2),
    section: z.number().int().min(1).max(APPLICATION_TOTAL_SECTIONS),
    payload: z.record(z.any())
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Draft requires roleSlug, section, and payload.' });
  const db = getDb();
  let draft = db.employment_application_drafts.find((row) => row.user_id === req.user.id && row.role_slug === parsed.data.roleSlug);
  if (draft) {
    draft.section = parsed.data.section;
    draft.payload = sanitizePayload(parsed.data.payload);
    draft.updated_at = new Date().toISOString();
    saveDb();
  } else {
    draft = insert('employment_application_drafts', {
      user_id: req.user.id,
      email: req.user.email.toLowerCase(),
      role_slug: parsed.data.roleSlug,
      role_title: ROLE_BY_SLUG[parsed.data.roleSlug]?.title || parsed.data.payload?.positionInformation?.roleTitle || '',
      department: ROLE_BY_SLUG[parsed.data.roleSlug]?.department || '',
      section: parsed.data.section,
      payload: sanitizePayload(parsed.data.payload),
      updated_at: new Date().toISOString()
    });
  }
  res.json({ draft });
});

router.delete('/application/draft', requireAuth, requireRole('applicant'), (req, res) => {
  const schema = z.object({ roleSlug: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Role slug is required.' });
  const db = getDb();
  const before = db.employment_application_drafts.length;
  db.employment_application_drafts = db.employment_application_drafts.filter((row) => !(row.user_id === req.user.id && row.role_slug === parsed.data.roleSlug));
  saveDb();
  res.json({ ok: true, deleted: before - db.employment_application_drafts.length });
});

router.post('/application/submit', requireAuth, requireRole('applicant'), upload.fields(Object.keys(UPLOAD_LABELS).map((name) => ({ name, maxCount: 5 }))), async (req, res) => {
  const reject = (status, error) => {
    void removeTemporaryUploads(req.files);
    return res.status(status).json({ error });
  };
  const role = ROLE_BY_SLUG[req.body.roleSlug];
  if (!role) return reject(404, 'Role not found');
  let payload;
  let storedFilesForCleanup = [];
  try {
    payload = JSON.parse(req.body.payload || '{}');
  } catch (error) {
    return reject(400, 'Application payload must be valid JSON.');
  }

  const errors = validateApplication(payload, role, req.files || {});
  if (errors.length) return reject(400, errors.join(' '));

  const db = getDb();
  const email = payload.personalInformation.email.toLowerCase();
  const user = db.users.find((item) => item.id === req.user.id && item.role === 'applicant');
  if (!user) return reject(403, 'Applicant account required.');
  if (email !== user.email.toLowerCase()) return reject(400, 'Application email must match your applicant account.');
  const duplicate = submittedApplicationFor(db, user.id, role.slug);
  if (duplicate) return reject(409, `You already submitted an application for ${role.title}. Your confirmation number is ${duplicate.confirmation_number || 'on file'}.`);

  try {
    const safePayload = sanitizePayload(payload);
    const personal = payload.personalInformation || {};
    const confirmation = confirmationNumberFor(role, payload);
    const uploads = flattenUploadedFiles(req.files);
    const applicationId = id();
    const submittedAt = now();
    const applicationPdf = await persistApplicationPdf({ applicationId, role, payload: safePayload, confirmation, files: req.files || {} });
    storedFilesForCleanup.push(applicationPdf);
    const uploadedFiles = await persistUploadedApplicationFiles(req.files || {}, applicationId, (file) => storedFilesForCleanup.push(file));
    const files = [applicationPdf, ...uploadedFiles];
    const applicationRecord = employmentApplicationRecord({
      applicationId,
      user,
      role,
      payload: safePayload,
      confirmation,
      files,
      submittedAt
    });

    const submissionRecord = employmentSubmissionRecord({
      user,
      role,
      payload: safePayload,
      confirmation,
      uploads,
      applicationId: applicationId,
      submittedAt,
      emailTo: config.applicationEmailTo,
      emailCc: config.applicationEmailCc
    });
    const { application, submission } = await commitEmploymentSubmission({
      application: applicationRecord,
      submission: submissionRecord,
      userId: user.id,
      roleSlug: role.slug
    });
    logActivity(user.id, 'application_submitted', { employment_application_id: application.id, entity_type: 'employment_application', entity_id: application.id, role: role.title, reference: confirmation }, req);
    pushNotificationsForAll();

    const staffEmail = await sendEmail({
      to: config.applicationEmailTo,
      cc: config.applicationEmailCc,
      replyTo: personal.email,
      subject: `Application: ${role.title}`,
      text: applicationEmailText({ role, payload: safePayload, confirmation, uploads, applicationId: application.id }),
      html: applicationEmailHtml({ role, payload: safePayload, confirmation, uploads, applicationId: application.id })
    }).then((result) => ({ ok: true, result })).catch((error) => {
      console.error('Application staff notification email failed:', error);
      return { ok: false, error: error.message };
    });
    await updateEmploymentNotification({
      applicationId: application.id,
      submissionId: submission.id,
      status: staffEmail.ok ? 'sent' : 'failed',
      error: staffEmail.ok ? undefined : staffEmail.error
    });

    await sendEmail({
      to: personal.email,
      subject: `Alpha Recovery Application Received - ${role.title}`,
      text: `Thank you, ${personal.fullName}.\n\nYour Alpha Recovery employment application for ${role.title} has been received.\nReference: ${confirmation}`,
      html: `<p>Thank you, ${escapeHtml(personal.fullName)}.</p><p>Your Alpha Recovery employment application for <strong>${escapeHtml(role.title)}</strong> has been received.</p><p>Reference: <strong>${escapeHtml(confirmation)}</strong></p>`
    }).catch((error) => console.error('Application confirmation email failed:', error));

    return res.json({
      submitted: true,
      emailed: staffEmail.ok,
      confirmation,
      applicationId: application.id,
      warning: staffEmail.ok ? undefined : 'Application was saved in the portal, but the notification email failed.'
    });
  } catch (error) {
    await removeTemporaryUploads(req.files);
    await removeStoredFiles(storedFilesForCleanup);
    if (error?.code === 'DUPLICATE_EMPLOYMENT_APPLICATION') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: publicErrorMessage(error, 'Application submission failed.') });
  }
});

router.get('/admin/employment-applications', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const applications = visibleEmploymentApplications(req.user).slice().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    applications,
    summary: {
      new_count: applications.filter((row) => row.status === 'New').length,
      notification_failed_count: applications.filter((row) => row.notification_status === 'failed').length,
      submitted_today_count: applications.filter((row) => String(row.submitted_at || '').slice(0, 10) === today).length,
      assigned_to_me_count: applications.filter((row) => row.assigned_recruiter_id === req.user.id).length,
      unassigned_count: applications.filter((row) => !row.assigned_recruiter_id).length
    }
  });
});

router.get('/admin/employment-applications/:id', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const application = visibleEmploymentApplications(req.user).find((row) => row.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  res.json({ application });
});

router.patch('/admin/employment-applications/:id', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const patch = {};
  const current = visibleEmploymentApplications(req.user).find((row) => row.id === req.params.id);
  if (!current) return res.status(404).json({ error: 'Application not found' });
  if (!canManageEmploymentApplication(req.user, current)) return res.status(403).json({ error: 'Access denied' });
  if (req.body.status) {
    if (!APPLICATION_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    const gate = canMoveEmploymentStatus(current.status, req.body.status, current.id);
    if (!gate.ok) return res.status(409).json({ error: gate.error });
    patch.status = req.body.status;
  }
  if (typeof req.body.hr_notes === 'string') patch.hr_notes = req.body.hr_notes;
  if (canAssignEmploymentApplication(req.user) && Object.prototype.hasOwnProperty.call(req.body, 'assigned_recruiter_id')) {
    patch.assigned_recruiter_id = req.body.assigned_recruiter_id || null;
    patch.assigned_at = patch.assigned_recruiter_id ? new Date().toISOString() : null;
  }
  patchEmploymentApplication(req.params.id, patch)
    .then((application) => {
      if (!application) return res.status(404).json({ error: 'Application not found' });
      logActivity(req.user.id, patch.assigned_recruiter_id !== undefined ? 'application_assigned' : 'status_change', {
        employment_application_id: application.id,
        entity_type: 'employment_application',
        entity_id: application.id,
        status: application.status,
        assigned_recruiter_id: application.assigned_recruiter_id || null
      }, req);
      pushNotificationsForAll();
      return res.json({ application });
    })
    .catch((error) => res.status(500).json({ error: error.message || 'Application update failed.' }));
});

router.get('/admin/employment-applications/:id/files/:fileId/download', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const application = getDb().employment_applications.find((row) => row.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (!canReviewEmploymentApplication(req.user, application)) {
    logFileAccessDenied(req, { employment_application_id: application.id, file_id: req.params.fileId, entity_type: 'employment_application', entity_id: application.id });
    return res.status(403).json({ error: 'Access denied' });
  }
  const file = (application.files || []).find((item) => item.id === req.params.fileId);
  if (!file || (!isRemoteStoragePath(file.path) && !fs.existsSync(file.path))) return res.status(404).json({ error: 'File not found' });
  return sendStoredFileResponse({
    req,
    res,
    filePath: file.path,
    mimeType: file.mimeType,
    filename: file.originalName || file.label,
    disposition: 'attachment',
    audit: { action: 'file_download', metadata: { employment_application_id: application.id, file_id: file.id, entity_type: 'employment_application', entity_id: application.id } }
  }).catch((error) => res.status(500).json({ error: publicErrorMessage(error, 'File download failed.') }));
});

router.get('/admin/employment-applications/:id/files/:fileId/view', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const application = getDb().employment_applications.find((row) => row.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (!canReviewEmploymentApplication(req.user, application)) {
    logFileAccessDenied(req, { employment_application_id: application.id, file_id: req.params.fileId, entity_type: 'employment_application', entity_id: application.id });
    return res.status(403).json({ error: 'Access denied' });
  }
  const file = (application.files || []).find((item) => item.id === req.params.fileId);
  if (!file || (!isRemoteStoragePath(file.path) && !fs.existsSync(file.path))) return res.status(404).json({ error: 'File not found' });
  return sendStoredFileResponse({
    req,
    res,
    filePath: file.path,
    mimeType: file.mimeType,
    filename: file.originalName || file.label,
    disposition: 'inline',
    audit: { action: 'file_view', metadata: { employment_application_id: application.id, file_id: file.id, entity_type: 'employment_application', entity_id: application.id } }
  }).catch((error) => res.status(500).json({ error: publicErrorMessage(error, 'File view failed.') }));
});

export default router;
