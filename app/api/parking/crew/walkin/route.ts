import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `TRV-PRK-${s}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "parking_owner", "parking_crew"];
  if (!allowed.includes(user.role as string))
    return NextResponse.json({ error: "Only parking staff can create walk-ins." }, { status: 403 });

  let body: { lot_id: string; plate_number: string; vehicle_type: string; total_days: number; payment_method: "cash" };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { lot_id, plate_number, vehicle_type, total_days, payment_method } = body;

  if (!lot_id || !plate_number?.trim() || !vehicle_type || !total_days)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  if (!["car", "motorcycle", "van"].includes(vehicle_type))
    return NextResponse.json({ error: "Invalid vehicle type." }, { status: 400 });
  if (total_days < 1 || total_days > 45)
    return NextResponse.json({ error: "Days must be between 1 and 45." }, { status: 400 });

  const supabase = await createClient();

  // Verify crew is assigned to this lot
  if ((user.role as string) === "parking_crew") {
    const { data: assign } = await supabase.from("parking_lot_crew").select("id").eq("lot_id", lot_id).eq("crew_id", user.id).eq("is_active", true).maybeSingle();
    if (!assign) return NextResponse.json({ error: "You are not assigned to this lot." }, { status: 403 });
  }

  // Get lot + settings
  const [{ data: lot }, { data: settings }] = await Promise.all([
    supabase.from("parking_lots").select("id, name, address, distance_from_port, car_rate_cents, motorcycle_rate_cents, van_rate_cents").eq("id", lot_id).eq("is_active", true).maybeSingle(),
    supabase.from("parking_settings").select("default_car_rate_cents, default_motorcycle_rate_cents, platform_fee_cents, processing_fee_cents, commission_per_vehicle_cents").eq("id", 1).maybeSingle(),
  ]);

  if (!lot) return NextResponse.json({ error: "Lot not found." }, { status: 404 });

  const defaultCarRate   = settings?.default_car_rate_cents        ?? 25000;
  const defaultMotoRate  = settings?.default_motorcycle_rate_cents ?? 25000;
  const platformFee      = settings?.platform_fee_cents            ?? 0;   // no platform fee for cash walk-in
  const processingFee    = 0;                                               // no processing fee for cash
  const commissionPerVeh = settings?.commission_per_vehicle_cents  ?? 10000;

  function rateFor(type: string): number {
    if (type === "car")        return lot!.car_rate_cents        ?? defaultCarRate;
    if (type === "motorcycle") return lot!.motorcycle_rate_cents ?? defaultMotoRate;
    return lot!.car_rate_cents ?? defaultCarRate;
  }

  const today        = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const parkDateEnd  = addDays(today, total_days);
  const parkingFee   = rateFor(vehicle_type) * total_days;
  const commission   = commissionPerVeh;
  const totalAmount  = parkingFee; // cash walk-in: no platform/processing fee charged separately
  const ownerReceivable = parkingFee - commission;

  // Generate unique reference
  let reference = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReference();
    const { data: existing } = await supabase.from("parking_reservations").select("reference").eq("reference", candidate).maybeSingle();
    if (!existing) { reference = candidate; break; }
  }
  if (!reference) return NextResponse.json({ error: "Could not generate reference." }, { status: 500 });

  const { data: booking, error: insertErr } = await supabase
    .from("parking_reservations")
    .insert({
      reference,
      lot_id,
      customer_profile_id:  null,
      customer_full_name:   `Walk-in · ${plate_number.toUpperCase()}`,
      customer_email:       null,
      customer_mobile:      null,
      vehicles: [{
        vehicle_type,
        plate_number: plate_number.toUpperCase(),
        make_model:   null, color: null,
        or_cr_number: "walk-in", driver_id_type: "other", driver_id_number: "walk-in",
        or_cr_path: null, id_photo_path: null,
      }],
      vehicle_count:               1,
      park_date_start:             today,
      park_date_end:               parkDateEnd,
      total_days,
      rate_cents_per_vehicle_per_day: rateFor(vehicle_type),
      parking_fee_cents:           parkingFee,
      commission_cents:            commission,
      platform_fee_cents:          0,
      processing_fee_cents:        0,
      total_amount_cents:          totalAmount,
      owner_receivable_cents:      ownerReceivable,
      payment_method:              payment_method ?? "cash",
      payment_status:              "paid",      // cash collected on spot
      status:                      "checked_in", // immediately checked in
      checked_in_at:               new Date().toISOString(),
      checked_in_by:               user.id,
      lot_snapshot_name:           lot.name,
      lot_snapshot_address:        lot.address,
      lot_snapshot_distance:       lot.distance_from_port ?? null,
      rate_snapshot_label:         `₱${(rateFor(vehicle_type) / 100).toLocaleString()}/day`,
      is_walk_in:                  true,
      created_by:                  user.id,
    })
    .select("id, reference")
    .single();

  if (insertErr || !booking) {
    console.error("[crew/walkin] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create walk-in booking." }, { status: 500 });
  }

  await supabase.from("parking_reservation_logs").insert({
    reservation_id: booking.id,
    event_type:     "created",
    performed_by:   user.id,
    notes:          `Cash walk-in created by ${user.role}. Plate: ${plate_number.toUpperCase()}. ${total_days} day(s). Total: ₱${(totalAmount / 100).toLocaleString()}.`,
    metadata:       { plate_number, vehicle_type, total_days, payment_method, is_walk_in: true },
  });

  return NextResponse.json({ ok: true, reference: booking.reference, id: booking.id });
}
