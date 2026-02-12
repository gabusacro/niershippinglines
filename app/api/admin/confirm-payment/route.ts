import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { sendBookingConfirmed } from "@/lib/email/send-booking-confirmed";
import { NextRequest, NextResponse } from "next/server";

/** POST: Admin-only. Set booking status to confirmed (payment received). Notifies passenger by email. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = (body as Record<string, unknown>).reference;
  if (!reference || typeof reference !== "string" || !reference.trim()) {
    return NextResponse.json({ error: "Missing or invalid reference" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, customer_email, notify_also_email, total_amount_cents, trip_id")
    .eq("reference", reference.trim())
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "pending_payment") {
    return NextResponse.json({ error: "Booking is not pending payment" }, { status: 400 });
  }

  let snapshot: { trip_snapshot_vessel_name?: string; trip_snapshot_route_name?: string; trip_snapshot_departure_date?: string; trip_snapshot_departure_time?: string } = {};
  const tripId = (booking as { trip_id?: string }).trip_id;
  if (tripId) {
    const { data: trip } = await supabase
      .from("trips")
      .select("departure_date, departure_time, boat:boats(name), route:routes(display_name)")
      .eq("id", tripId)
      .single();
    const t = trip as { departure_date?: string; departure_time?: string; boat?: { name?: string } | null; route?: { display_name?: string } | null } | null;
    if (t) {
      snapshot = {
        trip_snapshot_vessel_name: t.boat?.name ?? null,
        trip_snapshot_route_name: t.route?.display_name ?? null,
        trip_snapshot_departure_date: t.departure_date ?? null,
        trip_snapshot_departure_time: t.departure_time ?? null,
      };
    }
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString(), ...snapshot })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const to = (booking as { customer_email?: string }).customer_email?.trim();
  const notifyAlso = (booking as { notify_also_email?: string | null }).notify_also_email?.trim();
  const totalCents = (booking as { total_amount_cents?: number }).total_amount_cents ?? 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  const ticketsUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/bookings/${reference.trim()}/tickets` : undefined;
  const confirmedParams = { reference: reference.trim(), totalAmountCents: totalCents, ticketsUrl };
  if (to) {
    sendBookingConfirmed({ to, ...confirmedParams }).catch((err) =>
      console.error("[confirm-payment] email (main) failed:", err)
    );
  }
  if (notifyAlso && notifyAlso !== to) {
    sendBookingConfirmed({ to: notifyAlso, ...confirmedParams }).catch((err) =>
      console.error("[confirm-payment] email (also notify) failed:", err)
    );
  }

  return NextResponse.json({ message: "Payment confirmed. Passenger notified.", reference: reference.trim(), status: "confirmed" });
}
