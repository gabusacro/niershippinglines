import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// GET — list all parking payouts for a lot
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const lot_id = searchParams.get("lot_id");

  const supabase = await createClient();

  // Fetch all confirmed/completed reservations for this lot
  let resQuery = supabase
    .from("parking_reservations")
    .select(`
      id, reference, status, customer_full_name,
      park_date_start, park_date_end, total_days,
      parking_fee_cents, commission_cents,
      platform_fee_cents, processing_fee_cents,
      owner_receivable_cents, total_amount_cents,
      payment_method, paid_at, lot_id,
      lot:parking_lots(owner_id, name)
    `)
    .in("status", ["confirmed", "checked_in", "overstay", "completed"])
    .not("payment_method", "eq", "cash")
    .order("created_at", { ascending: false });

  if (lot_id && lot_id !== "all") {
  resQuery = resQuery.eq("lot_id", lot_id);
}

  const { data: reservations, error: resErr } = await resQuery;
  if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 });

  // Fetch all paid extensions for this lot
let extQuery = supabase
  .from("parking_extensions")
  .select(`
    id, reference, reservation_id,
    additional_days, new_end_date,
    parking_fee_cents, platform_fee_cents,
    processing_fee_cents, owner_receivable_cents,
    total_amount_cents, paid_at,
    reservation:parking_reservations!inner(
      customer_full_name, lot_id,
      lot:parking_lots(owner_id, name)
    )
  `)
  .eq("payment_status", "paid")
  .order("created_at", { ascending: false });


  if (lot_id && lot_id !== "all") {
  extQuery = extQuery.eq("reservation.lot_id", lot_id);
}



  const { data: extensions, error: extErr } = await extQuery;
  if (extErr) return NextResponse.json({ error: extErr.message }, { status: 500 });

  // Fetch existing payouts
  const { data: payouts, error: payoutsErr } = await supabase
  .from("parking_payouts")
  .select("reservation_id, extension_id, payout_status, payment_reference, paid_at");

if (payoutsErr) {
  console.error("[parking payouts] fetch payouts error:", payoutsErr);
  return NextResponse.json({ error: payoutsErr.message }, { status: 500 });
}

  const paidReservationIds = new Set((payouts ?? []).filter(p => p.reservation_id && p.payout_status === "paid").map(p => p.reservation_id));
  const paidExtensionIds   = new Set((payouts ?? []).filter(p => p.extension_id   && p.payout_status === "paid").map(p => p.extension_id));

  // Build unified list
  const items = [
    ...(reservations ?? []).map(r => {
      const lot = Array.isArray(r.lot) ? r.lot[0] : r.lot;
      return {
        id: r.id,
        type: "reservation" as const,
        reference: r.reference,
        customer_full_name: r.customer_full_name,
        lot_name: (lot as { name?: string })?.name ?? "",
        owner_id: (lot as { owner_id?: string })?.owner_id ?? "",
        lot_id: r.lot_id,
        date: r.park_date_start,
        days: r.total_days,
        parking_fee_cents: r.parking_fee_cents,
        commission_cents: r.commission_cents,
        platform_fee_cents: r.platform_fee_cents,
        processing_fee_cents: r.processing_fee_cents,
        owner_receivable_cents: r.owner_receivable_cents,
        total_amount_cents: r.total_amount_cents,
        payout_status: paidReservationIds.has(r.id) ? "paid" : "pending",
        paid_at: payouts?.find(p => p.reservation_id === r.id)?.paid_at ?? null,
        payment_reference: payouts?.find(p => p.reservation_id === r.id)?.payment_reference ?? null,
      };
    }),
    ...(extensions ?? []).map(e => {
      const res = Array.isArray(e.reservation) ? e.reservation[0] : e.reservation;
      const lot = res ? (Array.isArray((res as { lot?: unknown }).lot) ? ((res as { lot?: unknown[] }).lot as unknown[])[0] : (res as { lot?: unknown }).lot) : null;
      return {
        id: e.id,
        type: "extension" as const,
        reference: e.reference,
        customer_full_name: (res as { customer_full_name?: string })?.customer_full_name ?? "",
        lot_name: (lot as { name?: string })?.name ?? "",
        owner_id: (lot as { owner_id?: string })?.owner_id ?? "",
        lot_id: (res as { lot_id?: string })?.lot_id ?? "",
        date: e.new_end_date,
        days: e.additional_days,
        parking_fee_cents: e.parking_fee_cents,
        commission_cents: 0,
        platform_fee_cents: e.platform_fee_cents,
        processing_fee_cents: e.processing_fee_cents,
        owner_receivable_cents: e.owner_receivable_cents,
        total_amount_cents: e.total_amount_cents,
        payout_status: paidExtensionIds.has(e.id) ? "paid" : "pending",
        paid_at: payouts?.find(p => p.extension_id === e.id)?.paid_at ?? null,
        payment_reference: payouts?.find(p => p.extension_id === e.id)?.payment_reference ?? null,
      };
    }),
  ];

  // Filter by lot_id if provided
  const filtered =
  lot_id && lot_id !== "all"
    ? items.filter(i => i.lot_id === lot_id)
    : items;

  return NextResponse.json({ items: filtered });
}

// POST — mark a reservation or extension as remitted to owner
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    type: "reservation" | "extension";
    id: string;
    payment_reference: string;
    payment_notes?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { type, id, payment_reference, payment_notes } = body;
  if (!type || !id || !payment_reference?.trim())
    return NextResponse.json({ error: "type, id, and payment_reference are required." }, { status: 400 });

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Get the transaction details
  let lotId = "", ownerId = "", reference = "";
  let parkingFeeCents = 0, commissionCents = 0, platformFeeCents = 0;
  let processingFeeCents = 0, ownerReceivableCents = 0;

  if (type === "reservation") {
    const { data: r } = await supabase
      .from("parking_reservations")
      .select("id, reference, lot_id, parking_fee_cents, commission_cents, platform_fee_cents, processing_fee_cents, owner_receivable_cents, lot:parking_lots(owner_id)")
      .eq("id", id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    const lot = Array.isArray(r.lot) ? r.lot[0] : r.lot;
    lotId = r.lot_id;
    ownerId = (lot as { owner_id?: string })?.owner_id ?? "";
    reference = r.reference;
    parkingFeeCents = r.parking_fee_cents;
    commissionCents = r.commission_cents;
    platformFeeCents = r.platform_fee_cents;
    processingFeeCents = r.processing_fee_cents;
    ownerReceivableCents = r.owner_receivable_cents;
  } else {
    const { data: e } = await supabase
      .from("parking_extensions")
      .select("id, reference, parking_fee_cents, platform_fee_cents, processing_fee_cents, owner_receivable_cents, reservation:parking_reservations!inner(lot_id, lot:parking_lots(owner_id))")
      .eq("id", id)
      .maybeSingle();
    if (!e) return NextResponse.json({ error: "Extension not found." }, { status: 404 });
    const res = Array.isArray(e.reservation) ? e.reservation[0] : e.reservation;
    const lot = res ? (Array.isArray((res as { lot?: unknown }).lot) ? ((res as { lot?: unknown[] }).lot as unknown[])[0] : (res as { lot?: unknown }).lot) : null;
    lotId = (res as { lot_id?: string })?.lot_id ?? "";
    ownerId = (lot as { owner_id?: string })?.owner_id ?? "";
    reference = e.reference;
    parkingFeeCents = e.parking_fee_cents;
    commissionCents = 0;
    platformFeeCents = e.platform_fee_cents;
    processingFeeCents = e.processing_fee_cents;
    ownerReceivableCents = e.owner_receivable_cents;
  }

  if (!ownerId) return NextResponse.json({ error: "Could not determine lot owner." }, { status: 400 });

  // Check if already paid
  let existingQuery = supabase
  .from("parking_payouts")
  .select("id");

if (type === "reservation") {
  existingQuery = existingQuery.eq("reservation_id", id);
} else {
  existingQuery = existingQuery.eq("extension_id", id);
}

const { data: existing, error: existingErr } = await existingQuery.maybeSingle();

if (existingErr) {
  console.error("[parking payouts] existing query error:", existingErr);
  return NextResponse.json({ error: existingErr.message }, { status: 500 });
}

  if (existing) {
  const { error: updateErr } = await supabase
    .from("parking_payouts")
    .update({
      payout_status: "paid",
      payment_reference: payment_reference.trim(),
      payment_notes: payment_notes?.trim() ?? null,
      paid_at: now,
      paid_by: user.id,
      updated_at: now,
    })
    .eq("id", existing.id);

  if (updateErr) {
    console.error("[parking payouts] update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
} else {
  const { error: insertErr } = await supabase
    .from("parking_payouts")
    .insert({
      lot_id: lotId,
      owner_id: ownerId,
      reservation_id: type === "reservation" ? id : null,
      extension_id: type === "extension" ? id : null,
      reference,
      transaction_type: type,
      parking_fee_cents: parkingFeeCents,
      commission_cents: commissionCents,
      platform_fee_cents: platformFeeCents,
      processing_fee_cents: processingFeeCents,
      owner_receivable_cents: ownerReceivableCents,
      payout_status: "paid",
      payment_reference: payment_reference.trim(),
      payment_notes: payment_notes?.trim() ?? null,
      paid_at: now,
      paid_by: user.id,
    });

  if (insertErr) {
    console.error("[parking payouts] insert error:", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
}

  return NextResponse.json({ ok: true });
}

// DELETE — unmark a payout (revert to pending)
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const id   = searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "type and id required." }, { status: 400 });

  const supabase = await createClient();
  let query = supabase
  .from("parking_payouts")
  .update({
    payout_status: "pending",
    paid_at: null,
    paid_by: null,
    payment_reference: null,
    payment_notes: null,
    updated_at: new Date().toISOString(),
  });
  if (type === "reservation") {
  query = query.eq("reservation_id", id);
} else {
  query = query.eq("extension_id", id);
}

const { error: deleteErr } = await query;

if (deleteErr) {
  console.error("[parking payouts] delete error:", deleteErr);
  return NextResponse.json({ error: deleteErr.message }, { status: 500 });
}

  return NextResponse.json({ ok: true });
}
