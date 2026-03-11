/**
 * Sends a trip reminder email to the passenger.
 * Used by /api/cron/trip-reminders
 * Sender: noreply@travelasiargao.com via Zoho SMTP
 */

import type { SiteBranding } from "@/lib/site-branding";
import { sendViaGmail, isGmailConfigured } from "./send-via-gmail";

export type SendTripReminderParams = {
  to: string;
  customerName: string;
  reference: string;
  routeName: string;
  origin: string;
  destination: string;
  departureDate: string; // e.g. "2026-03-15"
  departureTime: string; // e.g. "07:45"
  passengerCount: number;
  reminderType: "24h" | "6h";
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function buildHtml(params: SendTripReminderParams, branding: SiteBranding): string {
  const {
    customerName,
    reference,
    routeName,
    origin,
    destination,
    departureDate,
    departureTime,
    passengerCount,
    reminderType,
  } = params;

  const isUrgent = reminderType === "6h";
  const emoji = isUrgent ? "⏰" : "🌴";
  const urgencyText = isUrgent
    ? "Your trip departs in about <strong>6 hours</strong>. Time to get ready!"
    : "Your trip is <strong>tomorrow</strong>. Here's a quick reminder to help you prepare.";
  const badgeColor = isUrgent ? "#dc2626" : "#0c7b93";
  const badgeText = isUrgent ? "⏰ Departing in ~6 Hours" : "🌴 Trip Tomorrow";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trip Reminder – ${branding.site_name}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0fdfa; color: #134e4a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdfa;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(19,78,74,0.10); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #085C52 0%, #0c7b93 60%, #1AB5A3 100%); padding: 32px; text-align: center;">
              <img src="https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/logo/Logo.png"
                alt="${branding.site_name}"
                style="height: 72px; width: 72px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
              <p style="margin:0; font-size: 22px; font-weight: 800; color: #fef9e7;">${branding.site_name}</p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: rgba(254,249,231,0.8);">${branding.routes_text}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">

              <!-- Emoji + badge -->
              <div style="text-align: center; margin-bottom: 16px;">
                <span style="font-size: 40px;">${emoji}</span>
              </div>
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 999px; letter-spacing: 0.03em;">
                  ${badgeText}
                </span>
              </div>

              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #134e4a; text-align: center;">
                Hi ${customerName.split(" ")[0]}! Your trip is coming up.
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #134e4a; text-align: center;">
                ${urgencyText}
              </p>

              <!-- Trip details box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f0fdfa; border: 1px solid #99d6d4; border-radius: 12px; padding: 20px 24px;">

                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px; border-bottom: 1px solid #d1faf4;">
                          <p style="margin: 0 0 2px 0; font-size: 11px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em;">Booking Reference</p>
                          <p style="margin: 0; font-size: 20px; font-weight: 900; font-family: monospace; letter-spacing: 0.1em; color: #0c7b93;">${reference}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px; padding-bottom: 12px; border-bottom: 1px solid #d1faf4;">
                          <p style="margin: 0 0 2px 0; font-size: 11px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em;">Route</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 700; color: #134e4a;">${origin} → ${destination}</p>
                          <p style="margin: 2px 0 0 0; font-size: 13px; color: #0f766e;">${routeName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px; padding-bottom: 12px; border-bottom: 1px solid #d1faf4;">
                          <p style="margin: 0 0 2px 0; font-size: 11px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em;">Departure</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 700; color: #134e4a;">${formatDate(departureDate)}</p>
                          <p style="margin: 2px 0 0 0; font-size: 15px; font-weight: 800; color: #0c7b93;">${formatTime(departureTime)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 12px;">
                          <p style="margin: 0 0 2px 0; font-size: 11px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em;">Passengers</p>
                          <p style="margin: 0; font-size: 15px; font-weight: 700; color: #134e4a;">${passengerCount} passenger${passengerCount > 1 ? "s" : ""}</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Reminders -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef9e7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #92400e;">📋 Reminders</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8; color: #92400e;">
                      <li>Be at the port <strong>at least 30 minutes</strong> before departure</li>
                      <li>Bring a valid <strong>government-issued ID</strong></li>
                      <li>Have your <strong>booking reference</strong> ready: <strong>${reference}</strong></li>
                      ${isUrgent ? "<li>⚠️ You have <strong>limited time</strong> — head to the port now!</li>" : "<li>Prepare your bags and travel documents tonight</li>"}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- View tickets CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="https://travelasiargao.com/dashboard/bookings/${reference}"
                      style="display: inline-block; background: linear-gradient(135deg, #0c7b93, #0f766e); color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 12px rgba(12,123,147,0.35);">
                      🎫 View My Booking
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.6;">
                Need help? Email us at <a href="mailto:support@travelasiargao.com" style="color: #0c7b93; font-weight: 700;">support@travelasiargao.com</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f0fdfa; border-top: 1px solid #d1faf4; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #0f766e;">Feel the island before you arrive. Sun, waves, and a smooth sail away.</p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">© ${branding.site_name} · <a href="https://travelasiargao.com" style="color: #0c7b93;">travelasiargao.com</a> · Automated message, please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTripReminder(params: SendTripReminderParams): Promise<boolean> {
  const { getSiteBranding } = await import("@/lib/site-branding");
  const branding = await getSiteBranding();
  const label = params.reminderType === "24h" ? "tomorrow" : "in ~6 hours";
  const subject = `⏰ Trip Reminder — Your trip ${label} | ${params.reference} – ${branding.site_name}`;
  const html = buildHtml(params, branding);

  if (isGmailConfigured()) {
    const ok = await sendViaGmail({ to: params.to, subject, html });
    if (ok) return true;
  }

  return false;
}
