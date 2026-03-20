import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

type ExtendBody = {
  reservation_id:              string;
  additional_days:             number;
  gcash_proof_path:            string;
  gcash_transaction_reference: string | null;
};

function generateExtensionRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `TRV-PRK-EXT-${s}`;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ExtendBody;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const { reservation_id, additional_days, gcash_proof_path, gcash_transaction_reference } = body;

  if (!reservation_id)   return NextResponse.json({ error: "Missing reservation ID." }, { status: 400 });
  if (!additional_days || additional_days < 1)
    return NextResponse.json({ error: "Additional days must be at least 1." }, { status: 400 });
  if (!gcash_proof_path) return NextResponse.json({ error: "GCash screenshot is required." }, { status: 400 });

  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, customer_profile_id, park_date_end, total_days, rate_cents_per_vehicle_per_day, vehicle_count")
    .eq("id", reservation_id)
    .eq("customer_profile_id", user.id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!["confirmed", "checked_in"].includes(booking.status))
    return NextResponse.json({ error: "Only confirmed or checked-in bookings can be extended." }, { status: 409 });

  const { data: settings } = await supabase
    .from("parking_settings")
    .select("platform_fee_cents, max_parking_days")
    .eq("id", 1).maybeSingle();

  const platformFee  = settings?.platform_fee_cents ?? 3500;
  const maxDays      = settings?.max_parking_days   ?? 45;
  const newTotalDays = (booking.total_days ?? 0) + additional_days;

  if (newTotalDays > maxDays)
    return NextResponse.json({
      error: `Total stay cannot exceed ${maxDays} days. You can add at most ${maxDays - (booking.total_days ?? 0)} more days.`,
    }, { status: 400 });

  const ratePerVehiclePerDay = booking.rate_cents_per_vehicle_per_day ?? 25000;
  const vehicleCount         = booking.vehicle_count ?? 1;
  const parkingFee           = ratePerVehiclePerDay * vehicleCount * additional_days;
  const totalAmount          = parkingFee + platformFee;
  const newEndDate           = addDaysToDate(booking.park_date_end, additional_days);

  let reference = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateExtensionRef();
    const { data: existing } = await supabase
      .from("parking_extensions").select("reference").eq("reference", candidate).maybeSingle();
    if (!existing) { reference = candidate; break; }
  }
  if (!reference) return NextResponse.json({ error: "Could not generate reference." }, { status: 500 });

  const { data: extension, error: insertErr } = await supabase
    .from("parking_extensions")
    .insert({
      reservation_id,
      reference,
      additional_days,
      new_end_date:           newEndDate,
      parking_fee_cents:      parkingFee,
      platform_fee_cents:     platformFee,
      processing_fee_cents:   0,
      total_amount_cents:     totalAmount,
      owner_receivable_cents: parkingFee,
      payment_method:         "gcash",
      payment_status:         "pending",
      payment_proof_path:     gcash_proof_path,
      created_by:             user.id,
    })
    .select("id, reference")
    .single();

  if (insertErr || !extension) {
    console.error("[extend] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create extension. Please try again." }, { status: 500 });
  }

  // Update reservation dates right away — admin confirms payment separately
  await supabase.from("parking_reservations").update({
    park_date_end: newEndDate,
    total_days:    newTotalDays,
    updated_at:    new Date().toISOString(),
  }).eq("id", reservation_id);

  await supabase.from("parking_reservation_logs").insert({
    reservation_id,
    event_type:   "extended",
    performed_by: user.id,
    notes:        `Extension submitted. +${additional_days} day(s), new end: ${newEndDate}. Total: ₱${(totalAmount / 100).toLocaleString()}. Ref: ${reference}.`,
    metadata: { extension_id: extension.id, extension_ref: reference, additional_days, new_end_date: newEndDate, total_amount_cents: totalAmount, gcash_proof_path, gcash_ref: gcash_transaction_reference ?? null },
  });

  return NextResponse.json({ ok: true, reference, new_end_date: newEndDate });
}

