/**
 * Sends a "New user registration" notification email to the admin.
 * Uses the same Zoho SMTP transport as other emails.
 */

import { sendViaGmail, isGmailConfigured } from "./send-via-gmail";

const RESEND_API = "https://api.resend.com/emails";
const ADMIN_EMAIL = "gabu.sacro@gmail.com";

export type NewSignupNotificationParams = {
  fullName: string;
  email: string;
  role: string;
  gender?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  mobile?: string | null;
  address?: string | null;
  createdAt: string;
};

function buildHtml(params: NewSignupNotificationParams): string {
  const {
    fullName, email, role, gender,
    birthdate, nationality, mobile, address, createdAt,
  } = params;

  const signupDate = new Date(createdAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const row = (label: string, value: string | null | undefined) =>
    value ? `
    <tr>
      <td style="padding: 8px 12px; font-size: 13px; color: #0f766e; font-weight: 600; width: 140px; vertical-align: top;">${label}</td>
      <td style="padding: 8px 12px; font-size: 14px; color: #134e4a;">${value}</td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Sign-up – Travela Siargao</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; color: #134e4a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 78, 74, 0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 28px 32px; text-align: center;">
              <p style="margin:0; font-size: 22px; font-weight: 700; color: #ffffff;">Travela Siargao</p>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Admin Notification — New User Registration</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #134e4a;">👥 New Sign-up</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #0f766e;">A new user just registered on Travela Siargao.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                style="border: 1px solid #e2f2f1; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <tbody>
                  ${row("Full Name", fullName)}
                  ${row("Email", email)}
                  ${row("Role", role.charAt(0).toUpperCase() + role.slice(1))}
                  ${row("Gender", gender)}
                  ${row("Birthdate", birthdate)}
                  ${row("Nationality", nationality)}
                  ${row("Mobile", mobile)}
                  ${row("Address", address)}
                  ${row("Registered", signupDate)}
                </tbody>
              </table>

              <a href="https://travelasiargao.com/admin/accounts"
                style="display: inline-block; background-color: #7c3aed; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                View in Admin → Users
              </a>

              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af;">
                This is an automated notification from Travela Siargao admin system.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAdminNewSignupNotification(
  params: NewSignupNotificationParams
): Promise<boolean> {
  const subject = `👥 New Sign-up: ${params.fullName} (${params.email}) — Travela Siargao`;
  const html = buildHtml(params);

  if (isGmailConfigured()) {
    const ok = await sendViaGmail({ to: ADMIN_EMAIL, subject, html });
    if (ok) return true;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM?.trim() || "Travela Siargao <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [ADMIN_EMAIL], subject, html }),
    });
    if (!res.ok) {
      console.error("[sendAdminNewSignupNotification] error:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sendAdminNewSignupNotification]", e);
    return false;
  }
}