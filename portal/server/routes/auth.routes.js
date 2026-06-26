import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDb, insert, now, saveDb } from '../data/store.js';
import { clearSession, createSession, hashPassword, hashToken, logActivity, publicUser, verifyPassword } from '../auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { portalUrl, sendEmail } from '../email.js';
import { ROLES } from '../../shared/constants.js';
import { publicErrorMessage } from '../security.js';

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;
const INTERNAL_ROLES = ROLES.filter((role) => role !== 'applicant');

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : ''
  };
}

function staffRoleOptions(actor) {
  if (actor.role === 'admin') return INTERNAL_ROLES;
  if (actor.role === 'manager') return INTERNAL_ROLES.filter((role) => role !== 'admin');
  return [];
}

function canManageUserAccess(actor, target, nextRole = target?.role) {
  if (!actor || !target) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'manager') return false;
  if (target.role === 'admin' || nextRole === 'admin') return false;
  return INTERNAL_ROLES.includes(target.role) && INTERNAL_ROLES.includes(nextRole);
}

function activeAdminCount() {
  return getDb().users.filter((user) => user.role === 'admin' && user.status === 'active').length;
}

function profilePayload(user) {
  return {
    ...publicUser(user),
    ...splitName(user.full_name),
    notification_preferences: user.notification_preferences || {
      email_application_updates: true,
      email_document_requests: true,
      email_messages: true,
      portal_notifications: true
    }
  };
}

router.get('/me', (req, res) => {
  const user = req.user || null;
  res.json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid login payload' });

  const email = parsed.data.email.toLowerCase();
  const user = getDb().users.find((item) => item.email.toLowerCase() === email);
  const ok = await verifyPassword(user, parsed.data.password);
  if (!ok) {
    logActivity(user?.id || null, 'failed_login', { email });
    return res.status(401).json({ error: 'Access denied or credentials invalid' });
  }

  user.last_active_at = now();
  user.updated_at = now();
  saveDb();
  await createSession(user, req, res);
  logActivity(user.id, 'login', { role: user.role });
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid password change payload' });

  const ok = await verifyPassword(req.user, parsed.data.currentPassword);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

  req.user.password_hash = await hashPassword(parsed.data.newPassword);
  req.user.force_password_change = false;
  req.user.updated_at = now();
  saveDb();
  logActivity(req.user.id, 'profile_change', { action: 'password_changed' });
  res.json({ user: publicUser(req.user) });
});

router.get('/profile', requireAuth, (req, res) => {
  res.json({ profile: profilePayload(req.user) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const schema = z.object({
    phone: z.string().trim().max(40).optional(),
    location: z.string().trim().max(160).optional(),
    notification_preferences: z.object({
      email_application_updates: z.boolean().optional(),
      email_document_requests: z.boolean().optional(),
      email_messages: z.boolean().optional(),
      portal_notifications: z.boolean().optional()
    }).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile update.' });
  if (Object.prototype.hasOwnProperty.call(req.body, 'full_name') || Object.prototype.hasOwnProperty.call(req.body, 'first_name') || Object.prototype.hasOwnProperty.call(req.body, 'last_name')) {
    return res.status(400).json({ error: 'First and last name are locked. Contact Admin for legal name corrections.' });
  }
  if (parsed.data.phone !== undefined) req.user.phone = parsed.data.phone;
  if (parsed.data.location !== undefined) req.user.location = parsed.data.location;
  if (parsed.data.notification_preferences) {
    req.user.notification_preferences = {
      ...(req.user.notification_preferences || {}),
      ...parsed.data.notification_preferences
    };
  }
  req.user.updated_at = now();
  saveDb();
  logActivity(req.user.id, 'profile_change', { action: 'profile_settings_updated' });
  res.json({ profile: profilePayload(req.user), user: publicUser(req.user) });
});

router.post('/profile/email-change', requireAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    currentPassword: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid new email and current password.' });
  const ok = await verifyPassword(req.user, parsed.data.currentPassword);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  const email = parsed.data.email.toLowerCase();
  if (email === req.user.email.toLowerCase()) return res.status(400).json({ error: 'Enter a different email address.' });
  if (getDb().users.some((user) => user.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account already exists for this email.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  req.user.pending_email = email;
  insert('email_change_tokens', {
    user_id: req.user.id,
    email,
    token_hash: hashToken(token),
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  req.user.updated_at = now();
  saveDb();
  logActivity(req.user.id, 'profile_change', { action: 'email_change_requested' });
  await sendEmail({
    to: email,
    subject: 'Confirm your Alpha Recovery portal email',
    text: `Confirm your new Alpha Recovery portal email:\n\n${portalUrl(`/confirm-email-change?token=${token}`)}\n\nThis link expires in 24 hours.`,
    html: `<p>Confirm your new Alpha Recovery portal email:</p><p><a href="${portalUrl(`/confirm-email-change?token=${token}`)}">Confirm email change</a></p><p>This link expires in 24 hours.</p>`
  }).catch((error) => console.error('Email change confirmation failed:', error));
  res.json({ ok: true, pending_email: email, ...(process.env.NODE_ENV === 'production' ? {} : { dev_email_change_token: token }) });
});

router.post('/profile/email-change/confirm', async (req, res) => {
  const schema = z.object({ token: z.string().min(20) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid confirmation token.' });
  const db = getDb();
  const row = db.email_change_tokens.find((item) => item.token_hash === hashToken(parsed.data.token) && item.status === 'pending');
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Email confirmation token invalid or expired.' });
  const user = db.users.find((item) => item.id === row.user_id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (db.users.some((item) => item.id !== user.id && item.email.toLowerCase() === row.email.toLowerCase())) {
    return res.status(409).json({ error: 'An account already exists for this email.' });
  }
  const previousEmail = user.email;
  user.email = row.email.toLowerCase();
  delete user.pending_email;
  user.updated_at = now();
  row.status = 'accepted';
  row.accepted_at = now();
  saveDb();
  logActivity(user.id, 'profile_change', { action: 'email_changed', previous_email: previousEmail, email: user.email });
  res.json({ ok: true });
});

router.post('/register-applicant', async (req, res) => {
  const schema = z.object({
    full_name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().default(''),
    location: z.string().optional().default(''),
    password: z.string().min(PASSWORD_MIN_LENGTH)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Complete all required account fields.' });

  const email = parsed.data.email.toLowerCase();
  const database = getDb();
  if (database.users.some((user) => user.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account already exists for this email.' });
  }

  const user = insert('users', {
    email,
    password_hash: await hashPassword(parsed.data.password),
    role: 'applicant',
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    location: parsed.data.location,
    status: 'active',
    force_password_change: false,
    created_at: now()
  });
  await createSession(user, req, res);
  logActivity(user.id, 'profile_change', { action: 'public_applicant_account_created' });
  sendEmail({
    to: user.email,
    subject: 'Alpha Recovery Portal Account Created',
    text: `Your Alpha Recovery applicant portal account has been created.\n\nSign in: ${portalUrl('/login')}`,
    html: `<p>Your Alpha Recovery applicant portal account has been created.</p><p><a href="${portalUrl('/login')}">Sign in to the portal</a></p>`
  }).catch((error) => console.error('Account email failed:', error));
  res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  if (req.user) logActivity(req.user.id, 'logout');
  await clearSession(req, res);
  res.json({ ok: true });
});

router.post('/accept-invite', async (req, res) => {
  const schema = z.object({
    token: z.string().min(20),
    full_name: z.string().min(2),
    phone: z.string().optional().default(''),
    location: z.string().optional().default(''),
    password: z.string().min(PASSWORD_MIN_LENGTH)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid invite payload' });

  const database = getDb();
  const invite = database.invites.find((item) => item.token_hash === hashToken(parsed.data.token));
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invite is invalid or expired' });
  }
  if (database.users.some((user) => user.email.toLowerCase() === invite.email.toLowerCase())) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const user = insert('users', {
    email: invite.email.toLowerCase(),
    password_hash: await hashPassword(parsed.data.password),
    role: invite.role,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    location: parsed.data.location,
    status: 'active',
    force_password_change: false,
    created_at: now()
  });
  invite.status = 'accepted';
  saveDb();
  await createSession(user, req, res);
  logActivity(user.id, 'invite_accepted', { invite_id: invite.id, role: invite.role });
  res.json({ user: publicUser(user) });
});

router.post('/request-password-reset', (req, res) => {
  const email = String(req.body.email || '').toLowerCase();
  const user = getDb().users.find((item) => item.email.toLowerCase() === email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    insert('password_reset_tokens', {
      user_id: user.id,
      token_hash: hashToken(token),
      status: 'pending',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
    logActivity(user.id, 'profile_change', { action: 'password_reset_requested' });
    sendEmail({
      to: user.email,
      subject: 'Alpha Recovery Password Reset',
      text: `Use this secure link to reset your Alpha Recovery portal password:\n\n${portalUrl(`/reset-password?token=${token}`)}\n\nThis link expires in 1 hour.`,
      html: `<p>Use this secure link to reset your Alpha Recovery portal password:</p><p><a href="${portalUrl(`/reset-password?token=${token}`)}">Reset password</a></p><p>This link expires in 1 hour.</p>`
    }).catch((error) => console.error('Password reset email failed:', error));
    return res.json({ ok: true, ...(process.env.NODE_ENV === 'production' ? {} : { dev_reset_token: token }) });
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const schema = z.object({ token: z.string().min(20), password: z.string().min(PASSWORD_MIN_LENGTH) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid reset payload' });
  const database = getDb();
  const row = database.password_reset_tokens.find((item) => item.token_hash === hashToken(parsed.data.token) && item.status === 'pending');
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Reset token invalid or expired' });
  const user = database.users.find((item) => item.id === row.user_id);
  user.password_hash = await hashPassword(parsed.data.password);
  user.force_password_change = false;
  user.updated_at = now();
  row.status = 'accepted';
  saveDb();
  logActivity(user.id, 'profile_change', { action: 'password_reset_completed' });
  res.json({ ok: true });
});

router.post('/dev/create-invite', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const schema = z.object({ email: z.string().email(), role: z.enum(INTERNAL_ROLES) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invite requires a valid email and role.' });
  if (!staffRoleOptions(req.user).includes(parsed.data.role)) return res.status(403).json({ error: 'Access denied for that role.' });
  const token = crypto.randomBytes(32).toString('hex');
  const invite = insert('invites', {
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    token_hash: hashToken(token),
    invited_by: req.user.id,
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
  logActivity(req.user.id, 'invite_sent', { invite_id: invite.id, email: invite.email, role: invite.role });
  try {
    const email = await sendEmail({
      to: invite.email,
      subject: 'Alpha Recovery Portal Invitation',
      text: `You have been invited to the Alpha Recovery portal as ${invite.role}.\n\nAccept invite: ${portalUrl(`/accept-invite?token=${token}`)}\n\nThis invite expires in 7 days.`,
      html: `<p>You have been invited to the Alpha Recovery portal as <strong>${invite.role}</strong>.</p><p><a href="${portalUrl(`/accept-invite?token=${token}`)}">Accept invite</a></p><p>This invite expires in 7 days.</p>`
    });
    invite.email_status = email.logged ? 'logged' : 'sent';
    saveDb();
    res.json({ invite, token, email });
  } catch (error) {
    console.error('Invite email failed:', { message: error.message, to: invite.email, role: invite.role });
    invite.email_status = 'failed';
    invite.email_error = publicErrorMessage(error, 'Invite email failed.');
    saveDb();
    res.json({
      invite,
      token,
      email: { ok: false, error: publicErrorMessage(error, 'Invite email failed.') },
      warning: 'Invite was created, but the email failed to send. Copy the invite link below.'
    });
  }
});

router.patch('/users/:id/status', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  if (req.params.id === req.user.id && req.body.status !== 'active') {
    return res.status(400).json({ error: 'You cannot disable your own admin account.' });
  }
  const schema = z.object({ status: z.enum(['active', 'disabled', 'pending']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Select a valid access status.' });
  const row = getDb().users.find((user) => user.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (!canManageUserAccess(req.user, row)) return res.status(403).json({ error: 'Access denied.' });
  if (row.role === 'admin' && row.status === 'active' && parsed.data.status !== 'active' && activeAdminCount() <= 1) {
    return res.status(400).json({ error: 'At least one active Admin is required.' });
  }
  row.status = parsed.data.status;
  row.updated_at = now();
  saveDb();
  logActivity(req.user.id, 'profile_change', { user_id: row.id, status: row.status });
  res.json({ user: publicUser(row) });
});

router.patch('/users/:id/role', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const schema = z.object({ role: z.enum(INTERNAL_ROLES) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Select a valid role.' });
  if (req.params.id === req.user.id && parsed.data.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove Admin from your own account.' });
  }
  const row = getDb().users.find((user) => user.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (!canManageUserAccess(req.user, row, parsed.data.role)) return res.status(403).json({ error: 'Access denied.' });
  if (row.role === 'admin' && parsed.data.role !== 'admin' && activeAdminCount() <= 1) {
    return res.status(400).json({ error: 'At least one active Admin is required.' });
  }
  row.role = parsed.data.role;
  row.updated_at = now();
  saveDb();
  logActivity(req.user.id, 'profile_change', { user_id: row.id, role: row.role });
  res.json({ user: publicUser(row) });
});

router.delete('/users/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const row = db.users.find((user) => user.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (row.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  if (!canManageUserAccess(req.user, row)) return res.status(403).json({ error: 'Access denied.' });
  if (row.role === 'admin' && activeAdminCount() <= 1) return res.status(400).json({ error: 'At least one active Admin is required.' });
  db.users = db.users.filter((user) => user.id !== row.id);
  db.invites = db.invites.filter((invite) => invite.email.toLowerCase() !== row.email.toLowerCase());
  saveDb();
  logActivity(req.user.id, 'profile_change', { action: 'user_deleted', user_id: row.id, role: row.role });
  res.json({ ok: true });
});

export default router;
