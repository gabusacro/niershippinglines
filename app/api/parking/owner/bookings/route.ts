import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.role as string;
  if (!["admin", "parking_owner"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const lot_id = searchParams.get("lot_id");
  const start  = searchParams.get("start");
  const end    = searchParams.get("end");

  if (!lot_id) return NextResponse.json({ error: "lot_id required" }, { status: 400 });

  const supabase = await createClient();

  // Verify owner owns this lot (skip for admin)
  if (role === "parking_owner") {
    const { data: lot } = await supabase
      .from("parking_lots")
      .select("owner_id")
      .eq("id", lot_id)
      .maybeSingle();
    if (lot?.owner_id !== user.id)
      return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  // ── 1. Fetch bookings ──────────────────────────────────────────────────────
  let query = supabase
    .from("parking_reservations")
    .select(`
      id, reference, status,
      park_date_start, park_date_end, total_days,
      vehicle_count, vehicles,
      customer_full_name,
parking_fee_cents, commission_cents,
platform_fee_cents, processing_fee_cents,
total_amount_cents, owner_receivable_cents,
      payment_proof_path, gcash_transaction_reference,
      checked_in_at, checked_out_at, checked_in_by
    `)

    
    .eq("lot_id", lot_id)
    .not("status", "in", '("cancelled")')
    .order("park_date_start", { ascending: false });

  // Always show active bookings regardless of date range
  if (start && end) {
    query = query.or(
      `and(park_date_start.lte.${end},park_date_end.gte.${start}),status.in.(confirmed,checked_in,overstay,pending_payment)`
    );
  }

  const { data: reservations, error } = await query;
  if (error) {
    console.error("[owner/bookings] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (reservations ?? []).map((b) => ({
    ...b,
    checked_in_by_name: null,
  }));

  // ── 2. Fetch pending extensions for this lot ───────────────────────────────
  // Get reservation IDs for this lot so we can filter extensions
  const { data: allLotReservations } = await supabase
    .from("parking_reservations")
    .select("id, reference")
    .eq("lot_id", lot_id);

  const lotReservationIds = (allLotReservations ?? []).map((r) => r.id);

  let pendingExtensions: {
    id: string;
    reference: string;
    reservation_id: string;
    reservation_reference: string;
    customer_full_name: string;
    additional_days: number;
    new_end_date: string;
    total_amount_cents: number;
    payment_status: string;
    created_at: string;
  }[] = [];

  if (lotReservationIds.length > 0) {
    const { data: extensions } = await supabase
      .from("parking_extensions")
      .select(`
        id, reference, reservation_id,
        additional_days, new_end_date,
        total_amount_cents, payment_status, created_at,
        reservation:parking_reservations(reference, customer_full_name)
      `)
      .in("reservation_id", lotReservationIds)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false });

 pendingExtensions = (extensions ?? []).map((e) => {
  const res = Array.isArray(e.reservation) ? e.reservation[0] : e.reservation;
  return {
    id: e.id,
    reference: e.reference,
    reservation_id: e.reservation_id,
    reservation_reference: (res as { reference?: string })?.reference ?? "",
    customer_full_name: (res as { customer_full_name?: string })?.customer_full_name ?? "",
    additional_days: e.additional_days,
    new_end_date: e.new_end_date,
    total_amount_cents: e.total_amount_cents,
    payment_status: e.payment_status,
    created_at: e.created_at,
  };
});
  }

  return NextResponse.json({ bookings, pendingExtensions });
}
