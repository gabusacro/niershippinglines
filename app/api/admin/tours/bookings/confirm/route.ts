import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { sendViaGmail } from "@/lib/email/send-via-gmail";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const booking_id = formData.get("booking_id") as string;
  const reference  = formData.get("reference") as string;

  const supabase = await createClient();

  // Fetch booking details for the email
  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("id", booking_id)
    .single();

  const { error } = await supabase
    .from("tour_bookings")
    .update({
      status: "confirmed",
      payment_status: "verified",
      payment_verified_by: user.id,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking_id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/tours/bookings/${booking_id}?error=${encodeURIComponent(error.message)}`, request.url),
      { status: 303 }
    );
  }

  // Send confirmation email
  if (booking?.customer_email) {
    const tourTitle   = (booking.tour as { title?: string } | null)?.title ?? "Tour";
    const tourDate    = (booking.schedule as { available_date?: string } | null)?.available_date ?? "";
    const departure   = (booking.schedule as { departure_time?: string } | null)?.departure_time?.slice(0, 5) ?? "";
    const voucherUrl  = `${process.env.NEXT_PUBLIC_SITE_URL}/tours/voucher/${reference}`;
    const formattedDate = tourDate
      ? new Date(tourDate + "T00:00:00").toLocaleDateString("en-PH", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        })
      : "";
    const amountPaid = booking.total_amount_cents > 0
      ? `₱${(booking.total_amount_cents / 100).toLocaleString()}`
      : "Negotiable";

    await sendViaGmail({
      to: booking.customer_email,
      subject: `✅ Booking Confirmed — ${reference} | Travela Siargao`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif;">

  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0c7b93,#0f766e);padding:32px 24px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🏝️</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">Booking Confirmed!</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your tour is all set. See you on the island!</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px;">

      <p style="margin:0 0 20px;color:#374151;font-size:15px;">
        Hi <strong>${booking.customer_name}</strong>, your payment has been verified and your tour booking is confirmed. 🎉
      </p>

      <!-- Booking summary box -->
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="color:#6b7280;padding:5px 0;width:40%;">Reference</td>
            <td style="color:#065f46;font-weight:800;font-family:monospace;font-size:15px;">${reference}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Tour</td>
            <td style="color:#134e4a;font-weight:700;">${tourTitle}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Date</td>
            <td style="color:#134e4a;font-weight:700;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Departure</td>
            <td style="color:#134e4a;font-weight:700;">${departure}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Guests</td>
            <td style="color:#134e4a;font-weight:700;">${booking.total_pax}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:5px 0;">Amount Paid</td>
            <td style="color:#059669;font-weight:800;font-size:16px;">${amountPaid}</td>
          </tr>
        </table>
      </div>

      <!-- QR Voucher CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#374151;font-size:14px;">Your QR voucher is ready. Show it to your guide on tour day.</p>
        <a href="${voucherUrl}"
          style="display:inline-block;background:#0c7b93;color:#ffffff;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
          🎫 View My Voucher
        </a>
      </div>

      <!-- Reminders -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-weight:800;color:#92400e;font-size:14px;">📋 Reminders</p>
        <ul style="margin:0;padding-left:18px;color:#78350f;font-size:13px;line-height:1.8;">
          <li>Be at the meeting point <strong>15 minutes before</strong> departure</li>
          <li>Bring sunscreen, water, and a change of clothes</li>
          <li>Show your QR code to your guide upon arrival</li>
        </ul>
      </div>

      <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">
        Questions? Message us on Facebook or call <strong>0946 365 7331</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        Travela Siargao · Booking, ticketing &amp; ferry schedules<br>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#0c7b93;text-decoration:none;">travelasiargao.gabrielsacro.com</a>
      </p>
    </div>

  </div>
</body>
</html>
      `,
    });
  }

  return NextResponse.redirect(
    new URL(`/admin/tours/bookings?status=confirmed&confirmed=${reference}`, request.url),
    { status: 303 }
  );
}