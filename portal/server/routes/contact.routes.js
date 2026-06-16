import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { sendEmail } from '../email.js';

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(''),
  org: z.string().trim().max(160).optional().default(''),
  orgSize: z.string().trim().max(80).optional().default(''),
  service: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().max(5000).optional().default(''),
  website: z.string().trim().max(200).optional().default('')
});

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function field(label, value) {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return '';
  return `${label}: ${cleanValue}`;
}

router.post('/contact', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete the required contact fields.' });
  }

  const inquiry = parsed.data;
  if (inquiry.website) {
    return res.json({ ok: true });
  }

  const lines = [
    'New Alpha Recovery website inquiry',
    '',
    field('Name', inquiry.name),
    field('Email', inquiry.email),
    field('Phone', inquiry.phone),
    field('Organization', inquiry.org),
    field('Organization size', inquiry.orgSize),
    field('Service', inquiry.service),
    '',
    'Message:',
    inquiry.message || 'No message provided.'
  ].filter((line) => line !== '');

  const htmlRows = [
    ['Name', inquiry.name],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone],
    ['Organization', inquiry.org],
    ['Organization size', inquiry.orgSize],
    ['Service', inquiry.service]
  ]
    .filter(([, value]) => String(value || '').trim())
    .map(([label, value]) => `<tr><th align="left" style="padding:6px 12px 6px 0;">${escapeHtml(label)}</th><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`)
    .join('');

  await sendEmail({
    to: config.contactEmail,
    subject: `Website inquiry from ${inquiry.name}`,
    text: lines.join('\n'),
    html: `<p>New Alpha Recovery website inquiry.</p><table>${htmlRows}</table><p><strong>Message</strong></p><p>${escapeHtml(inquiry.message || 'No message provided.').replace(/\n/g, '<br />')}</p>`,
    replyTo: inquiry.email
  });

  res.json({ ok: true });
});

export default router;
