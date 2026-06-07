import { getDb } from './data/store.js';

const clients = new Map();

function visibleApplications(user) {
  const db = getDb();
  if (user.role === 'admin') return db.applications;
  if (user.role === 'recruiter') return db.applications.filter((app) => !app.assigned_recruiter_id || app.assigned_recruiter_id === user.id);
  if (user.role === 'applicant') return db.applications.filter((app) => app.user_id === user.id);
  return [];
}

function seenAt(user, key) {
  const row = getDb().notification_views.find((item) => item.user_id === user.id && item.key === key);
  return row ? new Date(row.seen_at).getTime() : 0;
}

function isAfterSeen(row, timestamp) {
  const value = new Date(row.updated_at || row.created_at || row.submitted_at || 0).getTime();
  return value > timestamp;
}

export function notificationCounts(user) {
  const db = getDb();
  const messages = db.messages.filter((message) => message.recipient_id === user.id && !message.read_at).length;
  const documentsSeenAt = seenAt(user, 'documents');
  const tasksSeenAt = seenAt(user, 'tasks');
  const applicationsSeenAt = seenAt(user, 'applications');
  const recruitingSeenAt = seenAt(user, 'recruiting');
  const interviewsSeenAt = seenAt(user, 'interviews');
  const staffApplicationSeenAt = Math.max(applicationsSeenAt, recruitingSeenAt);
  const documents = db.documents.filter((doc) => doc.owner_user_id === user.id && ['requested', 'pending', 'rejected', 'expired'].includes(doc.status) && isAfterSeen(doc, documentsSeenAt)).length;
  const tasks = db.tasks.filter((task) => task.assigned_to === user.id && ['open', 'in_progress', 'blocked'].includes(task.status) && isAfterSeen(task, tasksSeenAt)).length;
  const interviews = db.interviews.filter((interview) => {
    const application = interview.related_application_id
      ? db.applications.find((row) => row.id === interview.related_application_id)
      : db.applications.find((row) => row.employment_application_id && row.employment_application_id === interview.related_employment_application_id);
    const involved = interview.candidate_user_id === user.id ||
      interview.created_by === user.id ||
      interview.updated_by === user.id ||
      application?.assigned_recruiter_id === user.id ||
      interview.interviewer_ids?.includes(user.id);
    return involved && ['scheduling_link_sent', 'scheduled', 'candidate_confirmed', 'rescheduled', 'cancelled', 'completed'].includes(interview.status) && isAfterSeen(interview, interviewsSeenAt);
  }).length;
  const applications = ['admin', 'recruiter'].includes(user.role)
    ? visibleApplications(user).filter((app) => ['submitted', 'received', 'review', 'interview'].includes(app.status) && isAfterSeen(app, staffApplicationSeenAt)).length
    : visibleApplications(user).filter((app) => ['submitted', 'received', 'review', 'interview', 'onboarding'].includes(app.status) && isAfterSeen(app, applicationsSeenAt)).length;

  return {
    messages,
    documents,
    tasks,
    interviews,
    applications,
    recruiting: applications
  };
}

function sendClient(client, event, payload) {
  client.res.write(`event: ${event}\n`);
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerNotificationClient(user, res) {
  const client = { user, res };
  const userClients = clients.get(user.id) || new Set();
  userClients.add(client);
  clients.set(user.id, userClients);

  sendClient(client, 'notifications', notificationCounts(user));
  const keepAlive = setInterval(() => sendClient(client, 'ping', { ok: true }), 25000);

  return () => {
    clearInterval(keepAlive);
    userClients.delete(client);
    if (!userClients.size) clients.delete(user.id);
  };
}

export function pushNotifications(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueIds) {
    const userClients = clients.get(userId);
    if (!userClients) continue;
    for (const client of userClients) {
      sendClient(client, 'notifications', notificationCounts(client.user));
    }
  }
}

export function pushNotificationsForAll() {
  pushNotifications([...clients.keys()]);
}
