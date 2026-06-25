import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'alpha-employment-failures-'));
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
const { getDb, insert, saveDbNow, setStoreAdapterForTests } = await import('../data/store.js');
const { hashPassword } = await import('../auth.js');
const { setEmailAdapterForTests } = await import('../email.js');
const { setStorageAdapterForTests } = await import('../storage.js');

function resetDb() {
  const db = getDb();
  for (const key of Object.keys(db)) {
    if (Array.isArray(db[key])) db[key] = [];
  }
}

function validPayload(email) {
  return {
    account: { portalAccountCreated: true },
    positionInformation: {
      roleTitle: 'Administrative Specialist',
      department: 'Admin',
      location: 'Atlanta, GA',
      employmentType: 'Full Time',
      desiredStartDate: '2026-07-15',
      desiredPay: '$30/hr'
    },
    personalInformation: {
      fullName: 'Jordan Applicant',
      email,
      phone: '(404) 555-0101',
      ssnLast4: '1234'
    },
    militaryService: { served: 'No' },
    availability: {},
    education: { highestLevel: "Bachelor's Degree", degrees: [] },
    certifications: { selected: [], records: [] },
    languages: [],
    employmentHistory: {
      employers: [{ employer: 'Example Agency', title: 'Coordinator', startDate: '2020-01-01' }]
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
      { name: 'Reference One', phone: '(404) 555-1001' },
      { name: 'Reference Two', phone: '(404) 555-1002' },
      { name: 'Reference Three', phone: '(404) 555-1003' }
    ],
    backgroundAuthorization: {
      fullLegalName: 'Jordan Applicant',
      dateOfBirth: '1990-01-01',
      socialSecurityNumber: '123-45-6789',
      currentAddress: '100 Main St',
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

function cookie(response) {
  const raw = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function json(baseUrl, pathName, { method = 'GET', cookie: requestCookie = '', body } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(requestCookie ? { Cookie: requestCookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { response, body: await response.json().catch(() => ({})), cookie: cookie(response) };
}

async function submit(baseUrl, requestCookie, payload, fileBody = '%PDF-1.4\nresume', options = {}) {
  const form = new FormData();
  form.append('roleSlug', options.roleSlug || 'administrative-specialist');
  form.append('payload', JSON.stringify(payload));
  form.append('resume', new Blob([fileBody], { type: 'application/pdf' }), 'resume.pdf');
  for (const file of options.files || []) {
    form.append(file.field, new Blob([file.body], { type: file.type || 'application/pdf' }), file.name);
  }
  const response = await fetch(`${baseUrl}/api/application/submit`, {
    method: 'POST',
    headers: { Cookie: requestCookie },
    body: form
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function educationAlternativePayload(email, startDate = '2010-01-01', endDate = '2022-01-01') {
  return {
    ...validPayload(email),
    positionInformation: {
      ...validPayload(email).positionInformation,
      roleTitle: 'Program Director',
      desiredStartDate: '2026-07-15',
      desiredPay: '$120000'
    },
    education: {
      highestLevel: 'High School Diploma',
      useExperienceAlternative: true,
      degrees: []
    },
    employmentHistory: {
      employers: [{
        employer: 'Example Agency',
        title: 'Program Lead',
        startDate,
        endDate,
        supervisor: 'Alex Manager',
        phone: '(404) 555-0202',
        reasonForLeaving: 'New opportunity'
      }]
    }
  };
}

async function registerApplicant(baseUrl, email) {
  return json(baseUrl, '/api/auth/register-applicant', {
    method: 'POST',
    body: {
      full_name: 'Jordan Applicant',
      email,
      phone: '(404) 555-0101',
      location: 'GA',
      password: 'applicant-password'
    }
  });
}

async function withServer(t) {
  resetDb();
  const server = app.listen(0);
  t.after(async () => {
    setStoreAdapterForTests(null);
    setStorageAdapterForTests(null);
    setEmailAdapterForTests(null);
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('DB commit failure after stored files cleans storage and leaves no admin record', async (t) => {
  const deleted = [];
  setStorageAdapterForTests({
    storeUploadedFile: async (file, folder) => `supabase://${folder}/${file.originalname || 'application.pdf'}`,
    deleteStoredFile: async (filePath) => deleted.push(filePath)
  });
  setStoreAdapterForTests({
    beforeCommitEmploymentSubmission: async () => {
      throw new Error('simulated db commit failure');
    }
  });
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'db-fail@example.com');
  const result = await submit(baseUrl, applicant.cookie, validPayload('db-fail@example.com'));
  assert.equal(result.response.status, 500);
  assert.equal(getDb().employment_applications.length, 0);
  assert.equal(getDb().employment_application_submissions.length, 0);
  assert.ok(deleted.length >= 1);
});

test('Supabase upload failure mid-submit leaves no rows', async (t) => {
  let uploadCount = 0;
  const deleted = [];
  setStorageAdapterForTests({
    storeUploadedFile: async (file, folder) => {
      uploadCount += 1;
      if (uploadCount === 2) throw new Error('supabase upload failed with service role secret');
      return `supabase://${folder}/${file.originalname || 'application.pdf'}`;
    },
    deleteStoredFile: async (filePath) => deleted.push(filePath)
  });
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'upload-fail@example.com');
  const result = await submit(baseUrl, applicant.cookie, validPayload('upload-fail@example.com'));
  assert.equal(result.response.status, 500);
  assert.equal(getDb().employment_applications.length, 0);
  assert.equal(getDb().employment_application_submissions.length, 0);
  assert.ok(deleted.length >= 1);
});

test('duplicate concurrent submit creates one record and one conflict', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'duplicate@example.com');
  const payload = validPayload('duplicate@example.com');
  const results = await Promise.all([
    submit(baseUrl, applicant.cookie, payload),
    submit(baseUrl, applicant.cookie, payload)
  ]);
  assert.deepEqual(results.map((item) => item.response.status).sort(), [200, 409]);
  assert.equal(getDb().employment_applications.length, 1);
  assert.equal(getDb().employment_application_submissions.length, 1);
});

test('staff email failure keeps admin-visible application with sanitized error code', async (t) => {
  setEmailAdapterForTests(async ({ to }) => {
    if (to === 'hr@example.com') throw new Error('RESEND_API_KEY leaked provider details');
    return { ok: true };
  });
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'email-fail@example.com');
  const result = await submit(baseUrl, applicant.cookie, validPayload('email-fail@example.com'));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.emailed, false);
  assert.equal(getDb().employment_applications.length, 1);
  assert.equal(getDb().employment_applications[0].notification_status, 'failed');
  assert.equal(getDb().employment_applications[0].notification_error_code, 'email_notification_failed');
  assert.equal(getDb().employment_applications[0].notification_error, undefined);
});

test('education alternative requires an uploaded narrative', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'missing-narrative@example.com');
  const result = await submit(baseUrl, applicant.cookie, educationAlternativePayload('missing-narrative@example.com'), '%PDF-1.4\nresume', {
    roleSlug: 'program-director'
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /Education Alternative Experience Narrative upload is required/);
  assert.equal(getDb().employment_applications.length, 0);
});

test('education alternative requires at least ten documented years', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'short-experience@example.com');
  const result = await submit(baseUrl, applicant.cookie, educationAlternativePayload('short-experience@example.com', '2020-01-01', '2025-01-01'), '%PDF-1.4\nresume', {
    roleSlug: 'program-director',
    files: [{ field: 'educationExperienceNarrative', body: '%PDF-1.4\nexperience narrative', name: 'experience-narrative.pdf' }]
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /Education alternative requires at least 10 years/);
  assert.equal(getDb().employment_applications.length, 0);
});

test('education alternative accepts ten plus years with narrative instead of degree upload', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'ten-year-alt@example.com');
  const result = await submit(baseUrl, applicant.cookie, educationAlternativePayload('ten-year-alt@example.com'), '%PDF-1.4\nresume', {
    roleSlug: 'program-director',
    files: [{ field: 'educationExperienceNarrative', body: '%PDF-1.4\nexperience narrative', name: 'experience-narrative.pdf' }]
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const application = getDb().employment_applications[0];
  assert.equal(application.role_slug, 'program-director');
  assert.equal(application.payload.education.useExperienceAlternative, true);
  assert.ok(application.files.some((file) => file.field === 'educationExperienceNarrative'));
  assert.ok(!application.files.some((file) => file.field === 'degree'));
});

test('unauthorized recruiter file access returns 403 and writes denied audit row', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'file-denied@example.com');
  const result = await submit(baseUrl, applicant.cookie, validPayload('file-denied@example.com'));
  assert.equal(result.response.status, 200);
  const appRow = getDb().employment_applications[0];
  const file = appRow.files[0];
  insert('users', {
    email: 'recruiter@example.com',
    password_hash: await hashPassword('recruiter-password'),
    role: 'recruiter',
    full_name: 'Recruiter',
    status: 'active'
  });
  await saveDbNow();
  const login = await json(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'recruiter@example.com', password: 'recruiter-password' }
  });
  const denied = await fetch(`${baseUrl}/api/admin/employment-applications/${appRow.id}/files/${file.id}/view`, {
    headers: { Cookie: login.cookie }
  });
  assert.equal(denied.status, 403);
  assert.ok(getDb().activity_log.some((row) => row.action === 'file_access_denied' && row.metadata.file_id === file.id));
});

test('file responses include private no-store headers', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'headers@example.com');
  await submit(baseUrl, applicant.cookie, validPayload('headers@example.com'));
  const appRow = getDb().employment_applications[0];
  const file = appRow.files[0];
  insert('users', {
    email: 'admin@example.com',
    password_hash: await hashPassword('admin-password'),
    role: 'admin',
    full_name: 'Admin',
    status: 'active'
  });
  await saveDbNow();
  const login = await json(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'admin-password' }
  });
  const response = await fetch(`${baseUrl}/api/admin/employment-applications/${appRow.id}/files/${file.id}/download`, {
    headers: { Cookie: login.cookie }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private, max-age=0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('oversized request is rejected before DB or storage writes', async (t) => {
  const baseUrl = await withServer(t);
  const applicant = await registerApplicant(baseUrl, 'oversized@example.com');
  const result = await submit(baseUrl, applicant.cookie, validPayload('oversized@example.com'), 'x'.repeat(20 * 1024 * 1024));
  assert.equal(result.response.status, 413);
  assert.equal(getDb().employment_applications.length, 0);
});

test.after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});
