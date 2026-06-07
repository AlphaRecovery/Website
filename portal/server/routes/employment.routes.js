import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb, id, insert, saveDb, updateById } from '../data/store.js';
import { logActivity } from '../auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotificationsForAll } from '../notifications.js';
import { sendEmail } from '../email.js';
import { isRemoteStoragePath, readStoredFile, storeUploadedFile } from '../storage.js';
import { APPLICATION_STATUS, APPLICATION_TOTAL_SECTIONS, degreeMeetsRequirement, ROLE_BY_SLUG, ROLE_CONFIGS, UPLOAD_LABELS } from '../../shared/applicationConfig.js';

const router = express.Router();
const applicationUploadsDir = path.join(config.uploadsDir, 'employment-applications');
fs.mkdirSync(applicationUploadsDir, { recursive: true });

const upload = multer({
  dest: applicationUploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf', '.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase());
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

function requiredEducationErrors(role, education) {
  const errors = [];
  const requirements = role.requiredEducation || [];
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
  if (role.uploads.degree) uploads.push({ field: 'degree', status: role.uploads.degree });
  if (role.uploads.driversLicense) uploads.push({ field: 'driversLicense', status: role.uploads.driversLicense });
  return uploads.filter((item) => item.status === 'required');
}

function scoreApplication(payload, role) {
  const isYes = (value) => String(value || '').toLowerCase() === 'yes';
  const education = payload.education?.highestLevel ? 12 : 0;
  const educationBonus = payload.education?.degrees?.filter((degree) => degree.school || degree.degree).length ? 8 : 0;
  const employers = payload.employmentHistory?.employers || [];
  const years = Number(payload.employmentHistory?.yearsRelevantExperience || 0);
  const relevantExperience = Math.min(30, employers.length * 6 + Math.min(years, 12));
  const certifications = Math.min(15, (payload.certifications?.selected || []).length * 4);
  const governmentExperience = isYes(payload.governmentEligibility?.priorGovernmentContractWork) ? 15 : 0;
  const militaryExperience = isYes(payload.militaryService?.served) ? 10 : 0;
  const availability = payload.availability?.startDate && (role.drivingRequired ? payload.availability?.travelAvailability : true) ? 5 : 0;
  const drivingRecord = role.drivingRequired
    ? (isYes(payload.drivingRecord?.validLicense) && Number(payload.drivingRecord?.movingViolations || 0) <= 1 && Number(payload.drivingRecord?.accidents || 0) <= 1 ? 5 : 0)
    : 5;
  const breakdown = {
    education: Math.min(20, education + educationBonus),
    relevantExperience,
    certifications,
    governmentExperience,
    militaryExperience,
    availability,
    drivingRecord
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total: Math.min(100, total), breakdown };
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
  return `${departmentConfirmationPrefix(role.department)}-${new Date().getFullYear()}-0${last4}`;
}

function sanitizePayload(payload) {
  return {
    ...payload,
    account: { portalAccountCreated: true }
  };
}

async function uploadedFiles(files) {
  const rows = [];
  for (const [field, items] of Object.entries(files || {})) {
    for (const file of items) {
      rows.push({
        id: id(),
        field,
        label: UPLOAD_LABELS[field] || field,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: await storeUploadedFile(file, `employment-applications/${field}`)
      });
    }
  }
  return rows;
}

function visibleEmploymentApplications(user) {
  const rows = getDb().employment_applications;
  if (user.role === 'admin' || user.role === 'recruiter') return rows;
  if (user.role === 'applicant') return rows.filter((row) => row.email === user.email || row.user_id === user.id);
  return [];
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
  res.json({ roles: ROLE_CONFIGS.map(publicRole) });
});

router.get('/application/roles/:slug', (req, res) => {
  const role = ROLE_BY_SLUG[req.params.slug];
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json({ role: publicRole(role) });
});

router.get('/application/draft', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Create or sign in to an applicant account before starting an application.' });
  const schema = z.object({ roleSlug: z.string().min(2) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Role slug is required.' });
  const draft = getDb().employment_application_drafts.find((row) => row.user_id === req.user.id && row.role_slug === parsed.data.roleSlug);
  const submitted = getDb().employment_applications.find((row) => row.user_id === req.user.id && row.role_slug === parsed.data.roleSlug);
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

router.post('/application/submit', requireAuth, requireRole('applicant'), upload.fields(Object.keys(UPLOAD_LABELS).map((name) => ({ name, maxCount: 5 }))), (req, res) => {
  const role = ROLE_BY_SLUG[req.body.roleSlug];
  if (!role) return res.status(404).json({ error: 'Role not found' });
  let payload;
  try {
    payload = JSON.parse(req.body.payload || '{}');
  } catch (error) {
    return res.status(400).json({ error: 'Application payload must be valid JSON.' });
  }

  const errors = validateApplication(payload, role, req.files || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const db = getDb();
  const email = payload.personalInformation.email.toLowerCase();
  const user = db.users.find((item) => item.id === req.user.id && item.role === 'applicant');
  if (!user) return res.status(403).json({ error: 'Applicant account required.' });
  if (email !== user.email.toLowerCase()) return res.status(400).json({ error: 'Application email must match your applicant account.' });
  const duplicate = db.employment_applications.find((row) => row.user_id === user.id && row.role_slug === role.slug);
  if (duplicate) return res.status(409).json({ error: `You already submitted an application for ${role.title}. Your confirmation number is ${duplicate.confirmation_number || 'on file'}.` });

  const finish = async () => {
    const safePayload = sanitizePayload(payload);
    const score = scoreApplication(payload, role);
    const files = await uploadedFiles(req.files);
    const personal = payload.personalInformation || {};
    const confirmation = confirmationNumberFor(role, payload);
    const row = insert('employment_applications', {
      confirmation_number: confirmation,
      user_id: user.id,
      role_slug: role.slug,
      role_title: role.title,
      department: role.department,
      location: role.location,
      employment_type: role.employmentType,
      full_name: personal.fullName,
      email: personal.email.toLowerCase(),
      phone: personal.phone || '',
      status: 'New',
      score: score.total,
      score_breakdown: score.breakdown,
      payload: safePayload,
      files,
      hr_notes: '',
      submitted_at: new Date().toISOString()
    });

    db.employment_application_drafts = db.employment_application_drafts.filter((draft) => !(draft.user_id === user.id && draft.role_slug === row.role_slug));
    db.applications.push({
      id: id(),
      confirmation_number: confirmation,
      user_id: user.id,
      company_id: null,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      role_applied: row.role_title,
      employment_type: row.employment_type,
      experience: safePayload.employmentHistory?.summary || '',
      message: 'Submitted through Alpha employment application.',
      status: 'submitted',
      assigned_recruiter_id: null,
      employment_application_id: row.id,
      created_at: row.submitted_at
    });
    saveDb();
    logActivity(user.id, 'application_submitted', { employment_application_id: row.id, role: row.role_title });
    pushNotificationsForAll();
    await sendEmail({
      to: row.email,
      subject: `Alpha Recovery Application Received - ${confirmation}`,
      text: `Thank you, ${row.full_name}.\n\nYour Alpha Recovery employment application for ${row.role_title} has been submitted.\nConfirmation number: ${confirmation}\n\nYou can sign in to the portal to view your application status.`,
      html: `<p>Thank you, ${row.full_name}.</p><p>Your Alpha Recovery employment application for <strong>${row.role_title}</strong> has been submitted.</p><p>Confirmation number: <strong>${confirmation}</strong></p><p>You can sign in to the portal to view your application status.</p>`
    }).catch((error) => console.error('Application confirmation email failed:', error));

    return res.json({ application: row, confirmation });
  };

  finish().catch((error) => res.status(500).json({ error: error.message || 'Application submission failed.' }));
});

router.get('/admin/employment-applications', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  res.json({ applications: visibleEmploymentApplications(req.user).slice().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)) });
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
  if (req.body.status) {
    if (!APPLICATION_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    const gate = canMoveEmploymentStatus(current.status, req.body.status, current.id);
    if (!gate.ok) return res.status(409).json({ error: gate.error });
    patch.status = req.body.status;
  }
  if (typeof req.body.hr_notes === 'string') patch.hr_notes = req.body.hr_notes;
  const application = updateById('employment_applications', req.params.id, patch);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  logActivity(req.user.id, 'status_change', { employment_application_id: application.id, status: application.status });
  pushNotificationsForAll();
  res.json({ application });
});

router.get('/admin/employment-applications/:id/files/:fileId/download', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const application = visibleEmploymentApplications(req.user).find((row) => row.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  const file = application.files.find((item) => item.id === req.params.fileId);
  if (!file || (!isRemoteStoragePath(file.path) && !fs.existsSync(file.path))) return res.status(404).json({ error: 'File not found' });
  logActivity(req.user.id, 'file_download', { employment_application_id: application.id, file_id: file.id });
  if (isRemoteStoragePath(file.path)) {
    return readStoredFile(file.path)
      .then((buffer) => {
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${String(file.originalName || file.label || 'document').replace(/"/g, '')}"`);
        res.send(buffer);
      })
      .catch((error) => res.status(500).json({ error: error.message }));
  }
  res.download(file.path, file.originalName);
});

router.get('/admin/employment-applications/:id/files/:fileId/view', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const application = visibleEmploymentApplications(req.user).find((row) => row.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  const file = application.files.find((item) => item.id === req.params.fileId);
  if (!file || (!isRemoteStoragePath(file.path) && !fs.existsSync(file.path))) return res.status(404).json({ error: 'File not found' });
  if (file.mimeType) res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${String(file.originalName || file.label || 'document').replace(/"/g, '')}"`);
  logActivity(req.user.id, 'file_view', { employment_application_id: application.id, file_id: file.id });
  if (isRemoteStoragePath(file.path)) {
    return readStoredFile(file.path)
      .then((buffer) => res.send(buffer))
      .catch((error) => res.status(500).json({ error: error.message }));
  }
  res.sendFile(path.resolve(file.path));
});

export default router;
