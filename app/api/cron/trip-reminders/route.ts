/**
 * Vercel Cron Job — Trip Reminder Emails
 * Runs every hour via vercel.json cron config.
 * Sends reminders at ~24h and ~6h before departure (Philippine Time).
 *
 * Protected by CRON_SECRET env variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTripReminder } from "@/lib/email/send-trip-reminder";

// Philippine Time is UTC+8
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function getNowPH(): Date {
  return new Date(Date.now() + PH_OFFSET_MS);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Verify cron secret so only Vercel can call this
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client not available" }, { status: 500 });
  }

  const nowPH = getNowPH();
  const nowMs = nowPH.getTime();

  // We look for trips departing in 22–26h (24h window) and 4–8h (6h window)
  const window24hStart = new Date(nowMs + 22 * 60 * 60 * 1000);
  const window24hEnd   = new Date(nowMs + 26 * 60 * 60 * 1000);
  const window6hStart  = new Date(nowMs +  4 * 60 * 60 * 1000);
  const window6hEnd    = new Date(nowMs +  8 * 60 * 60 * 1000);

  // Fetch confirmed bookings with trip + route info
  // Only bookings that haven't had their reminder sent yet
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id,
      reference,
      customer_full_name,
      customer_email,
      passenger_count,
      reminder_24h_sent_at,
      reminder_6h_sent_at,
      trip:trips!bookings_trip_id_fkey (
        departure_date,
        departure_time,
        route:routes ( display_name, origin, destination )
      )
    `)
    .eq("status", "confirmed")
    .or("reminder_24h_sent_at.is.null,reminder_6h_sent_at.is.null");

  if (error) {
    console.error("[trip-reminders] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders to send" });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const booking of bookings) {
    const trip = (booking.trip as unknown) as {
      departure_date: string;
      departure_time: string;
      route: { display_name: string; origin: string; destination: string };
    } | null;


    if (!trip?.departure_date || !trip?.departure_time) continue;

    // Build departure datetime in PH time
    const [hh, mm] = trip.departure_time.split(":").map(Number);
    const depPH = new Date(trip.departure_date + "T00:00:00");
    depPH.setHours(hh, mm, 0, 0);
    const depMs = depPH.getTime();

    // ── 24h reminder ──────────────────────────────────────────────────────
    if (
      !booking.reminder_24h_sent_at &&
      depMs >= window24hStart.getTime() &&
      depMs <= window24hEnd.getTime()
    ) {
      try {
        const ok = await sendTripReminder({
          to: booking.customer_email,
          customerName: booking.customer_full_name,
          reference: booking.reference,
          routeName: trip.route.display_name,
          origin: trip.route.origin,
          destination: trip.route.destination,
          departureDate: trip.departure_date,
          departureTime: trip.departure_time,
          passengerCount: booking.passenger_count,
          reminderType: "24h",
        });
        if (ok) {
          await supabase
            .from("bookings")
            .update({ reminder_24h_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          sent++;
        }
      } catch (e) {
        errors.push(`24h reminder failed for ${booking.reference}: ${e}`);
      }
    }

    // ── 6h reminder ───────────────────────────────────────────────────────
    if (
      !booking.reminder_6h_sent_at &&
      depMs >= window6hStart.getTime() &&
      depMs <= window6hEnd.getTime()
    ) {
      try {
        const ok = await sendTripReminder({
          to: booking.customer_email,
          customerName: booking.customer_full_name,
          reference: booking.reference,
          routeName: trip.route.display_name,
          origin: trip.route.origin,
          destination: trip.route.destination,
          departureDate: trip.departure_date,
          departureTime: trip.departure_time,
          passengerCount: booking.passenger_count,
          reminderType: "6h",
        });
        if (ok) {
          await supabase
            .from("bookings")
            .update({ reminder_6h_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          sent++;
        }
      } catch (e) {
        errors.push(`6h reminder failed for ${booking.reference}: ${e}`);
      }
    }
  }

  console.log(`[trip-reminders] sent=${sent} errors=${errors.length}`);
  return NextResponse.json({ sent, errors });
}
