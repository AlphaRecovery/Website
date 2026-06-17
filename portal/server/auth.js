import crypto from 'node:crypto';
import argon2 from 'argon2';
import { config } from './config.js';
import { createSessionRow, deleteSessionByTokenHash, findSessionByTokenHash, getDb, insert, now } from './data/store.js';

const COOKIE = 'alpha_session';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

export async function verifyPassword(user, password) {
  if (!user || user.status !== 'active') return false;
  return argon2.verify(user.password_hash, password);
}

export async function hashPassword(password) {
  return argon2.hash(password);
}

export async function createSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000).toISOString();
  // Await the write so the session is durable before the response (and its
  // Set-Cookie) is sent — otherwise a frozen serverless instance can drop it.
  await createSessionRow({
    tokenHash: hashToken(token),
    userId: user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    expiresAt: expires
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: config.cookieDomain,
    path: '/',
    expires: new Date(expires)
  });
}

export async function clearSession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) {
    await deleteSessionByTokenHash(hashToken(token));
  }
  res.clearCookie(COOKIE, { domain: config.cookieDomain, path: '/' });
}

export async function findUserBySession(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const session = await findSessionByTokenHash(hashToken(token));
  if (!session) return null;
  const user = getDb().users.find((item) => item.id === session.user_id && item.status === 'active');
  return user || null;
}

export function logActivity(userId, action, metadata = {}) {
  insert('activity_log', { user_id: userId || null, action, metadata, created_at: now() });
}
