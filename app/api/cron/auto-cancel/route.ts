/**
 * /api/cron/auto-cancel
 * Finds bookings with status "pending_payment" older than 6 hours,
 * cancels them, restores seat quota, and sends a rebook email.
 *
 * Called every hour by cron-job.org (same setup as trip-reminders).
 * Protected by CRON_SECRET env variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingCancelled } from "@/lib/email/send-booking-cancelled";
import { getSiteBranding } from "@/lib/site-branding";

// Philippine Time is UTC+8
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function getNowPH(): Date {
  return new Date(Date.now() + PH_OFFSET_MS);
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client not available" }, { status: 500 });
  }

  // ── Find stale pending bookings ──────────────────────────────────────────
  // Cancel bookings that are still "pending_payment" after 6 hours
  const cutoffTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: staleBookings, error: fetchError } = await supabase
    .from("bookings")
    .select(`
      id,
      reference,
      status,
      customer_full_name,
      customer_email,
      passenger_count,
      total_amount_cents,
      created_at,
      trip_id,
      trip:trips!bookings_trip_id_fkey (
        id,
        departure_date,
        departure_time,
        online_booked,
        route:routes ( display_name, origin, destination )
      )
    `)
    .eq("status", "pending_payment")
    .lt("created_at", cutoffTime)
    .is("cancelled_at", null); // not already cancelled

  if (fetchError) {
    console.error("[auto-cancel] fetch error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!staleBookings || staleBookings.length === 0) {
    return NextResponse.json({ cancelled: 0, message: "No stale bookings found" });
  }

  const branding = await getSiteBranding().catch(() => null);
  const siteUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://travelasiargao.com";

  let cancelled = 0;
  const errors: string[] = [];

  for (const booking of staleBookings) {
    try {
const tripRaw = Array.isArray(booking.trip) ? booking.trip[0] : booking.trip;
const trip = tripRaw as unknown as {
  id: string;
  departure_date: string;
  departure_time: string;
  online_booked: number;
  route: { display_name: string; origin: string; destination: string; } | null;
} | null;

      // ── 1. Update booking status to cancelled ──────────────────────────
      const { error: cancelError } = await supabase
        .from("bookings")
        .update({
          status:         "cancelled",
          cancelled_at:   new Date().toISOString(),
          cancel_reason:  "Auto-cancelled: no payment received within 6 hours",
          auto_cancelled: true,
          updated_at:     new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("status", "pending_payment"); // double-check — prevent race condition

      if (cancelError) {
        errors.push(`${booking.reference}: cancel error — ${cancelError.message}`);
        continue;
      }

      // ── 2. Restore online_booked seat count on the trip ────────────────
      if (trip?.id) {
        const passengerCount = booking.passenger_count ?? 1;
        const currentBooked  = trip.online_booked ?? 0;
        const newBooked      = Math.max(0, currentBooked - passengerCount);

        const { error: seatError } = await supabase
          .from("trips")
          .update({ online_booked: newBooked, updated_at: new Date().toISOString() })
          .eq("id", trip.id);

        if (seatError) {
          // Non-fatal — log but continue
          console.error(`[auto-cancel] seat restore error for trip ${trip.id}:`, seatError.message);
        }
      }

      // ── 3. Send cancellation + rebook email ────────────────────────────
      if (booking.customer_email) {
        const reBookUrl = `${siteUrl}/schedule?rebook=${encodeURIComponent(booking.reference)}`;

        await sendBookingCancelled(
          {
            to:               booking.customer_email,
            customerName:     booking.customer_full_name ?? "Passenger",
            reference:        booking.reference,
            routeName:        trip?.route?.display_name ?? "Siargao Ferry",
            origin:           trip?.route?.origin       ?? "",
            destination:      trip?.route?.destination  ?? "",
            departureDate:    trip?.departure_date       ?? "",
            departureTime:    trip?.departure_time       ?? "",
            passengerCount:   booking.passenger_count    ?? 1,
            totalAmountCents: booking.total_amount_cents ?? 0,
            reBookUrl,
          },
          branding!,
        ).catch((emailErr: Error) => {
          // Non-fatal — booking is already cancelled, just log
          console.error(`[auto-cancel] email error for ${booking.reference}:`, emailErr.message);
        });
      }

      cancelled++;
      console.log(`[auto-cancel] Cancelled booking ${booking.reference} (created ${booking.created_at})`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${booking.reference}: ${msg}`);
      console.error(`[auto-cancel] unexpected error for ${booking.reference}:`, msg);
    }
  }

  return NextResponse.json({
    cancelled,
    errors,
    checked: staleBookings.length,
    message: `Cancelled ${cancelled} of ${staleBookings.length} stale bookings`,
  });
}
