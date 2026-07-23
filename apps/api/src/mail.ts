import nodemailer from 'nodemailer';

import type { ServerConfig } from './config.js';

export async function sendAuthEmail(
  config: ServerConfig,
  message: Readonly<{ subject: string; text: string; to: string }>,
): Promise<void> {
  if (!config.smtp) throw new Error('Transactional email is not configured.');
  const transport = nodemailer.createTransport({
    auth: { pass: config.smtp.password, user: config.smtp.user },
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
  });
  await transport.sendMail({
    from: config.smtp.from,
    subject: message.subject,
    text: message.text,
    to: message.to,
  });
}
