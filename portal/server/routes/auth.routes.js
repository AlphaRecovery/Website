import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDb, insert, now, saveDb, updateById } from '../data/store.js';
import { clearSession, createSession, hashPassword, hashToken, logActivity, publicUser, verifyPassword } from '../auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { portalUrl, sendEmail } from '../email.js';

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;

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

  createSession(user, req, res);
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
  createSession(user, req, res);
  logActivity(user.id, 'profile_change', { action: 'public_applicant_account_created' });
  sendEmail({
    to: user.email,
    subject: 'Alpha Recovery Portal Account Created',
    text: `Your Alpha Recovery applicant portal account has been created.\n\nSign in: ${portalUrl('/login')}`,
    html: `<p>Your Alpha Recovery applicant portal account has been created.</p><p><a href="${portalUrl('/login')}">Sign in to the portal</a></p>`
  }).catch((error) => console.error('Account email failed:', error));
  res.json({ user: publicUser(user) });
});

router.post('/logout', requireAuth, (req, res) => {
  logActivity(req.user.id, 'logout');
  clearSession(req, res);
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
  createSession(user, req, res);
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

router.post('/dev/create-invite', requireAuth, requireRole('admin'), async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const invite = insert('invites', {
    email: String(req.body.email || '').toLowerCase(),
    role: req.body.role,
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
    invite.email_error = error.message;
    saveDb();
    res.json({
      invite,
      token,
      email: { ok: false, error: error.message },
      warning: 'Invite was created, but the email failed to send. Copy the invite link below.'
    });
  }
});

router.patch('/users/:id/status', requireAuth, requireRole('admin'), (req, res) => {
  const row = updateById('users', req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'User not found' });
  logActivity(req.user.id, 'profile_change', { user_id: row.id, status: row.status });
  res.json({ user: publicUser(row) });
});

export default router;
