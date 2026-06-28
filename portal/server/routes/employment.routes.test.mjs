import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.EMAIL_DRIVER = 'log';

const {
  employmentApplicationRecord,
  employmentSubmissionRecord
} = await import('./employment.routes.js');

const role = {
  slug: 'case-manager',
  title: 'Case Manager',
  department: 'Field Operations',
  location: 'Nationwide',
  employmentType: 'Contract / Full Time'
};

const user = {
  id: 'user-1',
  email: 'applicant@example.com'
};

const payload = {
  personalInformation: {
    fullName: 'Jordan Applicant',
    email: 'applicant@example.com',
    phone: '(404) 555-0101'
  },
  account: { portalAccountCreated: true }
};

test('employmentApplicationRecord creates the admin-facing source-of-truth row', () => {
  const files = [{
    id: 'file-1',
    field: 'resume',
    label: 'Resume',
    originalName: 'resume.pdf',
    path: '/tmp/resume.pdf'
  }];

  const record = employmentApplicationRecord({
    applicationId: 'application-1',
    user,
    role,
    payload,
    confirmation: 'FO-2026-01234-ABCDEF',
    files,
    submittedAt: '2026-06-21T12:00:00.000Z'
  });

  assert.equal(record.id, 'application-1');
  assert.equal(record.user_id, user.id);
  assert.equal(record.confirmation_number, 'FO-2026-01234-ABCDEF');
  assert.equal(record.status, 'submitted');
  assert.equal(record.role_applied, role.title);
  assert.equal(record.employment_type, role.employmentType);
  assert.equal(record.full_name, payload.personalInformation.fullName);
  assert.equal(record.phone, payload.personalInformation.phone);
  assert.equal(record.payload, payload);
  assert.deepEqual(record.files, files);
});

test('employmentSubmissionRecord keeps a portal delivery audit linked to the application', () => {
  const uploads = [{
    field: 'resume',
    label: 'Resume',
    file: {
      originalname: 'resume.pdf',
      size: 1234,
      mimetype: 'application/pdf'
    }
  }];

  const record = employmentSubmissionRecord({
    user,
    role,
    payload,
    confirmation: 'FO-2026-01234-ABCDEF',
    uploads,
    applicationId: 'application-1',
    submittedAt: '2026-06-21T12:00:00.000Z',
    emailTo: 'hr@example.com',
    emailCc: 'ops@example.com'
  });

  assert.equal(record.delivery, 'portal');
  assert.equal(record.application_id, 'application-1');
  assert.equal(record.employment_application_id, 'application-1');
  assert.equal(record.email_status, 'pending');
  assert.equal(record.email_to, 'hr@example.com');
  assert.equal(record.email_cc, 'ops@example.com');
  assert.deepEqual(record.uploaded_files, [{
    field: 'resume',
    label: 'Resume',
    original_name: 'resume.pdf',
    size: 1234,
    mime_type: 'application/pdf'
  }]);
});
