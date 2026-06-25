import { config } from './config.js';

export function canReviewEmploymentApplication(user, application) {
  if (!user || !application) return false;
  if (user.role === 'admin') return true;
  if (['hr', 'manager', 'read_only'].includes(user.role)) return true;
  if (user.role === 'recruiter') {
    if (config.recruiterCanViewAllApplications) return true;
    return application.assigned_recruiter_id === user.id;
  }
  if (user.role === 'applicant') {
    return application.user_id === user.id || String(application.email || '').toLowerCase() === String(user.email || '').toLowerCase();
  }
  return false;
}

export function canManageEmploymentApplication(user, application) {
  if (!user || !application) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'hr') return true;
  if (user.role === 'recruiter') return canReviewEmploymentApplication(user, application);
  return false;
}

export function canAssignEmploymentApplication(user) {
  return user?.role === 'admin';
}

export function canRunRetentionActions(user) {
  return user?.role === 'admin';
}
