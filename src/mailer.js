import nodemailer from 'nodemailer';

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD env vars must be set');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/**
 * Send an email via the configured Gmail account.
 * @param {Object} opts
 * @param {string|string[]} opts.to  - recipient(s)
 * @param {string} opts.subject
 * @param {string} opts.text         - plain-text body
 * @param {string} [opts.html]       - optional HTML body
 * @returns {Promise<{messageId: string}>}
 */
export async function sendEmail({ to, subject, text, html }) {
  const transport = createTransport();
  const user = process.env.GMAIL_USER;
  const fromName = process.env.GMAIL_FROM_NAME || 'Brian';
  const info = await transport.sendMail({
    from: `"${fromName}" <${user}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
  });
  return { messageId: info.messageId };
}

/**
 * Verify SMTP credentials without sending a message.
 * @returns {Promise<{ok: boolean}>}
 */
export async function verifyConnection() {
  const transport = createTransport();
  await transport.verify();
  return { ok: true };
}
