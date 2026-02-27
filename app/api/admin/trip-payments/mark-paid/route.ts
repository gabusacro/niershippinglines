import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/trip-payments/mark-paid
 * Admin marks a trip's fare as paid to the vessel owner.
 */
export async function POST(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    trip_id?: string;
    payment_method?: string;
    payment_reference?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trip_id, payment_method = "manual", payment_reference } = body;
  if (!trip_id) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  const supabase = await createClient();
  const db = createAdminClient() ?? supabase;

  // Get trip details
  const { data: trip, error: tripErr } = await db
    .from("trips")
    .select("id, boat_id, departure_date")
    .eq("id", trip_id)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Get vessel assignment for this boat
  const { data: assignment } = await db
    .from("vessel_assignments")
    .select("vessel_owner_id, patronage_bonus_percent")
    .eq("boat_id", trip.boat_id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "No vessel owner assigned to this boat" }, { status: 400 });
  }

  // Get booking totals for this trip
  const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];
  const { data: bookings } = await db
    .from("bookings")
    .select("total_amount_cents, admin_fee_cents, gcash_fee_cents, passenger_count")
    .eq("trip_id", trip_id)
    .in("status", PAYMENT_STATUSES);

  let grossFareCents = 0;
  let platformFeeCents = 0;
  let paymentProcessingCents = 0;

  for (const b of bookings ?? []) {
    grossFareCents += b.total_amount_cents ?? 0;
    platformFeeCents += b.admin_fee_cents ?? 0;
    paymentProcessingCents += b.gcash_fee_cents ?? 0;
  }

  const netPayoutCents = grossFareCents - platformFeeCents - paymentProcessingCents;

  // Upsert payment record
  const { error: upsertErr } = await db
    .from("trip_fare_payments")
    .upsert({
      trip_id,
      boat_id: trip.boat_id,
      vessel_owner_id: assignment.vessel_owner_id,
      gross_fare_cents: grossFareCents,
      platform_fee_cents: platformFeeCents,
      payment_processing_cents: paymentProcessingCents,
      net_payout_cents: netPayoutCents,
      status: "paid",
      payment_method,
      payment_reference: payment_reference?.trim() || null,
      paid_at: new Date().toISOString(),
      paid_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "trip_id" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    gross_fare_cents: grossFareCents,
    net_payout_cents: netPayoutCents,
    message: `Trip marked as paid. Net payout: ₱${(netPayoutCents / 100).toFixed(0)}`,
  });
}

/**
 * DELETE /api/admin/trip-payments/mark-paid
 * Undo a payment mark (revert to pending).
 */
export async function DELETE(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trip_id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.trip_id) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  const supabase = await createClient();
  const db = createAdminClient() ?? supabase;

  const { error } = await db
    .from("trip_fare_payments")
    .update({ status: "pending", paid_at: null, paid_by: null, payment_reference: null, updated_at: new Date().toISOString() })
    .eq("trip_id", body.trip_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Payment reverted to pending." });
}
