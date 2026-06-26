import { config } from './config.js';
import { getDb, id, now, saveDb } from './data/store.js';
import { sendEmail, portalUrl } from './email.js';

const ACTIVE_APPLICATION_STATUSES = new Set([
  'new',
  'submitted',
  'received',
  'review',
  'under review',
  'screening',
  'interview',
  'interview scheduled',
  'offer',
  'offer extended',
  'onboarding',
  'hired'
]);

function ageMs(value, fallback = 0) {
  const time = new Date(value || fallback).getTime();
  return Number.isFinite(time) ? Date.now() - time : 0;
}

function cutoffMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function warningMs() {
  return config.retentionWarningHours * 60 * 60 * 1000;
}

function normalizeEmail(value = '') {
  return String(value || '').toLowerCase();
}

function logSystemActivity(action, metadata = {}) {
  getDb().activity_log.push({
    id: id(),
    user_id: null,
    actor_user_id: null,
    action,
    entity_type: metadata.entity_type || null,
    entity_id: metadata.entity_id || metadata.employment_application_id || metadata.draft_id || metadata.user_id || null,
    metadata,
    created_at: now()
  });
}

function activeApplicationForUser(user, db = getDb()) {
  const email = normalizeEmail(user.email);
  return [...(db.employment_applications || []), ...(db.applications || [])].some((application) => {
    const owns = application.user_id === user.id || normalizeEmail(application.email) === email;
    if (!owns) return false;
    return ACTIVE_APPLICATION_STATUSES.has(String(application.status || '').toLowerCase());
  });
}

function draftForUser(user, db = getDb()) {
  const email = normalizeEmail(user.email);
  return (db.employment_application_drafts || []).some((draft) => (
    draft.user_id === user.id || normalizeEmail(draft.email) === email
  ));
}

function isProtectedUser(user, db = getDb()) {
  if (!user || user.role !== 'applicant') return true;
  if (activeApplicationForUser(user, db)) return true;
  if (draftForUser(user, db)) return true;
  return false;
}

async function sendRetentionWarning({ user, subject, body, execute }) {
  if (!execute || !user?.email) return;
  await sendEmail({
    to: user.email,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, '<br>')}</p>`
  }).catch((error) => {
    console.error('Retention warning email failed:', error);
  });
}

export async function runRetentionCleanup({ execute = false } = {}) {
  const db = getDb();
  const currentIso = now();
  const draftDeleteAge = cutoffMs(config.draftRetentionDays);
  const accountDeleteAge = cutoffMs(config.applicantInactiveRetentionDays);
  const summary = {
    execute,
    draftWarnings: 0,
    draftsDeleted: 0,
    accountWarnings: 0,
    accountsDeleted: 0,
    skippedProtectedUsers: 0
  };

  for (const draft of [...(db.employment_application_drafts || [])]) {
    const draftAge = ageMs(draft.updated_at || draft.created_at);
    const warningSentAt = draft.retention_warning_sent_at;
    const user = db.users.find((item) => item.id === draft.user_id || normalizeEmail(item.email) === normalizeEmail(draft.email));
    const shouldWarn = draftAge >= Math.max(0, draftDeleteAge - warningMs()) && !warningSentAt;
    const canDelete = draftAge >= draftDeleteAge && warningSentAt && ageMs(warningSentAt) >= warningMs();
    if (shouldWarn) {
      summary.draftWarnings += 1;
      if (execute) {
        draft.retention_warning_sent_at = currentIso;
        await sendRetentionWarning({
          user,
          subject: 'Alpha Recovery draft application deletion warning',
          body: `Your saved Alpha Recovery draft application for ${draft.role_title || 'an Alpha Recovery role'} will be deleted in approximately 48 hours unless you sign in and continue the application.\n\nPortal: ${portalUrl('/login')}`,
          execute
        });
        logSystemActivity('retention_warning_sent', {
          entity_type: 'application_draft',
          draft_id: draft.id,
          user_id: user?.id || draft.user_id || null,
          role_slug: draft.role_slug,
          warning_type: 'draft'
        });
      }
      continue;
    }
    if (canDelete) {
      summary.draftsDeleted += 1;
      if (execute) {
        db.employment_application_drafts = db.employment_application_drafts.filter((item) => item.id !== draft.id);
        logSystemActivity('draft_auto_deleted', {
          entity_type: 'application_draft',
          draft_id: draft.id,
          user_id: user?.id || draft.user_id || null,
          role_slug: draft.role_slug
        });
      }
    }
  }

  for (const user of [...(db.users || [])]) {
    if (user.role !== 'applicant') continue;
    if (isProtectedUser(user, db)) {
      summary.skippedProtectedUsers += 1;
      continue;
    }
    const lastActive = user.last_active_at || user.updated_at || user.created_at;
    const accountAge = ageMs(lastActive);
    const warningSentAt = user.retention_warning_sent_at;
    const shouldWarn = accountAge >= Math.max(0, accountDeleteAge - warningMs()) && !warningSentAt;
    const canDelete = accountAge >= accountDeleteAge && warningSentAt && ageMs(warningSentAt) >= warningMs();
    if (shouldWarn) {
      summary.accountWarnings += 1;
      if (execute) {
        user.retention_warning_sent_at = currentIso;
        await sendRetentionWarning({
          user,
          subject: 'Alpha Recovery account deletion warning',
          body: `Your Alpha Recovery applicant account is inactive and will be deleted in approximately 48 hours unless you sign in.\n\nPortal: ${portalUrl('/login')}`,
          execute
        });
        logSystemActivity('retention_warning_sent', {
          entity_type: 'user',
          user_id: user.id,
          warning_type: 'applicant_account'
        });
      }
      continue;
    }
    if (canDelete) {
      summary.accountsDeleted += 1;
      if (execute) {
        db.users = db.users.filter((item) => item.id !== user.id);
        db.sessions = db.sessions.filter((session) => session.user_id !== user.id);
        logSystemActivity('applicant_account_auto_deleted', {
          entity_type: 'user',
          user_id: user.id,
          email: user.email
        });
      }
    }
  }

  if (execute) saveDb();
  return summary;
}
