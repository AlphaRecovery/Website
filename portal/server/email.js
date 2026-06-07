import { config } from './config.js';

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return { ok: false, skipped: true };
  if (config.emailDriver !== 'resend') {
    console.log('[email:log]', { to, subject, text });
    return { ok: true, logged: true };
  }
  if (!config.resendApiKey) throw new Error('RESEND_API_KEY is required when EMAIL_DRIVER=resend.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to,
      subject,
      text,
      html
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email send failed: ${error}`);
  }
  return response.json();
}

export function portalUrl(path = '/') {
  return `${config.publicPortalUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

