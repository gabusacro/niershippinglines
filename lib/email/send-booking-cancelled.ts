/**
 * Sends a "booking auto-cancelled" email to the passenger.
 * Used by /api/cron/auto-cancel
 * Includes a rebook link so all their info is preserved.
 *
 * Sender: noreply@travelasiargao.com via Zoho SMTP
 */

import type { SiteBranding } from "@/lib/site-branding";
import { sendViaGmail, isGmailConfigured } from "./send-via-gmail";

export type SendBookingCancelledParams = {
  to: string;
  customerName: string;
  reference: string;
  routeName: string;
  origin: string;
  destination: string;
  departureDate: string; // e.g. "2026-03-15"
  departureTime: string; // e.g. "07:45"
  passengerCount: number;
  totalAmountCents: number;
  reBookUrl: string; // pre-filled rebook URL e.g. /book?ref=TVL-XXXX
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

function formatPeso(cents: number): string {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function buildHtml(params: SendBookingCancelledParams, branding: SiteBranding): string {
  const {
    customerName,
    reference,
    routeName,
    origin,
    destination,
    departureDate,
    departureTime,
    passengerCount,
    totalAmountCents,
    reBookUrl,
  } = params;

  const route = origin && destination ? `${origin} → ${destination}` : routeName;
  const siteName = branding?.site_name ?? "Travela Siargao";
  const siteUrl  = "https://travelasiargao.com";
  const logoUrl  = "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Cancelled – ${reference}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdfa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(12,123,147,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#085C52 0%,#0c7b93 100%);padding:32px 32px 24px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${siteName}" style="height:48px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />` : ""}
              <div style="font-size:40px;margin-bottom:8px;">⚠️</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                Booking Cancelled
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                No payment was received within 6 hours
              </p>
            </td>
          </tr>

          <!-- Reference badge -->
          <tr>
            <td style="padding:24px 32px 0;text-align:center;">
              <div style="display:inline-block;background:#fef9e7;border:2px solid #f59e0b;border-radius:12px;padding:12px 24px;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Reference Number</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#0c7b93;font-family:monospace;">${reference}</p>
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:16px;color:#134e4a;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.7;">
                Your booking has been automatically cancelled because no payment was received within 6 hours.
                <strong>Don't worry — all your passenger details are saved!</strong> You can rebook in one click below.
              </p>
            </td>
          </tr>

          <!-- Trip details -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="background:#f0fdfa;border-radius:12px;padding:20px;border:1px solid #99f6e4;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:1px;">Cancelled Trip</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;">
                      <span style="font-size:12px;color:#6b7280;">Route</span><br/>
                      <strong style="font-size:15px;color:#134e4a;">${route}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">
                      <span style="font-size:12px;color:#6b7280;">Date</span><br/>
                      <strong style="font-size:15px;color:#134e4a;">${formatDate(departureDate)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">
                      <span style="font-size:12px;color:#6b7280;">Departure</span><br/>
                      <strong style="font-size:15px;color:#134e4a;">${formatTime(departureTime)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">
                      <span style="font-size:12px;color:#6b7280;">Passengers</span><br/>
                      <strong style="font-size:15px;color:#134e4a;">${passengerCount} passenger${passengerCount !== 1 ? "s" : ""}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">
                      <span style="font-size:12px;color:#6b7280;">Amount (was)</span><br/>
                      <strong style="font-size:15px;color:#134e4a;">${formatPeso(totalAmountCents)}</strong>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Rebook CTA -->
          <tr>
            <td style="padding:28px 32px 0;text-align:center;">
              <p style="margin:0 0 16px;font-size:14px;color:#374151;">
                Your passenger names, contact info, and details are all saved.
                Just click below to rebook — seats are available on a first-come, first-served basis.
              </p>
              <a href="${reBookUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#0c7b93,#0f766e);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:16px 40px;border-radius:14px;letter-spacing:0.3px;">
                🔁 Rebook This Trip
              </a>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                Or visit <a href="${siteUrl}/schedule" style="color:#0c7b93;">${siteUrl}/schedule</a> to choose a new trip.
              </p>
            </td>
          </tr>

          <!-- Why was it cancelled -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="background:#fef3c7;border-radius:12px;padding:16px 20px;border-left:4px solid #f59e0b;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">Why was my booking cancelled?</p>
                <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.6;">
                  To keep seats available for all passengers, bookings that don't receive payment within
                  <strong>6 hours</strong> are automatically released. This ensures fair access for everyone travelling to and from Siargao.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px;text-align:center;border-top:1px solid #e5e7eb;margin-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Questions? Reply to this email or visit
                <a href="${siteUrl}" style="color:#0c7b93;">${siteUrl}</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">
                © ${new Date().getFullYear()} ${siteName} · Your ferry booking partner in Siargao
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

function buildText(params: SendBookingCancelledParams): string {
  const { customerName, reference, routeName, departureDate, departureTime, passengerCount, totalAmountCents, reBookUrl } = params;
  return `Hi ${customerName},

Your booking ${reference} has been automatically cancelled — no payment was received within 6 hours.

CANCELLED TRIP:
Route: ${routeName}
Date: ${departureDate}
Time: ${formatTime(departureTime)}
Passengers: ${passengerCount}
Amount: ${formatPeso(totalAmountCents)}

YOUR DETAILS ARE SAVED — rebook here:
${reBookUrl}

Why cancelled? To keep seats fair for all passengers, unpaid bookings are released after 6 hours.

Questions? Reply to this email.
— Travela Siargao Team`;
}

export async function sendBookingCancelled(
  params: SendBookingCancelledParams,
  branding: SiteBranding,
): Promise<void> {
  const subject = `⚠️ Booking Cancelled – ${params.reference} | Rebook Now`;
  const html    = buildHtml(params, branding);
  const text    = buildText(params);

  if (isGmailConfigured()) {
    await sendViaGmail({ to: params.to, subject, html });
    return;
  }

  // Fallback: Zoho SMTP (nodemailer)
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host:   process.env.SMTP_HOST   ?? "smtp.zoho.com",
    port:   Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    `"${branding?.site_name ?? "Travela Siargao"}" <${process.env.SMTP_USER}>`,
    to:      params.to,
    subject,
    html,
    text,
  });
}
