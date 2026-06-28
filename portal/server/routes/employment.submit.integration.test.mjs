import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alpha-employment-flow-'));
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.PORTAL_DATA_FILE = path.join(tempRoot, 'dev-db.json');
process.env.PORTAL_UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.PORTAL_STORAGE_DRIVER = 'local';
process.env.EMAIL_DRIVER = 'log';
process.env.PUBLIC_PORTAL_URL = 'http://127.0.0.1:4180';
process.env.APPLICATION_EMAIL_TO = 'hr@example.com';
process.env.APPLICATION_EMAIL_CC = 'ops@example.com';

const { default: app } = await import('../app.js');
const { getDb, insert, saveDbNow } = await import('../data/store.js');
const { hashPassword } = await import('../auth.js');

function validPayload(email = 'jordan.applicant@example.com') {
  return {
    account: { portalAccountCreated: true },
    positionInformation: {
      roleTitle: 'Administrative Specialist',
      department: 'Admin',
      location: 'Atlanta, GA',
      employmentType: 'Full Time',
      desiredStartDate: '2026-07-15',
      desiredPay: '$30/hr',
      heardAboutUs: 'Alpha Recovery website'
    },
    personalInformation: {
      fullName: 'Jordan Applicant',
      email,
      phone: '(404) 555-0101',
      ssnLast4: '1234',
      address: '100 Main St',
      city: 'Atlanta',
      state: 'GA',
      zip: '30301'
    },
    workAuthorization: {},
    availability: {},
    militaryService: { served: 'No' },
    education: {
      highestLevel: "Bachelor's Degree",
      degrees: []
    },
    certifications: { selected: [], records: [] },
    languages: [],
    employmentHistory: {
      employers: [{
        employer: 'Example Agency',
        title: 'Operations Coordinator',
        startDate: '2020-01-01',
        endDate: '2025-01-01',
        supervisor: 'Alex Manager',
        phone: '(404) 555-0202',
        reasonForLeaving: 'New opportunity'
      }]
    },
    governmentEligibility: {},
    criminalHistory: {
      felonyConviction: 'No',
      misdemeanorConviction: 'No',
      pendingCharges: 'No',
      deferredAdjudication: 'No',
      militaryCourtMartial: 'No',
      registryRequired: 'No',
      offenses: [],
      acknowledgment: true
    },
    drivingRecord: {},
    references: [
      { name: 'Reference One', phone: '(404) 555-1001', relationship: 'Supervisor' },
      { name: 'Reference Two', phone: '(404) 555-1002', relationship: 'Peer' },
      { name: 'Reference Three', phone: '(404) 555-1003', relationship: 'Client' }
    ],
    backgroundAuthorization: {
      fullLegalName: 'Jordan Applicant',
      dateOfBirth: '1990-01-01',
      socialSecurityNumber: '123-45-6789',
      currentAddress: '100 Main St, Atlanta, GA 30301',
      positionAppliedFor: 'Administrative Specialist',
      typedSignature: 'Jordan Applicant',
      signatureDate: '2026-06-21',
      printedName: 'Jordan Applicant'
    },
    signatures: {
      backgroundAuthorization: 'Jordan Applicant',
      standardsOfConduct: 'Jordan Applicant',
      applicantCertification: 'Jordan Applicant'
    },
    applicantCertification: {
      typedFullLegalName: 'Jordan Applicant',
      date: '2026-06-21'
    },
    uploads: {}
  };
}

function getCookie(response) {
  const cookies = response.headers.getSetCookie?.() || [];
  const raw = cookies[0] || response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function jsonRequest(baseUrl, pathName, { method = 'GET', cookie = '', body } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, cookie: getCookie(response) };
}

async function submitApplication(baseUrl, cookie, payload) {
  const form = new FormData();
  form.append('roleSlug', 'administrative-specialist');
  form.append('payload', JSON.stringify(payload));
  form.append('resume', new Blob(['%PDF-1.4\n% test resume\n'], { type: 'application/pdf' }), 'resume.pdf');
  const response = await fetch(`${baseUrl}/api/application/submit`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test('applicant submission creates a durable admin-visible application before email notification', async (t) => {
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  await insert('users', {
    email: 'admin@example.com',
    password_hash: await hashPassword('admin-password'),
    role: 'admin',
    full_name: 'Alpha Admin',
    status: 'active',
    force_password_change: false
  });
  await saveDbNow();

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const applicant = await jsonRequest(baseUrl, '/api/auth/register-applicant', {
    method: 'POST',
    body: {
      full_name: 'Jordan Applicant',
      email: 'jordan.applicant@example.com',
      phone: '(404) 555-0101',
      location: 'GA',
      password: 'applicant-password'
    }
  });
  assert.equal(applicant.response.status, 200);
  assert.match(applicant.cookie, /^alpha_session=/);

  const payload = validPayload();
  const draft = await jsonRequest(baseUrl, '/api/application/draft', {
    method: 'POST',
    cookie: applicant.cookie,
    body: { roleSlug: 'administrative-specialist', section: 8, payload }
  });
  assert.equal(draft.response.status, 200);

  const submission = await submitApplication(baseUrl, applicant.cookie, payload);
  assert.equal(submission.response.status, 200, JSON.stringify(submission.body));
  assert.equal(submission.body.submitted, true);
  assert.equal(submission.body.emailed, true);
  assert.match(submission.body.confirmation, /^AD-2026-01234-[A-F0-9]{6}$/);
  assert.ok(submission.body.applicationId);

  const db = getDb();
  assert.equal(db.employment_application_drafts.length, 0);
  assert.equal(db.applications.length, 1);
  assert.equal(db.employment_applications.length, 0);
  assert.equal(db.employment_application_submissions.length, 1);

  const application = db.applications[0];
  assert.equal(application.id, submission.body.applicationId);
  assert.equal(application.email, 'jordan.applicant@example.com');
  assert.equal(application.role_slug, 'administrative-specialist');
  assert.equal(application.status, 'submitted');
  assert.equal(application.notification_status, 'sent');
  assert.equal(application.files.length, 2);
  assert.ok(application.files.some((file) => file.field === 'applicationPdf' && file.mimeType === 'application/pdf'));
  assert.ok(application.files.some((file) => file.field === 'resume' && file.originalName === 'resume.pdf'));

  const submissionAudit = db.employment_application_submissions[0];
  assert.equal(submissionAudit.employment_application_id, application.id);
  assert.equal(submissionAudit.delivery, 'portal');
  assert.equal(submissionAudit.email_to, 'hr@example.com');
  assert.equal(submissionAudit.email_status, 'sent');

  const adminLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin-password' }
  });
  assert.equal(adminLogin.response.status, 200);

  const adminList = await jsonRequest(baseUrl, '/api/admin/employment-applications', {
    cookie: adminLogin.cookie
  });
  assert.equal(adminList.response.status, 200);
  assert.equal(adminList.payload.applications.length, 1);
  assert.equal(adminList.payload.applications[0].id, application.id);
  assert.equal(adminList.payload.applications[0].files.length, 2);

  const adminSummary = await jsonRequest(baseUrl, '/api/applications', {
    cookie: adminLogin.cookie
  });
  assert.equal(adminSummary.response.status, 200);
  assert.equal(adminSummary.payload.applications.length, 1);
  assert.equal(adminSummary.payload.applications[0].source, 'portal');
  assert.equal(adminSummary.payload.applications[0].id, application.id);

  const applicantSummary = await jsonRequest(baseUrl, '/api/applications', {
    cookie: applicant.cookie
  });
  assert.equal(applicantSummary.response.status, 200);
  assert.equal(applicantSummary.payload.applications.length, 1);
  assert.equal(applicantSummary.payload.applications[0].source, 'portal');
  assert.equal(applicantSummary.payload.applications[0].id, application.id);

  await insert('users', {
    email: 'restricted-recruiter@example.com',
    password_hash: await hashPassword('recruiter-password'),
    role: 'recruiter',
    full_name: 'Restricted Recruiter',
    status: 'active',
    force_password_change: false
  });
  await saveDbNow();

  const recruiterLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'restricted-recruiter@example.com', password: 'recruiter-password' }
  });
  assert.equal(recruiterLogin.response.status, 200);

  const recruiterLibrary = await jsonRequest(baseUrl, '/api/library', {
    cookie: recruiterLogin.cookie
  });
  assert.equal(recruiterLibrary.response.status, 200);
  assert.equal(Object.hasOwn(recruiterLibrary.payload, 'employmentApplications'), false);
  assert.equal(Object.hasOwn(recruiterLibrary.payload, 'portalApplications'), false);
  assert.ok(recruiterLibrary.payload.applicationConfig);
  assert.ok(Array.isArray(recruiterLibrary.payload.applicationConfig.roles));
});
