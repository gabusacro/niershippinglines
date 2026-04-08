import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/** POST: Admin confirms reschedule fee paid → THEN applies the trip change. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { change_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const changeId = (body.change_id ?? "").trim();
  if (!changeId) return NextResponse.json({ error: "Missing change_id" }, { status: 400 });

  const adminClient = createAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Service unavailable" }, { status: 500 });

  // Fetch the booking_change record
  const { data: change, error: fetchErr } = await adminClient
    .from("booking_changes")
    .select("id, booking_id, from_trip_id, to_trip_id, additional_fee_cents, status, pending_snapshot")
    .eq("id", changeId)
    .single();

  if (fetchErr || !change) return NextResponse.json({ error: "Reschedule record not found" }, { status: 404 });
  if (change.status === "confirmed") return NextResponse.json({ error: "Already confirmed" }, { status: 400 });

  const snap = change.pending_snapshot as {
    trip_snapshot_vessel_name?: string | null;
    trip_snapshot_route_name?: string | null;
    trip_snapshot_departure_date?: string | null;
    trip_snapshot_departure_time?: string | null;
    new_total_cents?: number;
    is_walk_in?: boolean;
    old_booked?: number;
    new_booked?: number;
    passenger_count?: number;
  } | null;

  if (!snap) return NextResponse.json({ error: "Missing snapshot data — cannot apply trip change" }, { status: 400 });

  const bookedCol = snap.is_walk_in ? "walk_in_booked" : "online_booked";
  const now = new Date().toISOString();

  // 1. Update booking: apply new trip + snapshot + new total
  const { error: bookingErr } = await adminClient
    .from("bookings")
    .update({
      trip_id: change.to_trip_id,
      total_amount_cents: snap.new_total_cents,
      trip_snapshot_vessel_name: snap.trip_snapshot_vessel_name,
      trip_snapshot_route_name: snap.trip_snapshot_route_name,
      trip_snapshot_departure_date: snap.trip_snapshot_departure_date,
      trip_snapshot_departure_time: snap.trip_snapshot_departure_time,
      updated_at: now,
    })
    .eq("id", change.booking_id);

  if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });

  // 2. Decrement old trip seat count
  await adminClient
    .from("trips")
    .update({
      [bookedCol]: Math.max(0, (snap.old_booked ?? 0) - (snap.passenger_count ?? 1)),
      updated_at: now,
    } as Record<string, unknown>)
    .eq("id", change.from_trip_id);

  // 3. Increment new trip seat count
  await adminClient
    .from("trips")
    .update({
      [bookedCol]: (snap.new_booked ?? 0) + (snap.passenger_count ?? 1),
      updated_at: now,
    } as Record<string, unknown>)
    .eq("id", change.to_trip_id);

  // 4. Mark booking_change as confirmed + fee paid
  const { error: updateErr } = await adminClient
    .from("booking_changes")
    .update({
      fee_paid: true,
      fee_paid_at: now,
      fee_confirmed_by: user.id,
      status: "confirmed",
    })
    .eq("id", changeId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Reschedule confirmed and trip updated." });
}
