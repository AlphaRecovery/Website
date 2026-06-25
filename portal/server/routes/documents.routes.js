import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { getDb, saveDb } from '../data/store.js';
import { logActivity } from '../auth.js';
import { logFileAccessDenied, sendStoredFileResponse } from '../fileResponses.js';
import { requireAuth } from '../middleware/auth.js';
import { pushNotifications } from '../notifications.js';
import { deleteStoredFile, isRemoteStoragePath, storeUploadedFile } from '../storage.js';

const router = express.Router();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const upload = multer({
  dest: config.uploadsDir,
  limits: { fileSize: config.maxUploadFileBytes },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

function canAccessDocument(user, document) {
  if (['admin', 'recruiter'].includes(user.role)) return true;
  return document.owner_user_id === user.id;
}

function inferMimeType(filePath, document) {
  if (document.mime_type) return document.mime_type;
  if (isRemoteStoragePath(filePath)) return 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature.startsWith('25504446')) return 'application/pdf';
  if (signature.startsWith('89504e47')) return 'image/png';
  if (signature.startsWith('ffd8ff')) return 'image/jpeg';
  const ext = path.extname(document.original_name || document.name || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.pdf') return 'application/pdf';
  return 'text/plain';
}

router.post('/documents/:id/upload', requireAuth, upload.single('file'), async (req, res) => {
  const cleanupTemp = () => {
    if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
  };
  const document = getDb().documents.find((item) => item.id === req.params.id);
  if (!document) {
    cleanupTemp();
    return res.status(404).json({ error: 'Document not found' });
  }
  if (!canAccessDocument(req.user, document)) {
    cleanupTemp();
    return res.status(403).json({ error: 'Access denied' });
  }
  let storedPath = '';
  try {
    storedPath = await storeUploadedFile(req.file, `documents/${document.id}`);
    document.file_path = storedPath;
    document.original_name = req.file.originalname;
    document.mime_type = req.file.mimetype;
    document.status = 'uploaded';
    saveDb();
    logActivity(req.user.id, 'file_upload', { document_id: document.id, original_name: req.file.originalname });
    pushNotifications([document.owner_user_id, document.requested_by, req.user.id]);
    res.json({ document });
  } catch (error) {
    if (storedPath) await deleteStoredFile(storedPath).catch(() => {});
    cleanupTemp();
    res.status(500).json({ error: error.message || 'Document upload failed.' });
  }
});

router.get('/documents/:id/download', requireAuth, async (req, res) => {
  const document = getDb().documents.find((item) => item.id === req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (!canAccessDocument(req.user, document)) {
    logFileAccessDenied(req, { document_id: document.id, entity_type: 'document', entity_id: document.id });
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!document.file_path || (!isRemoteStoragePath(document.file_path) && !fs.existsSync(document.file_path))) return res.status(404).json({ error: 'No file uploaded' });
  return sendStoredFileResponse({
    req,
    res,
    filePath: document.file_path,
    mimeType: inferMimeType(document.file_path, document),
    filename: document.original_name || document.name,
    disposition: 'attachment',
    audit: { action: 'file_download', metadata: { document_id: document.id, entity_type: 'document', entity_id: document.id } }
  });
});

router.get('/documents/:id/view', requireAuth, async (req, res) => {
  const document = getDb().documents.find((item) => item.id === req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (!canAccessDocument(req.user, document)) {
    logFileAccessDenied(req, { document_id: document.id, entity_type: 'document', entity_id: document.id });
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!document.file_path || (!isRemoteStoragePath(document.file_path) && !fs.existsSync(document.file_path))) return res.status(404).json({ error: 'No file uploaded' });
  const filename = document.original_name || document.name || path.basename(document.file_path);
  return sendStoredFileResponse({
    req,
    res,
    filePath: document.file_path,
    mimeType: inferMimeType(document.file_path, document),
    filename,
    disposition: 'inline',
    audit: { action: 'file_view', metadata: { document_id: document.id, entity_type: 'document', entity_id: document.id } }
  });
});

export default router;
