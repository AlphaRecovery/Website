export const ROLES = ['admin', 'recruiter', 'hr', 'manager', 'read_only', 'contractor', 'applicant'];

export const APPLICATION_STATUSES = ['submitted', 'received', 'review', 'interview', 'approved', 'hired', 'rejected', 'onboarding', 'archived'];
export const COMPANY_TYPES = ['individual', 'private investigation firm', 'security company', 'social service organization', 'interpreter organization', 'other'];
export const COMPANY_STATUSES = ['active', 'inactive', 'pending_review'];
export const CONTRACTOR_STATUSES = ['pending', 'active', 'inactive', 'suspended'];
export const DOCUMENT_TYPES = ['resume', 'w9', 'nda', 'training_certificate', 'license', 'insurance', 'background_check', 'id', 'other'];
export const DOCUMENT_STATUSES = ['requested', 'pending', 'uploaded', 'signed', 'cleared', 'rejected', 'expired'];
export const TASK_STATUSES = ['open', 'in_progress', 'complete', 'blocked'];

export const ACTIVITY_ACTIONS = [
  'login',
  'logout',
  'failed_login',
  'file_upload',
  'file_view',
  'file_download',
  'file_access_denied',
  'status_change',
  'invite_sent',
  'invite_accepted',
  'profile_change',
  'document_requested',
  'document_status_change',
  'application_created',
  'application_deleted',
  'application_submitted',
  'application_assigned',
  'notification_failed',
  'pii_purged',
  'file_delete_missing',
  'task_created',
  'task_completed',
  'message_sent',
  'note_added',
  'company_created',
  'contractor_deactivated'
];

export const DISPLAY_LABELS = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  hr: 'HR',
  manager: 'Manager',
  read_only: 'Read-only',
  contractor: 'Contractor',
  applicant: 'Applicant',
  submitted: 'Submitted',
  received: 'Received',
  review: 'Under Review',
  interview: 'Interview',
  approved: 'Approved',
  hired: 'Hired',
  rejected: 'Rejected',
  onboarding: 'Onboarding',
  archived: 'Archived',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  suspended: 'Suspended',
  pending_review: 'Pending Review',
  individual: 'Individual',
  'private investigation firm': 'Private Investigation Firm',
  'security company': 'Security Company',
  'social service organization': 'Social Service Organization',
  'interpreter organization': 'Interpreter Organization',
  other: 'Other',
  resume: 'Resume',
  w9: 'W9',
  nda: 'NDA',
  training_certificate: 'Training Certificate',
  license: 'License',
  insurance: 'Insurance',
  background_check: 'Background Check',
  id: 'ID',
  requested: 'Requested',
  uploaded: 'Uploaded',
  signed: 'Signed',
  cleared: 'Cleared',
  expired: 'Expired',
  open: 'Open',
  in_progress: 'In Progress',
  complete: 'Complete',
  blocked: 'Blocked',
  login: 'Login',
  logout: 'Logout',
  failed_login: 'Failed Login',
  file_upload: 'File Upload',
  file_view: 'File View',
  file_download: 'File Download',
  file_access_denied: 'File Access Denied',
  status_change: 'Status Change',
  invite_sent: 'Invite Sent',
  invite_accepted: 'Invite Accepted',
  profile_change: 'Profile Change',
  document_requested: 'Document Requested',
  document_status_change: 'Document Status Change',
  application_created: 'Application Created',
  application_deleted: 'Application Deleted',
  application_submitted: 'Application Submitted',
  application_assigned: 'Application Assigned',
  notification_failed: 'Notification Failed',
  pii_purged: 'PII Purged',
  file_delete_missing: 'File Delete Missing',
  task_created: 'Task Created',
  task_completed: 'Task Completed',
  message_sent: 'Message Sent',
  note_added: 'Note Added',
  company_created: 'Company Created',
  contractor_deactivated: 'Contractor Deactivated'
};

export function displayLabel(value) {
  if (!value) return '';
  return DISPLAY_LABELS[value] || String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
