import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// GET — list reservations with filters
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const status   = searchParams.get("status") ?? "pending_payment";
  const lot_id   = searchParams.get("lot_id");
  const search   = searchParams.get("search") ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit    = 20;
  const offset   = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("parking_reservations")
    .select(`
      id, reference, status, payment_status, payment_proof_path,
      gcash_transaction_reference, park_date_start, park_date_end,
      total_days, vehicle_count, vehicles, total_amount_cents,
      parking_fee_cents, platform_fee_cents, processing_fee_cents,
      lot_snapshot_name, lot_snapshot_distance,
      customer_full_name, customer_email, customer_mobile,
      admin_notes, created_at, checked_in_at, checked_out_at,
      overstay_days, overstay_fee_cents,
      lot_id
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Status filter — "all" shows everything
  if (status !== "all") query = query.eq("status", status);
  if (lot_id)           query = query.eq("lot_id", lot_id);
  if (search.trim()) {
    query = query.or(
      `reference.ilike.%${search}%,customer_full_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reservations: data ?? [], total: count ?? 0, page, limit });
}

// POST — approve, reject, or add notes
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reservation_id: string; action: string; notes?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { reservation_id, action, notes } = body;
  if (!reservation_id || !action)
    return NextResponse.json({ error: "reservation_id and action are required." }, { status: 400 });

  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, payment_status")
    .eq("id", reservation_id)
    .maybeSingle();

  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let eventType = "";
  let logNotes  = "";

  if (action === "approve") {
    if (reservation.status !== "pending_payment")
      return NextResponse.json({ error: "Only pending bookings can be approved." }, { status: 409 });
    update = { ...update, status: "confirmed", payment_status: "paid", payment_verified_by: user.id, payment_verified_at: new Date().toISOString(), paid_at: new Date().toISOString() };
    eventType = "payment_confirmed";
    logNotes  = `Booking approved and payment confirmed by admin.${notes ? ` Note: ${notes}` : ""}`;

  } else if (action === "reject") {
    if (!["pending_payment"].includes(reservation.status))
      return NextResponse.json({ error: "Only pending bookings can be rejected." }, { status: 409 });
    update = { ...update, status: "cancelled" };
    eventType = "cancelled";
    logNotes  = `Booking rejected by admin.${notes ? ` Reason: ${notes}` : ""}`;

  } else if (action === "notes") {
    if (!notes?.trim())
      return NextResponse.json({ error: "Notes cannot be empty." }, { status: 400 });
    update = { ...update, admin_notes: notes.trim() };
    eventType = "admin_note_added";
    logNotes  = `Admin note added: ${notes.trim()}`;

  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  if (notes?.trim() && action !== "notes") {
    update.admin_notes = notes.trim();
  }

  const { error: updateErr } = await supabase
    .from("parking_reservations")
    .update(update)
    .eq("id", reservation_id);

  if (updateErr) {
    console.error("[admin/reservations] update error:", updateErr);
    return NextResponse.json({ error: "Failed to update reservation." }, { status: 500 });
  }

  await supabase.from("parking_reservation_logs").insert({
    reservation_id,
    event_type:   eventType,
    performed_by: user.id,
    notes:        logNotes,
    metadata:     { action, admin_id: user.id },
  });

  return NextResponse.json({ ok: true });
}
