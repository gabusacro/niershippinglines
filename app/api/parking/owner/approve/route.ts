import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["parking_owner", "parking_crew"];
  if (!allowedRoles.includes(user.role as string))
    return NextResponse.json({ error: "Access denied." }, { status: 403 });

  let body: { reservation_id: string; action: "approve" | "reject"; notes?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { reservation_id, action, notes } = body;
  if (!reservation_id || !action)
    return NextResponse.json({ error: "reservation_id and action are required." }, { status: 400 });

  const supabase = await createClient();

  // Verify this reservation belongs to the owner's/crew's lot
  const { data: reservation } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, payment_status, lot_id")
    .eq("id", reservation_id)
    .maybeSingle();

  if (!reservation)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (reservation.status !== "pending_payment")
    return NextResponse.json({ error: "Only pending bookings can be approved or rejected." }, { status: 409 });

  // For parking_owner: verify they own this lot
  if (user.role === "parking_owner") {
    const { data: lot } = await supabase
      .from("parking_lots")
      .select("id")
      .eq("id", reservation.lot_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!lot)
      return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  // For parking_crew: verify they are assigned to this lot
  if (user.role === "parking_crew") {
    const { data: crew } = await supabase
      .from("parking_lot_crew")
      .select("id")
      .eq("lot_id", reservation.lot_id)
      .eq("crew_id", user.id)
      .maybeSingle();
    if (!crew)
      return NextResponse.json({ error: "You are not assigned to this lot." }, { status: 403 });
  }

  let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let eventType = "";
  let logNotes  = "";

  if (action === "approve") {
    update = {
      ...update,
      status: "confirmed",
      payment_status: "paid",
      payment_verified_by: user.id,
      payment_verified_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    };
    eventType = "payment_confirmed";
    logNotes  = `Booking approved and payment confirmed by ${user.role}.${notes ? ` Note: ${notes}` : ""}`;

  } else if (action === "reject") {
    update = { ...update, status: "cancelled" };
    eventType = "cancelled";
    logNotes  = `Booking rejected by ${user.role}.${notes ? ` Reason: ${notes}` : ""}`;
  }

  if (notes?.trim()) update.admin_notes = notes.trim();

  const { error: updateErr } = await supabase
    .from("parking_reservations")
    .update(update)
    .eq("id", reservation_id);

  if (updateErr)
    return NextResponse.json({ error: "Failed to update reservation." }, { status: 500 });

  await supabase.from("parking_reservation_logs").insert({
    reservation_id,
    event_type:   eventType,
    performed_by: user.id,
    notes:        logNotes,
    metadata:     { action, performed_by_role: user.role },
  });

  return NextResponse.json({ ok: true });
}