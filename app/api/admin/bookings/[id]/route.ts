import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** PATCH: Reassign booking to another trip. Admin only. Updates trip inventory. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { trip_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const newTripId = body.trip_id?.trim();
  if (!newTripId) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, trip_id, passenger_count, is_walk_in, status")
    .eq("id", id)
    .single();
  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.trip_id === newTripId) return NextResponse.json({ error: "Booking is already on this trip" }, { status: 400 });
  if (!["confirmed", "checked_in", "boarded", "pending_payment"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot reassign cancelled or refunded booking" }, { status: 400 });
  }

  const { data: newTrip, error: tripErr } = await supabase
    .from("trips")
    .select("id, online_quota, online_booked, walk_in_quota, walk_in_booked")
    .eq("id", newTripId)
    .single();
  if (tripErr || !newTrip) return NextResponse.json({ error: "Target trip not found" }, { status: 404 });

  const col = booking.is_walk_in ? "walk_in_booked" : "online_booked";
  const quotaCol = booking.is_walk_in ? "walk_in_quota" : "online_quota";
  const currentBooked = (newTrip as Record<string, number>)[col] ?? 0;
  const quota = (newTrip as Record<string, number>)[quotaCol] ?? 0;
  if (currentBooked + booking.passenger_count > quota) {
    return NextResponse.json({ error: `Target trip has no room: ${quota - currentBooked} seats left, need ${booking.passenger_count}` }, { status: 400 });
  }

  const oldTripId = booking.trip_id;

  const { data: oldTrip } = await supabase.from("trips").select(booking.is_walk_in ? "walk_in_booked" : "online_booked").eq("id", oldTripId).single();
  const oldBooked = (oldTrip as Record<string, number>)?.[booking.is_walk_in ? "walk_in_booked" : "online_booked"] ?? 0;

  const { error: upErr } = await supabase
    .from("bookings")
    .update({ trip_id: newTripId })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await supabase
    .from("trips")
    .update({
      [booking.is_walk_in ? "walk_in_booked" : "online_booked"]: Math.max(0, oldBooked - booking.passenger_count),
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", oldTripId);

  await supabase
    .from("trips")
    .update({
      [booking.is_walk_in ? "walk_in_booked" : "online_booked"]: currentBooked + booking.passenger_count,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", newTripId);

  return NextResponse.json({ ok: true, message: "Booking reassigned" });
}
