import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "parking_owner", "parking_crew"];
  if (!allowed.includes(user.role as string))
    return NextResponse.json({ error: "Only parking staff can check vehicles in/out." }, { status: 403 });

  let body: { booking_id: string; action: "check_in" | "check_out" };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { booking_id, action } = body;
  if (!booking_id || !["check_in", "check_out"].includes(action))
    return NextResponse.json({ error: "booking_id and action (check_in or check_out) are required." }, { status: 400 });

  const supabase = await createClient();

  // Fetch booking
  const { data: booking } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, lot_id, checked_in_at, checked_out_at, park_date_end, vehicle_count")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // Crew must be assigned to this lot
  if ((user.role as string) === "parking_crew") {
    const { data: crewAssign } = await supabase
      .from("parking_lot_crew")
      .select("id")
      .eq("lot_id", booking.lot_id)
      .eq("crew_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!crewAssign)
      return NextResponse.json({ error: "You are not assigned to this lot." }, { status: 403 });
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown> = { updated_at: now };
  let eventType = "";
  let logNotes  = "";

  if (action === "check_in") {
    if (booking.status !== "confirmed")
      return NextResponse.json({ error: "Only confirmed bookings can be checked in." }, { status: 409 });
    if (booking.checked_in_at)
      return NextResponse.json({ error: "This booking is already checked in." }, { status: 409 });
    update = { ...update, status: "checked_in", checked_in_at: now, checked_in_by: user.id };
    eventType = "checked_in";
    logNotes  = `Vehicle checked in by ${user.role}. Reference: ${booking.reference}.`;

  } else {
    // check_out
    if (!["checked_in", "overstay"].includes(booking.status))
      return NextResponse.json({ error: "Only checked-in vehicles can be checked out." }, { status: 409 });
    if (booking.checked_out_at)
      return NextResponse.json({ error: "This booking is already checked out." }, { status: 409 });

    // Check for overstay
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const isOverstay = today > booking.park_date_end;
    const overstayDays = isOverstay
      ? Math.ceil((new Date(today).getTime() - new Date(booking.park_date_end).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    update = {
      ...update,
      status: "completed",
      checked_out_at: now,
      checked_out_by: user.id,
    };
    if (isOverstay) {
      update.overstay_days = overstayDays;
      // Overstay fee calculated server-side — rate not stored directly, use 250/day default
      // Admin should review and set exact fee
    }
    eventType = "checked_out";
    logNotes  = `Vehicle checked out by ${user.role}.${isOverstay ? ` Overstay: ${overstayDays} day(s).` : ""} Reference: ${booking.reference}.`;
  }

  const { error: updateErr } = await supabase
    .from("parking_reservations")
    .update(update)
    .eq("id", booking_id);

  if (updateErr) {
    console.error("[crew/checkin] update error:", updateErr);
    return NextResponse.json({ error: "Failed to update booking." }, { status: 500 });
  }

  await supabase.from("parking_reservation_logs").insert({
    reservation_id: booking_id,
    event_type:     eventType,
    performed_by:   user.id,
    notes:          logNotes,
    metadata:       { action, performed_by_role: user.role },
  });

  return NextResponse.json({ ok: true });
}
