import express from 'express';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { canRunRetentionActions } from '../policies.js';
import { runRetentionCleanup } from '../retention.js';

const router = express.Router();

function requireRetentionAdmin(req, res, next) {
  if (!canRunRetentionActions(req.user)) {
    return res.status(403).json({ error: 'Only Admin users can review retention cleanup.' });
  }
  next();
}

router.get('/admin/retention-cleanup/dry-run', requireAuth, requireRetentionAdmin, async (req, res) => {
  const summary = await runRetentionCleanup({ execute: false });
  res.json(summary);
});

router.post('/admin/retention-cleanup/run', requireAuth, requireRetentionAdmin, async (req, res) => {
  const summary = await runRetentionCleanup({ execute: true });
  res.json(summary);
});

router.get('/jobs/retention-cleanup', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const tokenOk = config.retentionJobSecret && authHeader === `Bearer ${config.retentionJobSecret}`;
  const adminOk = canRunRetentionActions(req.user);
  if (!tokenOk && !adminOk) return res.status(401).json({ error: 'Unauthorized retention job request.' });

  const execute = tokenOk || req.query.execute === 'true';
  const summary = await runRetentionCleanup({ execute });
  res.json(summary);
});

export default router;
