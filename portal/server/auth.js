import crypto from 'node:crypto';
import argon2 from 'argon2';
import { config } from './config.js';
import { getDb, insert, now, removeExpiredSessions, saveDb } from './data/store.js';

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

export function createSession(user, req, res) {
  removeExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000).toISOString();
  insert('sessions', {
    user_id: user.id,
    token_hash: hashToken(token),
    ip_address: req.ip,
    user_agent: req.headers['user-agent'] || '',
    expires_at: expires
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

export function clearSession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) {
    const database = getDb();
    const tokenHash = hashToken(token);
    database.sessions = database.sessions.filter((session) => session.token_hash !== tokenHash);
    saveDb();
  }
  res.clearCookie(COOKIE, { domain: config.cookieDomain, path: '/' });
}

export function findUserBySession(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  removeExpiredSessions();
  const database = getDb();
  const session = database.sessions.find((item) => item.token_hash === hashToken(token));
  if (!session) return null;
  const user = database.users.find((item) => item.id === session.user_id && item.status === 'active');
  return user || null;
}

export function logActivity(userId, action, metadata = {}) {
  insert('activity_log', { user_id: userId || null, action, metadata, created_at: now() });
}
