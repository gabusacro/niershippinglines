/**
 * Sends a "Payment required" email after a booking is created.
 * Uses Gmail SMTP first (if SMTP_* set), else Resend API. If neither is set, does nothing.
 */

import { sendViaGmail, isGmailConfigured } from "./send-via-gmail";

const RESEND_API = "https://api.resend.com/emails";
const APP_NAME = "Nier Shipping Lines";

export type SendPaymentRequiredParams = {
  to: string;
  reference: string;
  totalAmountCents: number;
  gcashNumber?: string | null;
  gcashAccountName?: string | null;
};

function buildHtml(params: SendPaymentRequiredParams): string {
  const { reference, totalAmountCents, gcashNumber, gcashAccountName } = params;
  const totalPhp = (totalAmountCents / 100).toLocaleString();
  const hasGcash = Boolean(gcashNumber?.trim() && gcashAccountName?.trim());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment required – ${APP_NAME}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; color: #134e4a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 78, 74, 0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #0c7b93 0%, #0f766e 100%); padding: 28px 32px; text-align: center;">
              <p style="margin:0; font-size: 22px; font-weight: 700; color: #fef9e7;">${APP_NAME}</p>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(254, 249, 231, 0.9);">Siargao Island ↔ Surigao · Dinagat ↔ Surigao City</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #134e4a;">Payment required</h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.55; color: #134e4a;">Your booking has been created. Please pay to confirm your trip.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef9e7; border: 1px solid #99d6d4; border-radius: 8px; padding: 14px 18px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #0f766e; text-transform: uppercase;">Booking reference</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 700; font-family: monospace; letter-spacing: 0.08em; color: #0c7b93;">${reference}</p>
                    <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 600; color: #134e4a;">Total to pay: ₱${totalPhp}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #134e4a;">How to pay</p>
              <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 15px; line-height: 1.6; color: #134e4a;">
                <li><strong>Ticket booth:</strong> Pay in person and present reference <strong>${reference}</strong>.</li>
                ${hasGcash ? `
                <li><strong>GCash deposit:</strong> Send <strong>₱${totalPhp}</strong> to <strong>${gcashNumber!.trim()}</strong> (${gcashAccountName!.trim()}). Put reference <strong>${reference}</strong> in the message. Show proof at the ticket booth.</li>
                ` : ""}
              </ul>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.55; color: #0f766e;"><strong>Tip:</strong> Take a screenshot of your payment (before and after) so you can show it at the ticket booth.</p>
              <p style="margin: 0; font-size: 14px; color: #0f766e;">If you did not make this booking, please ignore this email or contact support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends the payment-required email. Uses Gmail SMTP if configured, else Resend. No-op if neither set.
 * Does not throw; logs errors and returns false on failure.
 */
export async function sendBookingPaymentRequired(
  params: SendPaymentRequiredParams
): Promise<boolean> {
  const subject = `Payment required – Reference ${params.reference} – ${APP_NAME}`;
  const html = buildHtml(params);

  // Prefer Gmail (free, from your gabu.sacro@gmail.com)
  if (isGmailConfigured()) {
    const ok = await sendViaGmail({ to: params.to, subject, html });
    if (ok) return true;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM?.trim() || "Nier Shipping Lines <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[sendBookingPaymentRequired] Resend error:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sendBookingPaymentRequired]", e);
    return false;
  }
}
