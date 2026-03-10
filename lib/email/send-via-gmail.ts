/**
 * Send email via Zoho SMTP (nodemailer).
 * Uses: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Sender: noreply@travelasiargao.com
 */

import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for Zoho port 465
    auth: { user, pass },
  });
}

export type SendMailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendViaGmail(params: SendMailParams): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  // Use SMTP_FROM env var, e.g. "Travela Siargao <noreply@travelasiargao.com>"
  const from =
    params.from ??
    process.env.SMTP_FROM?.trim() ??
    `Travela Siargao <${process.env.SMTP_USER}>`;

  try {
    await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (e) {
    console.error("[sendViaZoho]", e);
    return false;
  }
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}