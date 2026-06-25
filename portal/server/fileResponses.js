import { logActivity } from './auth.js';
import { readStoredFile } from './storage.js';
import { setPrivateNoStoreHeaders } from './security.js';

function safeFilename(value) {
  return String(value || 'document').replace(/"/g, '').replace(/[\r\n]/g, '').slice(0, 180);
}

export function logFileAccess(req, action, metadata = {}) {
  logActivity(req.user?.id || null, action, metadata, req);
}

export function logFileAccessDenied(req, metadata = {}) {
  logActivity(req.user?.id || null, 'file_access_denied', metadata, req);
}

export async function sendStoredFileResponse({ req, res, filePath, mimeType, filename, disposition = 'attachment', audit }) {
  setPrivateNoStoreHeaders(res);
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename(filename)}"`);
  if (audit) logFileAccess(req, audit.action, audit.metadata);
  const buffer = await readStoredFile(filePath);
  res.send(buffer);
}
