import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { isDepartureAtLeast24HoursFromNow } from "@/lib/admin/ph-time";
import { RESCHEDULE_FEE_PERCENT, RESCHEDULE_GCASH_FEE_CENTS } from "@/lib/constants";

/** POST: Passenger requests reschedule to another trip. 24h rule + 10% + ₱15 fee. */
export async function POST(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reference?: string; trip_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reference = (body.reference ?? "").trim().toUpperCase();
  const newTripId = (body.trip_id ?? "").trim();
  if (!reference || !newTripId) return NextResponse.json({ error: "Missing reference or trip_id" }, { status: 400 });

  const supabase = await createClient();
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .select("id, trip_id, passenger_count, is_walk_in, status, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .eq("reference", reference)
    .ilike("customer_email", email)
    .maybeSingle();

  if (bookErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!["confirmed", "checked_in", "boarded", "pending_payment"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot reschedule this booking" }, { status: 400 });
  }
  if (booking.trip_id === newTripId) return NextResponse.json({ error: "Already on this trip" }, { status: 400 });

  const oldTripId = booking.trip_id;
  if (!oldTripId) return NextResponse.json({ error: "Booking has no trip" }, { status: 400 });

  const { data: oldTrip, error: oldTripErr } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_booked, walk_in_booked")
    .eq("id", oldTripId)
    .single();
  if (oldTripErr || !oldTrip)
    return NextResponse.json({ error: "Current trip not found" }, { status: 404 });

  if (!isDepartureAtLeast24HoursFromNow(oldTrip.departure_date ?? "", oldTrip.departure_time ?? "")) {
    return NextResponse.json(
      { error: "Reschedule only allowed at least 24 hours before departure." },
      { status: 400 }
    );
  }

  const { data: newTrip, error: tripErr } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(name), route:routes(display_name)")
    .eq("id", newTripId)
    .single();
  if (tripErr || !newTrip)
    return NextResponse.json({ error: "Target trip not found or no longer available" }, { status: 404 });

  const col = (booking as { is_walk_in?: boolean }).is_walk_in ? "walk_in_booked" : "online_booked";
  const quotaCol = (booking as { is_walk_in?: boolean }).is_walk_in ? "walk_in_quota" : "online_quota";
  const currentBooked = (newTrip as Record<string, number>)[col] ?? 0;
  const quota = (newTrip as Record<string, number>)[quotaCol] ?? 0;
  if (currentBooked + booking.passenger_count > quota) {
    return NextResponse.json(
      { error: `Trip has no room: ${quota - currentBooked} seats left, need ${booking.passenger_count}` },
      { status: 400 }
    );
  }

  const totalCents = (booking as { total_amount_cents?: number }).total_amount_cents ?? 0;
  const adminFee = (booking as { admin_fee_cents?: number }).admin_fee_cents ?? 0;
  const gcashFee = (booking as { gcash_fee_cents?: number }).gcash_fee_cents ?? 0;
  const fareCents = Math.max(0, totalCents - adminFee - gcashFee);
  const rescheduleFeeCents = Math.round(fareCents * (RESCHEDULE_FEE_PERCENT / 100)) + RESCHEDULE_GCASH_FEE_CENTS;
  const newTotalCents = totalCents + rescheduleFeeCents;

  const boat = newTrip.boat as { name?: string } | null;
  const route = newTrip.route as { display_name?: string } | null;
  const snapshot = {
    trip_snapshot_vessel_name: boat?.name ?? null,
    trip_snapshot_route_name: route?.display_name ?? null,
    trip_snapshot_departure_date: newTrip.departure_date ?? null,
    trip_snapshot_departure_time: newTrip.departure_time ?? null,
  };

  const adminClient = createAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Service unavailable" }, { status: 500 });

  const { error: changeErr } = await adminClient.from("booking_changes").insert({
    booking_id: booking.id,
    from_trip_id: oldTripId,
    to_trip_id: newTripId,
    additional_fee_cents: rescheduleFeeCents,
    changed_by: user.id,
  });
  if (changeErr) return NextResponse.json({ error: changeErr.message }, { status: 500 });

  const { error: upErr } = await adminClient
    .from("bookings")
    .update({
      trip_id: newTripId,
      total_amount_cents: newTotalCents,
      ...snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const oldBooked =
    (oldTrip as Record<string, number>)?.[(booking as { is_walk_in?: boolean }).is_walk_in ? "walk_in_booked" : "online_booked"] ?? 0;

  await adminClient
    .from("trips")
    .update({
      [(booking as { is_walk_in?: boolean }).is_walk_in ? "walk_in_booked" : "online_booked"]: Math.max(
        0,
        oldBooked - booking.passenger_count
      ),
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", oldTripId);

  await adminClient
    .from("trips")
    .update({
      [(booking as { is_walk_in?: boolean }).is_walk_in ? "walk_in_booked" : "online_booked"]:
        currentBooked + booking.passenger_count,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", newTripId);

  return NextResponse.json({
    ok: true,
    message: "Booking rescheduled. 10% reschedule fee + ₱15 GCash fee applies. Pay the difference (₱" + (rescheduleFeeCents / 100).toFixed(0) + ") at the ticket booth before boarding.",
    additional_fee_cents: rescheduleFeeCents,
    new_total_cents: newTotalCents,
  });
}
