import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { fileURLToPath } from 'node:url';
import { getDb, id, insert, readJobs, saveDb, updateById, writeJobs } from '../data/store.js';
import { logActivity, publicUser } from '../auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notificationCounts, pushNotifications, pushNotificationsForAll, registerNotificationClient } from '../notifications.js';
import { canReviewEmploymentApplication } from '../policies.js';
import { ROLE_CONFIGS } from '../../shared/applicationConfig.js';

const router = express.Router();
const siteContentPath = path.resolve(config.root, '..', 'content', 'site.json');
const hasSiteContentFile = () => fs.existsSync(siteContentPath);
const jobsCatalogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'jobs-catalog.json');

function defaultJobsFromRoles() {
  return ROLE_CONFIGS.map((role) => ({
    id: role.slug,
    slug: role.slug,
    title: role.title,
    location: role.location,
    department: role.department,
    employmentType: role.employmentType,
    payRange: 'Based on role, experience, and assignment',
    travelRequirement: role.drivingRequired ? 'Varies by assignment' : 'None',
    backgroundRequirement: 'Tier 2 public trust investigation required',
    clearanceRequirement: 'Tier 2 - Public Trust Position',
    applicationDeadline: '',
    applicationDeadlineTime: '23:59',
    positionsNeeded: 1,
    internalPositionNumber: '',
    assignedRecruiterId: null,
    createdBy: '',
    createdByName: '',
    createdAt: '',
    modifiedBy: '',
    modifiedByName: '',
    modifiedAt: '',
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
    postedDate: new Date().toISOString().slice(0, 10),
    status: 'open',
    applyUrl: `/apply/${role.slug}`,
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
    }
  }));
}

function seedJobs() {
  try {
    const catalog = JSON.parse(fs.readFileSync(jobsCatalogPath, 'utf8'));
    if (Array.isArray(catalog) && catalog.length) return catalog;
  } catch {
    // fall through to role-derived defaults if the bundled catalog is missing
  }
  return defaultJobsFromRoles();
}

async function readSiteContent() {
  if (hasSiteContentFile()) {
    return JSON.parse(fs.readFileSync(siteContentPath, 'utf8'));
  }
  let jobs = await readJobs();
  // Seed only when the store has never held jobs (null) or is empty — never on
  // a transient read, so an intentional delete is not resurrected.
  if (jobs === null || jobs.length === 0) {
    jobs = seedJobs();
    await writeJobs(jobs);
  }
  return { opportunities: { jobs } };
}

async function writeSiteContent(content) {
  if (hasSiteContentFile()) {
    fs.writeFileSync(siteContentPath, `${JSON.stringify(content, null, 2)}\n`);
    return;
  }
  await writeJobs(content.opportunities?.jobs || []);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function displayLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const jobSchema = z.object({
  title: z.string().min(2),
  slug: z.string().optional(),
  id: z.string().optional(),
  location: z.string().optional().default('Nationwide'),
  department: z.string().optional().default('Admin'),
  employmentType: z.string().optional().default('Full Time'),
  payRange: z.string().optional().default('Based on role, experience, and assignment'),
  travelRequirement: z.string().optional().default('Varies by assignment'),
  backgroundRequirement: z.string().optional().default('Tier 2 public trust investigation required'),
  clearanceRequirement: z.string().optional().default('Tier 2 - Public Trust Position'),
  applicationDeadline: z.string().optional().default(''),
  applicationDeadlineTime: z.string().optional().default('23:59'),
  positionsNeeded: z.coerce.number().int().min(1).optional().default(1),
  internalPositionNumber: z.string().optional().default(''),
  assignedRecruiterId: z.string().optional().nullable(),
  createdBy: z.string().optional().default(''),
  createdByName: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  modifiedBy: z.string().optional().default(''),
  modifiedByName: z.string().optional().default(''),
  modifiedAt: z.string().optional().default(''),
  reportsTo: z.string().optional().default(''),
  supervises: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  positionSummary: z.string().optional().default(''),
  responsibilities: z.array(z.string()).optional().default([]),
  dailyDuties: z.array(z.string()).optional().default([]),
  weeklyDuties: z.array(z.string()).optional().default([]),
  performanceExpectations: z.array(z.string()).optional().default([]),
  leadershipResponsibilities: z.array(z.string()).optional().default([]),
  administrativeResponsibilities: z.array(z.string()).optional().default([]),
  requiredQualifications: z.array(z.string()).optional().default([]),
  preferredQualifications: z.array(z.string()).optional().default([]),
  education: z.array(z.string()).optional().default([]),
  experience: z.array(z.string()).optional().default([]),
  licenses: z.array(z.string()).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  physicalRequirements: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  insurance: z.array(z.string()).optional().default([]),
  pto: z.array(z.string()).optional().default([]),
  retirement: z.array(z.string()).optional().default([]),
  training: z.array(z.string()).optional().default([]),
  equipment: z.array(z.string()).optional().default([]),
  otherBenefits: z.array(z.string()).optional().default([]),
  hiringProcess: z.array(z.string()).optional().default([]),
  workEnvironment: z.array(z.string()).optional().default([]),
  settings: z.record(z.any()).optional().default({}),
  status: z.enum(['open', 'draft', 'paused', 'closed', 'archived']).optional().default('open'),
  applyUrl: z.string().optional().default('')
});

const templateSchema = z.object({
  title: z.string().min(2),
  type: z.string().min(2),
  audience: z.string().optional().default('Applicant / Contractor / Company'),
  description: z.string().optional().default(''),
  body: z.string().optional().default(''),
  status: z.string().optional().default('active')
});

const manualApplicationSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  ssn_last4: z.string().regex(/^\d{4}$/),
  position: z.string().min(1),
  department: z.string().optional().default(''),
  recruiter_id: z.string().optional().nullable(),
  notes: z.string().optional().default('')
});

const interviewSchema = z.object({
  related_application_id: z.string().optional().nullable(),
  related_employment_application_id: z.string().optional().nullable(),
  candidate_user_id: z.string().optional().nullable(),
  candidate_name: z.string().optional().default(''),
  candidate_email: z.string().optional().default(''),
  role_title: z.string().optional().default(''),
  interview_type: z.string().optional().default('phone'),
  scheduled_at: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().int().min(15).max(480).optional().default(45),
  timezone: z.string().optional().default('America/New_York'),
  location: z.string().optional().default(''),
  meeting_link: z.string().optional().default(''),
  interviewer_ids: z.array(z.string()).optional().default([]),
  instructions: z.string().optional().default(''),
  preparation_materials: z.string().optional().default(''),
  available_slots: z.array(z.string()).optional().default([]),
  send_scheduling_link: z.boolean().optional().default(false),
  status: z.string().optional().default('scheduled'),
  internal_notes: z.string().optional().default(''),
  evaluation: z.record(z.any()).optional().default({})
});

function departmentConfirmationPrefix(department) {
  const value = String(department || '').toLowerCase();
  if (value.includes('field')) return 'FO';
  if (value.includes('isd') || value.includes('intelligence')) return 'ISD';
  return 'AD';
}

function confirmationNumberFor(department, last4) {
  return `${departmentConfirmationPrefix(department)}-${new Date().getFullYear()}-0${last4}`;
}

function visibleInterviews(user) {
  const db = getDb();
  if (user.role === 'admin') return db.interviews;
  if (user.role === 'recruiter') {
    return db.interviews.filter((row) => {
      const { application } = relatedInterviewRecords(row);
      return row.created_by === user.id || row.interviewer_ids?.includes(user.id) || application?.assigned_recruiter_id === user.id;
    });
  }
  if (user.role === 'applicant') return db.interviews.filter((row) => row.candidate_user_id === user.id);
  return [];
}

function interviewCompleteForApplication(appId, employmentId) {
  const rows = getDb().interviews.filter((row) => (
    (appId && row.related_application_id === appId) ||
    (employmentId && row.related_employment_application_id === employmentId)
  ));
  return rows.some((row) => row.status === 'completed' && Number(row.evaluation?.overall_score || 0) > 0);
}

function relatedInterviewRecords(interview) {
  const db = getDb();
  const application = interview.related_application_id
    ? db.applications.find((row) => row.id === interview.related_application_id)
    : db.applications.find((row) => row.employment_application_id && row.employment_application_id === interview.related_employment_application_id);
  const employmentApplication = interview.related_employment_application_id
    ? db.employment_applications.find((row) => row.id === interview.related_employment_application_id)
    : application?.employment_application_id
      ? db.employment_applications.find((row) => row.id === application.employment_application_id)
      : null;
  return { application, employmentApplication };
}

function interviewParticipants(interview, actorId) {
  const { application } = relatedInterviewRecords(interview);
  return [...new Set([
    actorId,
    interview.created_by,
    interview.updated_by,
    interview.candidate_user_id,
    application?.assigned_recruiter_id,
    ...(interview.interviewer_ids || [])
  ].filter(Boolean))];
}

function interviewTaskTitle(interview, audience) {
  const candidate = interview.candidate_name || 'Candidate';
  const role = interview.role_title || 'Alpha Recovery role';
  if (audience === 'candidate') return `Interview scheduled: ${role}`;
  return `Interview with ${candidate}: ${role}`;
}

function upsertInterviewTask({ interview, userId, actorId, audience, status = 'open' }) {
  if (!userId) return null;
  const db = getDb();
  const title = interviewTaskTitle(interview, audience);
  const existing = db.tasks.find((task) => task.interview_id === interview.id && task.assigned_to === userId && task.title === title);
  const description = [
    `Interview Type: ${displayLabel(interview.interview_type || 'interview')}`,
    `Status: ${displayLabel(interview.status || 'scheduled')}`,
    `When: ${interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Pending scheduling'}`,
    `Location: ${interview.location || 'Not recorded'}`,
    `Meeting Link: ${interview.meeting_link || 'Not recorded'}`,
    interview.instructions ? `Instructions: ${interview.instructions}` : ''
  ].filter(Boolean).join('\n');
  if (existing) {
    existing.description = description;
    existing.due_at = interview.scheduled_at || existing.due_at || null;
    existing.status = status;
    existing.updated_at = new Date().toISOString();
    return existing;
  }
  return insert('tasks', {
    assigned_to: userId,
    assigned_by: actorId,
    related_application_id: interview.related_application_id || null,
    related_employment_application_id: interview.related_employment_application_id || null,
    related_contractor_id: null,
    interview_id: interview.id,
    title,
    description,
    status,
    due_at: interview.scheduled_at || null
  });
}

function sendInterviewMessage({ interview, actorId, recipientId, subject, body }) {
  if (!recipientId || recipientId === actorId) return null;
  return insert('messages', {
    sender_id: actorId,
    recipient_id: recipientId,
    related_application_id: interview.related_application_id || null,
    related_contractor_id: null,
    interview_id: interview.id,
    subject,
    body,
    read_at: null
  });
}

function syncInterviewWorkflow(interview, actor, eventName) {
  const db = getDb();
  const { application, employmentApplication } = relatedInterviewRecords(interview);
  const now = new Date().toISOString();
  const isCancelled = interview.status === 'cancelled';
  const isCompleted = interview.status === 'completed';
  const isScheduled = ['scheduled', 'candidate_confirmed', 'rescheduled', 'scheduling_link_sent'].includes(interview.status);
  const taskStatus = isCompleted ? 'complete' : isCancelled ? 'blocked' : 'open';
  const scheduleUrl = interview.schedule_token ? `/schedule/${interview.schedule_token}` : '';
  const subject = isCancelled
    ? `Interview cancelled: ${interview.role_title || 'Alpha Recovery'}`
    : isCompleted
      ? `Interview completed: ${interview.role_title || 'Alpha Recovery'}`
      : `Interview scheduled: ${interview.role_title || 'Alpha Recovery'}`;
  const candidateBody = [
    isCancelled ? 'Your interview has been cancelled.' : isCompleted ? 'Your interview has been marked complete.' : 'Your interview information has been updated.',
    '',
    `Role: ${interview.role_title || 'Not recorded'}`,
    `Type: ${displayLabel(interview.interview_type || 'interview')}`,
    `Time: ${interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Pending candidate selection'}`,
    `Location: ${interview.location || 'Not recorded'}`,
    `Meeting Link: ${interview.meeting_link || 'Not recorded'}`,
    scheduleUrl && interview.send_scheduling_link ? `Scheduling Link: ${scheduleUrl}` : '',
    '',
    interview.instructions || ''
  ].filter((line) => line !== '').join('\n');
  const staffBody = [
    `${interview.candidate_name || 'Candidate'} is in the interview workflow.`,
    '',
    `Role: ${interview.role_title || 'Not recorded'}`,
    `Status: ${displayLabel(interview.status || 'scheduled')}`,
    `Type: ${displayLabel(interview.interview_type || 'interview')}`,
    `Time: ${interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Pending candidate selection'}`,
    `Location: ${interview.location || 'Not recorded'}`,
    `Meeting Link: ${interview.meeting_link || 'Not recorded'}`,
    '',
    interview.internal_notes ? `Internal Notes: ${interview.internal_notes}` : ''
  ].filter((line) => line !== '').join('\n');

  if (application && isScheduled && !String(application.status || '').toLowerCase().includes('interview')) {
    application.status = 'interview';
    application.updated_at = now;
  }
  if (employmentApplication && isScheduled && employmentApplication.status !== 'Interview Scheduled') {
    employmentApplication.status = 'Interview Scheduled';
    employmentApplication.updated_at = now;
  }

  upsertInterviewTask({ interview, userId: interview.candidate_user_id, actorId: actor.id, audience: 'candidate', status: taskStatus });
  for (const interviewerId of interview.interviewer_ids || []) {
    upsertInterviewTask({ interview, userId: interviewerId, actorId: actor.id, audience: 'staff', status: taskStatus });
  }

  if (interview.candidate_user_id) {
    sendInterviewMessage({ interview, actorId: actor.id, recipientId: interview.candidate_user_id, subject, body: candidateBody });
  }
  for (const recipientId of [...new Set([interview.created_by, application?.assigned_recruiter_id, ...(interview.interviewer_ids || [])].filter(Boolean))]) {
    sendInterviewMessage({ interview, actorId: actor.id, recipientId, subject, body: staffBody });
  }

  logActivity(actor.id, eventName, {
    interview_id: interview.id,
    status: interview.status,
    application_id: interview.related_application_id || application?.id,
    employment_application_id: interview.related_employment_application_id || employmentApplication?.id,
    scheduled_at: interview.scheduled_at || null
  });
  saveDb();
  pushNotifications(interviewParticipants(interview, actor.id));
  pushNotificationsForAll();
}

function canMoveApplicationStatus(currentStatus, nextStatus, appId, employmentId) {
  const current = String(currentStatus || '').toLowerCase();
  const next = String(nextStatus || '').toLowerCase();
  const leavingInterview = current.includes('interview') && !next.includes('interview') && !['rejected', 'archived'].includes(next);
  if (!leavingInterview) return { ok: true };
  if (interviewCompleteForApplication(appId, employmentId)) return { ok: true };
  return { ok: false, error: 'Complete the interview workspace, including interview status and evaluation scorecard, before advancing this candidate.' };
}

function normalizeJob(rawJob) {
  const title = rawJob.title || 'Untitled Role';
  const slug = slugify(rawJob.slug || title);
  return {
    id: rawJob.id || slug,
    slug,
    title,
    location: rawJob.location || 'Nationwide',
    department: rawJob.department || 'Admin',
    employmentType: rawJob.employmentType || 'Full Time',
    payRange: rawJob.payRange || 'Based on role, experience, and assignment',
    travelRequirement: rawJob.travelRequirement || 'Varies by assignment',
    backgroundRequirement: rawJob.backgroundRequirement || 'Tier 2 public trust investigation required',
    clearanceRequirement: rawJob.clearanceRequirement || 'Tier 2 - Public Trust Position',
    applicationDeadline: rawJob.applicationDeadline || '',
    applicationDeadlineTime: rawJob.applicationDeadlineTime || rawJob.closeTime || '23:59',
    positionsNeeded: Number(rawJob.positionsNeeded || rawJob.headcount || 1),
    internalPositionNumber: rawJob.internalPositionNumber || '',
    assignedRecruiterId: rawJob.assignedRecruiterId || null,
    createdBy: rawJob.createdBy || '',
    createdByName: rawJob.createdByName || '',
    createdAt: rawJob.createdAt || rawJob.postedDate || '',
    modifiedBy: rawJob.modifiedBy || '',
    modifiedByName: rawJob.modifiedByName || '',
    modifiedAt: rawJob.modifiedAt || rawJob.updatedAt || rawJob.postedDate || '',
    reportsTo: rawJob.reportsTo || '',
    supervises: rawJob.supervises || '',
    summary: rawJob.summary || '',
    positionSummary: rawJob.positionSummary || rawJob.summary || '',
    responsibilities: rawJob.responsibilities || [],
    dailyDuties: rawJob.dailyDuties || [],
    weeklyDuties: rawJob.weeklyDuties || [],
    performanceExpectations: rawJob.performanceExpectations || [],
    leadershipResponsibilities: rawJob.leadershipResponsibilities || [],
    administrativeResponsibilities: rawJob.administrativeResponsibilities || [],
    requiredQualifications: rawJob.requiredQualifications || [],
    preferredQualifications: rawJob.preferredQualifications || [],
    education: rawJob.education || [],
    experience: rawJob.experience || [],
    licenses: rawJob.licenses || [],
    certifications: rawJob.certifications || [],
    skills: rawJob.skills || [],
    physicalRequirements: rawJob.physicalRequirements || [],
    benefits: rawJob.benefits || [],
    insurance: rawJob.insurance || [],
    pto: rawJob.pto || [],
    retirement: rawJob.retirement || [],
    training: rawJob.training || [],
    equipment: rawJob.equipment || [],
    otherBenefits: rawJob.otherBenefits || [],
    hiringProcess: rawJob.hiringProcess || ['Application Submitted', 'Application Review', 'Document Verification', 'Interview', 'Background Review', 'Offer', 'Onboarding', 'Hire'],
    postedDate: rawJob.postedDate || new Date().toISOString().slice(0, 10),
    status: rawJob.status || 'open',
    applyUrl: rawJob.applyUrl || `/apply/${slug}`,
    workEnvironment: rawJob.workEnvironment || [],
    settings: {
      publicVisibility: rawJob.settings?.publicVisibility ?? rawJob.status === 'open',
      internalOnly: rawJob.settings?.internalOnly ?? false,
      allowRemoteApplications: rawJob.settings?.allowRemoteApplications ?? true,
      allowContractorApplications: rawJob.settings?.allowContractorApplications ?? false,
      allowResumeUpload: rawJob.settings?.allowResumeUpload ?? true,
      allowCoverLetter: rawJob.settings?.allowCoverLetter ?? false,
      allowAdditionalDocuments: rawJob.settings?.allowAdditionalDocuments ?? true,
      allowCertificationsUpload: rawJob.settings?.allowCertificationsUpload ?? false,
      allowPortfolioUpload: rawJob.settings?.allowPortfolioUpload ?? false,
      automaticClosing: rawJob.settings?.automaticClosing ?? false,
      autoArchivePosition: rawJob.settings?.autoArchivePosition ?? false,
      autoNotifyRecruiter: rawJob.settings?.autoNotifyRecruiter ?? true,
      autoNotifyHiringManager: rawJob.settings?.autoNotifyHiringManager ?? false,
      emailNotifications: rawJob.settings?.emailNotifications ?? true,
      portalNotifications: rawJob.settings?.portalNotifications ?? true,
      recruiterAlerts: rawJob.settings?.recruiterAlerts ?? true,
      managerAlerts: rawJob.settings?.managerAlerts ?? false,
      postingExpirationDate: rawJob.settings?.postingExpirationDate || '',
      positionOpenDate: rawJob.settings?.positionOpenDate || '',
      notificationSettings: rawJob.settings?.notificationSettings || ''
    }
  };
}

function visibleApplications(user) {
  const db = getDb();
  if (['admin', 'hr', 'manager', 'read_only'].includes(user.role)) return db.applications;
  if (user.role === 'recruiter') return db.applications.filter((app) => !app.assigned_recruiter_id || app.assigned_recruiter_id === user.id);
  if (user.role === 'applicant') return db.applications.filter((app) => app.user_id === user.id);
  return [];
}

function employmentApplicationAsPortalApplication(row) {
  const fullName = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    user_id: row.user_id || null,
    company_id: null,
    full_name: fullName || 'Unnamed Applicant',
    email: row.email || '',
    phone: row.phone || '',
    role_applied: row.role_title || '',
    department: row.department || '',
    employment_type: row.employment_type || '',
    experience: '',
    message: '',
    status: row.status || 'New',
    score: row.score ?? null,
    assigned_recruiter_id: row.assigned_recruiter_id || null,
    notification_status: row.notification_status || 'pending',
    notification_error_code: row.notification_error_code || null,
    employment_application_id: row.id,
    confirmation_number: row.confirmation_number || '',
    created_at: row.submitted_at || row.created_at,
    source: 'employment'
  };
}

function visibleEmploymentApplicationSummaries(user) {
  const db = getDb();
  if (['admin', 'recruiter', 'hr', 'manager', 'read_only'].includes(user.role)) {
    return db.employment_applications
      .filter((row) => canReviewEmploymentApplication(user, row))
      .map(employmentApplicationAsPortalApplication);
  }
  if (user.role === 'applicant') {
    return db.employment_applications
      .filter((row) => row.user_id === user.id || String(row.email || '').toLowerCase() === String(user.email || '').toLowerCase())
      .map(employmentApplicationAsPortalApplication);
  }
  return [];
}

function visibleApplicationSummaries(user) {
  const employmentApplications = visibleEmploymentApplicationSummaries(user);
  const visibleEmploymentIds = new Set(employmentApplications.map((app) => app.employment_application_id).filter(Boolean));
  const applications = visibleApplications(user)
    .filter((app) => !app.employment_application_id || !visibleEmploymentIds.has(app.employment_application_id))
    .map((app) => {
      const fullName = app.full_name || [app.first_name, app.last_name].filter(Boolean).join(' ').trim();
      return {
        ...app,
        full_name: fullName || 'Unnamed Applicant',
        role_applied: app.role_applied || app.role || app.position || '',
        source: app.source || 'portal'
      };
    });
  return [...applications, ...employmentApplications]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function visibleContractors(user) {
  const db = getDb();
  if (['admin', 'recruiter', 'hr', 'manager', 'read_only'].includes(user.role)) return db.contractors;
  if (user.role === 'contractor') return db.contractors.filter((row) => row.user_id === user.id);
  return [];
}

function enrichApplication(app) {
  const db = getDb();
  return {
    ...app,
    assigned_recruiter: publicUser(db.users.find((user) => user.id === app.assigned_recruiter_id)),
    company: db.companies.find((company) => company.id === app.company_id) || null
  };
}

function isApplicationActivity(row) {
  const metadata = row.metadata || {};
  return row.entity_type === 'application' ||
    row.entity_type === 'employment_application' ||
    metadata.entity_type === 'application' ||
    metadata.entity_type === 'employment_application' ||
    Boolean(metadata.application_id || metadata.employment_application_id) ||
    metadata.table === 'applications' ||
    ['application_submitted', 'application_created', 'application_deleted', 'application_assigned', 'notification_failed'].includes(row.action);
}

router.get('/admin/dashboard', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only'), (req, res) => {
  const db = getDb();
  const applications = visibleApplicationSummaries(req.user);
  const expiringDocuments = db.documents.filter((doc) => doc.expires_at && new Date(doc.expires_at).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000);
  res.json({
    stats: {
      totalApplicants: db.users.filter((user) => user.role === 'applicant').length,
      activeContractors: db.contractors.filter((row) => row.status === 'active').length,
      pendingReviews: applications.filter((app) => ['submitted', 'received', 'review', 'interview', 'New', 'Under Review', 'Interview Scheduled'].includes(app.status)).length,
      expiringDocuments: expiringDocuments.length,
      activeCompanies: db.companies.filter((company) => company.status === 'active').length
    },
    recentActivity: db.activity_log.filter(isApplicationActivity).slice(-10).reverse()
  });
});

router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ users: getDb().users.map(publicUser) });
});

router.get('/users/directory', requireAuth, (req, res) => {
  const users = getDb().users
    .filter((user) => {
      if (['admin', 'recruiter', 'hr', 'manager', 'read_only'].includes(req.user.role)) return user.status === 'active';
      return user.status === 'active' && ['admin', 'recruiter'].includes(user.role);
    })
    .map(publicUser);
  res.json({ users });
});

router.get('/admin/activity', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ activity: getDb().activity_log.slice().reverse() });
});

router.get('/notifications', requireAuth, (req, res) => {
  res.json({ notifications: notificationCounts(req.user) });
});

router.post('/notifications/seen', requireAuth, (req, res) => {
  const key = String(req.body.key || '');
  if (!['documents', 'tasks', 'applications', 'recruiting', 'interviews'].includes(key)) return res.status(400).json({ error: 'Invalid notification key.' });
  const db = getDb();
  const seen_at = new Date().toISOString();
  let row = db.notification_views.find((item) => item.user_id === req.user.id && item.key === key);
  if (row) row.seen_at = seen_at;
  else row = insert('notification_views', { user_id: req.user.id, key, seen_at });
  saveDb();
  pushNotifications([req.user.id]);
  res.json({ ok: true, seen: row });
});

router.get('/notifications/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  const cleanup = registerNotificationClient(req.user, res);
  req.on('close', cleanup);
});

router.get('/jobs', requireAuth, async (req, res) => {
  const content = await readSiteContent();
  const jobs = (content.opportunities?.jobs || []).map(normalizeJob);
  res.json({
    jobs: ['admin', 'recruiter', 'hr', 'manager', 'read_only'].includes(req.user.role)
      ? jobs
      : jobs.filter((job) => job.status === 'open')
  });
});

router.post('/jobs', requireAuth, requireRole('admin', 'recruiter'), async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid job posting.' });

  const content = await readSiteContent();
  content.opportunities ||= {};
  content.opportunities.jobs ||= [];
  const now = new Date().toISOString();
  const job = normalizeJob({
    ...parsed.data,
    createdBy: req.user.id,
    createdByName: req.user.full_name || req.user.email,
    createdAt: now,
    modifiedBy: req.user.id,
    modifiedByName: req.user.full_name || req.user.email,
    modifiedAt: now
  });
  if (content.opportunities.jobs.some((item) => item.slug === job.slug || item.id === job.id)) {
    return res.status(409).json({ error: 'A job with this slug already exists.' });
  }
  content.opportunities.jobs.push(job);
  await writeSiteContent(content);
  logActivity(req.user.id, 'job_created', { job_id: job.id, title: job.title, status: job.status });
  res.json({ job });
});

router.patch('/jobs/:slug', requireAuth, requireRole('admin', 'recruiter'), async (req, res) => {
  const parsed = jobSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid job update.' });

  const content = await readSiteContent();
  const jobs = content.opportunities?.jobs || [];
  const index = jobs.findIndex((job) => job.slug === req.params.slug || job.id === req.params.slug);
  if (index === -1) return res.status(404).json({ error: 'Job not found.' });

  const current = normalizeJob(jobs[index]);
  const next = normalizeJob({
    ...current,
    ...parsed.data,
    modifiedBy: req.user.id,
    modifiedByName: req.user.full_name || req.user.email,
    modifiedAt: new Date().toISOString()
  });
  const duplicate = jobs.some((job, jobIndex) => jobIndex !== index && (job.slug === next.slug || job.id === next.id));
  if (duplicate) return res.status(409).json({ error: 'A job with this slug already exists.' });

  jobs[index] = next;
  await writeSiteContent(content);
  logActivity(req.user.id, 'job_updated', { job_id: next.id, title: next.title, status: next.status });
  res.json({ job: next });
});

router.delete('/jobs/:slug', requireAuth, requireRole('admin', 'recruiter'), async (req, res) => {
  const content = await readSiteContent();
  const before = content.opportunities?.jobs || [];
  const after = before.filter((job) => job.slug !== req.params.slug && job.id !== req.params.slug);
  if (after.length === before.length) return res.status(404).json({ error: 'Job not found.' });

  content.opportunities.jobs = after;
  await writeSiteContent(content);
  logActivity(req.user.id, 'job_deleted', { job_slug: req.params.slug });
  res.json({ ok: true });
});

// Public, unauthenticated job list for the marketing site's Current
// Opportunities page. Returns only open jobs; the static site enriches these
// with curated descriptions from content/site.json by slug.
router.get('/public/jobs', async (req, res) => {
  const content = await readSiteContent();
  const jobs = (content.opportunities?.jobs || [])
    .map(normalizeJob)
    .filter((job) => job.status === 'open' && job.settings?.internalOnly !== true);
  res.json({ jobs });
});

router.get('/library', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only'), async (req, res) => {
  const content = await readSiteContent();
  const db = getDb();
  res.json({
    jobs: (content.opportunities?.jobs || []).map(normalizeJob),
    employmentApplications: db.employment_applications.slice().sort((a, b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at)),
    portalApplications: visibleApplications(req.user).map(enrichApplication),
    templates: db.library_templates.slice().sort((a, b) => a.title.localeCompare(b.title))
  });
});

router.post('/library/templates', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid template.' });
  const template = insert('library_templates', parsed.data);
  logActivity(req.user.id, 'library_template_created', { template_id: template.id, title: template.title });
  res.json({ template });
});

router.patch('/library/templates/:id', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid template update.' });
  const template = updateById('library_templates', req.params.id, parsed.data);
  if (!template) return res.status(404).json({ error: 'Template not found.' });
  logActivity(req.user.id, 'library_template_updated', { template_id: template.id, title: template.title });
  res.json({ template });
});

router.delete('/library/templates/:id', requireAuth, requireRole('admin', 'recruiter'), (req, res) => {
  const db = getDb();
  const before = db.library_templates.length;
  db.library_templates = db.library_templates.filter((template) => template.id !== req.params.id);
  if (db.library_templates.length === before) return res.status(404).json({ error: 'Template not found.' });
  saveDb();
  logActivity(req.user.id, 'library_template_deleted', { template_id: req.params.id });
  res.json({ ok: true });
});

router.get('/applications', requireAuth, (req, res) => {
  res.json({ applications: visibleApplicationSummaries(req.user).map(enrichApplication) });
});

router.get('/applications/:id', requireAuth, (req, res) => {
  const app = visibleApplications(req.user).find((item) => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const notes = getDb().application_notes.filter((note) => note.application_id === app.id);
  res.json({ application: enrichApplication(app), notes });
});

router.post('/applications', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const parsed = manualApplicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Complete all required applicant fields.' });
  const fullName = `${parsed.data.first_name} ${parsed.data.last_name}`.trim();
  const confirmation = confirmationNumberFor(parsed.data.department, parsed.data.ssn_last4);
  const application = insert('applications', {
    confirmation_number: confirmation,
    user_id: null,
    company_id: null,
    full_name: fullName,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    role_applied: parsed.data.position,
    department: parsed.data.department,
    experience: '',
    message: parsed.data.notes,
    status: 'submitted',
    assigned_recruiter_id: parsed.data.recruiter_id || (req.user.role === 'recruiter' ? req.user.id : null),
    employment_application_id: null,
    created_at: new Date().toISOString()
  });
  logActivity(req.user.id, 'application_created', { application_id: application.id, confirmation_number: confirmation, full_name: fullName });
  pushNotificationsForAll();
  res.json({ application: enrichApplication(application) });
});

router.patch('/applications/:id/status', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const allowed = ['submitted', 'received', 'review', 'interview', 'approved', 'rejected', 'onboarding', 'archived'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const app = visibleApplications(req.user).find((item) => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const gate = canMoveApplicationStatus(app.status, req.body.status, app.id, app.employment_application_id);
  if (!gate.ok) return res.status(409).json({ error: gate.error });
  const previousStatus = app.status;
  app.status = req.body.status;
  logActivity(req.user.id, 'status_change', {
    table: 'applications',
    application_id: app.id,
    entity_type: 'application',
    entity_id: app.id,
    full_name: app.full_name,
    confirmation_number: app.confirmation_number,
    role: app.role_applied,
    previous_status: previousStatus,
    status: app.status
  });
  pushNotificationsForAll();
  res.json({ application: enrichApplication(app) });
});

router.delete('/applications/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const application = db.applications.find((item) => item.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  db.applications = db.applications.filter((item) => item.id !== req.params.id);
  db.application_notes = db.application_notes.filter((note) => note.application_id !== req.params.id);
  db.documents = db.documents.filter((document) => document.application_id !== req.params.id);
  db.tasks = db.tasks.filter((task) => task.related_application_id !== req.params.id);
  saveDb();
  logActivity(req.user.id, 'application_deleted', { application_id: req.params.id });
  pushNotificationsForAll();
  res.json({ ok: true });
});

router.patch('/applications/:id/assign-recruiter', requireAuth, requireRole('admin'), (req, res) => {
  const app = getDb().applications.find((item) => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const previousRecruiterId = app.assigned_recruiter_id || null;
  app.assigned_recruiter_id = req.body.recruiter_id || null;
  logActivity(req.user.id, 'application_assigned', {
    table: 'applications',
    application_id: app.id,
    entity_type: 'application',
    entity_id: app.id,
    full_name: app.full_name,
    confirmation_number: app.confirmation_number,
    role: app.role_applied,
    previous_assigned_recruiter_id: previousRecruiterId,
    assigned_recruiter_id: app.assigned_recruiter_id
  });
  pushNotificationsForAll();
  res.json({ application: enrichApplication(app) });
});

router.get('/applications/:id/notes', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only'), (req, res) => {
  const app = visibleApplications(req.user).find((item) => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json({ notes: getDb().application_notes.filter((note) => note.application_id === app.id) });
});

router.post('/applications/:id/notes', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const schema = z.object({ note: z.string().min(2), visibility: z.enum(['internal', 'admin_only']).default('internal') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid note' });
  const app = visibleApplications(req.user).find((item) => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const note = insert('application_notes', { application_id: app.id, author_id: req.user.id, ...parsed.data });
  logActivity(req.user.id, 'note_added', { application_id: app.id, note_id: note.id });
  pushNotificationsForAll();
  res.json({ note });
});

router.get('/companies', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only', 'contractor'), (req, res) => {
  const db = getDb();
  if (req.user.role === 'contractor') {
    const contractor = db.contractors.find((row) => row.user_id === req.user.id);
    return res.json({ companies: db.companies.filter((company) => company.id === contractor?.company_id) });
  }
  res.json({ companies: db.companies });
});

router.post('/companies', requireAuth, requireRole('admin'), (req, res) => {
  const company = insert('companies', {
    name: req.body.name,
    type: req.body.type || 'other',
    status: req.body.status || 'pending_review',
    point_of_contact: req.body.point_of_contact || '',
    email: req.body.email || '',
    phone: req.body.phone || '',
    address: req.body.address || '',
    notes: req.body.notes || ''
  });
  logActivity(req.user.id, 'company_created', { company_id: company.id });
  pushNotificationsForAll();
  res.json({ company });
});

router.get('/companies/:id', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only', 'contractor'), (req, res) => {
  const company = getDb().companies.find((item) => item.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  if (req.user.role === 'contractor' && !visibleContractors(req.user).some((row) => row.company_id === company.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ company });
});

router.patch('/companies/:id', requireAuth, requireRole('admin'), (req, res) => {
  const company = updateById('companies', req.params.id, req.body);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  logActivity(req.user.id, 'profile_change', { table: 'companies', id: company.id });
  pushNotificationsForAll();
  res.json({ company });
});

router.get('/contractors', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only', 'contractor'), (req, res) => {
  res.json({ contractors: visibleContractors(req.user) });
});

router.post('/contractors', requireAuth, requireRole('admin'), (req, res) => {
  const contractor = insert('contractors', {
    user_id: req.body.user_id,
    company_id: req.body.company_id || null,
    full_name: req.body.full_name,
    role: req.body.role || '',
    phone: req.body.phone || '',
    location: req.body.location || '',
    onboard_date: req.body.onboard_date || null,
    status: req.body.status || 'pending'
  });
  pushNotificationsForAll();
  res.json({ contractor });
});

router.get('/contractors/:id', requireAuth, requireRole('admin', 'recruiter', 'hr', 'manager', 'read_only', 'contractor'), (req, res) => {
  const contractor = visibleContractors(req.user).find((row) => row.id === req.params.id);
  if (!contractor) return res.status(404).json({ error: 'Contractor not found' });
  res.json({ contractor });
});

router.patch('/contractors/:id/status', requireAuth, requireRole('admin'), (req, res) => {
  const contractor = updateById('contractors', req.params.id, { status: req.body.status });
  if (!contractor) return res.status(404).json({ error: 'Contractor not found' });
  if (contractor.status === 'inactive') logActivity(req.user.id, 'contractor_deactivated', { contractor_id: contractor.id });
  else logActivity(req.user.id, 'status_change', { table: 'contractors', id: contractor.id, status: contractor.status });
  pushNotificationsForAll();
  res.json({ contractor });
});

router.get('/documents', requireAuth, (req, res) => {
  const db = getDb();
  let documents = db.documents;
  if (req.user.role === 'contractor' || req.user.role === 'applicant') documents = documents.filter((doc) => doc.owner_user_id === req.user.id);
  res.json({ documents });
});

router.post('/documents/request', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const document = insert('documents', {
    owner_user_id: req.body.owner_user_id,
    contractor_id: req.body.contractor_id || null,
    company_id: req.body.company_id || null,
    application_id: req.body.application_id || null,
    requested_by: req.user.id,
    name: req.body.name,
    type: req.body.type,
    file_path: '',
    status: 'requested',
    expires_at: req.body.expires_at || null
  });
  logActivity(req.user.id, 'document_requested', { document_id: document.id, owner_user_id: document.owner_user_id });
  pushNotifications([document.owner_user_id, req.user.id]);
  res.json({ document });
});

router.patch('/documents/:id/status', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const document = updateById('documents', req.params.id, { status: req.body.status });
  if (!document) return res.status(404).json({ error: 'Document not found' });
  logActivity(req.user.id, 'document_status_change', { document_id: document.id, status: document.status });
  pushNotifications([document.owner_user_id, document.requested_by, req.user.id]);
  res.json({ document });
});

router.get('/interviews', requireAuth, (req, res) => {
  res.json({ interviews: visibleInterviews(req.user).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)) });
});

router.post('/interviews', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const parsed = interviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid interview details.' });
  const token = id().replace(/-/g, '').slice(0, 24);
  const status = parsed.data.send_scheduling_link && !parsed.data.scheduled_at ? 'scheduling_link_sent' : parsed.data.status;
  const interview = insert('interviews', {
    ...parsed.data,
    status,
    schedule_token: token,
    created_by: req.user.id,
    updated_by: req.user.id,
    updated_at: new Date().toISOString()
  });
  syncInterviewWorkflow(interview, req.user, 'interview_scheduled');
  res.json({ interview });
});

router.patch('/interviews/:id', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const interview = visibleInterviews(req.user).find((row) => row.id === req.params.id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  const parsed = interviewSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid interview update.' });
  Object.assign(interview, parsed.data, {
    updated_by: req.user.id,
    updated_at: new Date().toISOString()
  });
  if (parsed.data.send_scheduling_link && !interview.scheduled_at && interview.status === 'draft') {
    interview.status = 'scheduling_link_sent';
  }
  syncInterviewWorkflow(interview, req.user, interview.status === 'cancelled' ? 'interview_cancelled' : interview.status === 'completed' ? 'interview_completed' : 'interview_updated');
  res.json({ interview });
});

router.get('/interviews/schedule/:token', requireAuth, requireRole('applicant'), (req, res) => {
  const interview = getDb().interviews.find((row) => row.schedule_token === req.params.token && row.candidate_user_id === req.user.id);
  if (!interview) return res.status(404).json({ error: 'Interview scheduling link not found.' });
  res.json({ interview });
});

router.patch('/interviews/schedule/:token', requireAuth, requireRole('applicant'), (req, res) => {
  const interview = getDb().interviews.find((row) => row.schedule_token === req.params.token && row.candidate_user_id === req.user.id);
  if (!interview) return res.status(404).json({ error: 'Interview scheduling link not found.' });
  if (!interview.available_slots?.includes(req.body.scheduled_at)) return res.status(400).json({ error: 'Select one of the available interview slots.' });
  interview.scheduled_at = req.body.scheduled_at;
  interview.status = 'candidate_confirmed';
  interview.updated_by = req.user.id;
  interview.updated_at = new Date().toISOString();
  syncInterviewWorkflow(interview, req.user, 'interview_confirmed');
  res.json({ interview });
});

router.get('/tasks', requireAuth, (req, res) => {
  const db = getDb();
  let tasks = db.tasks;
  if (req.user.role === 'contractor' || req.user.role === 'applicant') tasks = tasks.filter((task) => task.assigned_to === req.user.id);
  if (req.user.role === 'recruiter') tasks = tasks.filter((task) => task.assigned_by === req.user.id || task.assigned_to === req.user.id);
  res.json({ tasks });
});

router.post('/tasks', requireAuth, requireRole('admin', 'recruiter', 'hr'), (req, res) => {
  const task = insert('tasks', {
    assigned_to: req.body.assigned_to,
    assigned_by: req.user.id,
    related_application_id: req.body.related_application_id || null,
    related_contractor_id: req.body.related_contractor_id || null,
    title: req.body.title,
    description: req.body.description || '',
    status: 'open',
    due_at: req.body.due_at || null
  });
  logActivity(req.user.id, 'task_created', { task_id: task.id, assigned_to: task.assigned_to });
  pushNotifications([task.assigned_to, req.user.id]);
  res.json({ task });
});

router.patch('/tasks/:id/status', requireAuth, (req, res) => {
  const db = getDb();
  const task = db.tasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!['admin', 'recruiter', 'hr'].includes(req.user.role) && task.assigned_to !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  task.status = req.body.status;
  logActivity(req.user.id, task.status === 'complete' ? 'task_completed' : 'status_change', { task_id: task.id, status: task.status });
  pushNotifications([task.assigned_to, task.assigned_by, req.user.id]);
  res.json({ task });
});

router.get('/messages', requireAuth, (req, res) => {
  const db = getDb();
  let messages = db.messages;
  if (req.user.role !== 'admin') messages = messages.filter((message) => message.sender_id === req.user.id || message.recipient_id === req.user.id);
  res.json({ messages: messages.slice().reverse() });
});

router.post('/messages', requireAuth, (req, res) => {
  const message = insert('messages', {
    sender_id: req.user.id,
    recipient_id: req.body.recipient_id,
    related_application_id: req.body.related_application_id || null,
    related_contractor_id: req.body.related_contractor_id || null,
    subject: req.body.subject || '',
    body: req.body.body,
    read_at: null
  });
  logActivity(req.user.id, 'message_sent', { message_id: message.id, recipient_id: message.recipient_id });
  pushNotifications([message.recipient_id, message.sender_id]);
  res.json({ message });
});

router.patch('/messages/:id/read', requireAuth, (req, res) => {
  const message = getDb().messages.find((item) => item.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.recipient_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  message.read_at = new Date().toISOString();
  saveDb();
  pushNotifications([message.recipient_id, message.sender_id]);
  res.json({ message });
});

router.patch('/messages/read-thread', requireAuth, (req, res) => {
  const schema = z.object({
    sender_id: z.string().min(1),
    subject: z.string().optional().default('')
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid thread' });

  const db = getDb();
  const now = new Date().toISOString();
  let updated = 0;
  for (const message of db.messages) {
    if (
      message.sender_id === parsed.data.sender_id &&
      message.recipient_id === req.user.id &&
      (message.subject || '') === parsed.data.subject &&
      !message.read_at
    ) {
      message.read_at = now;
      updated += 1;
    }
  }
  saveDb();
  pushNotifications([req.user.id]);
  res.json({ ok: true, updated });
});

router.patch('/messages/read-all', requireAuth, (req, res) => {
  const db = getDb();
  let updated = 0;
  for (const message of db.messages) {
    if (message.recipient_id === req.user.id && !message.read_at) {
      message.read_at = new Date().toISOString();
      updated += 1;
    }
  }
  saveDb();
  pushNotifications([req.user.id]);
  res.json({ ok: true, updated });
});

router.get('/activity', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user.role === 'admin') return res.json({ activity: db.activity_log.slice().reverse() });
  const activity = db.activity_log.filter((row) => row.user_id === req.user.id).slice().reverse();
  res.json({ activity });
});

export default router;
