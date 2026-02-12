/**
 * Send email via Gmail SMTP (nodemailer).
 * Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (use Gmail App Password).
 * From address uses SMTP_USER (e.g. gabu.sacro@gmail.com).
 */

import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export type SendMailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

/** Returns true if sent, false if skipped or failed. Does not throw. */
export async function sendViaGmail(params: SendMailParams): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;
  const from = params.from ?? process.env.SMTP_USER ?? "Nier Shipping Lines";
  try {
    await transport.sendMail({
      from: typeof from === "string" && from.includes("<") ? from : `${from} <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (e) {
    console.error("[sendViaGmail]", e);
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
