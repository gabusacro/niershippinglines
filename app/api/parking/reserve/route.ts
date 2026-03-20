import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

type VehiclePayload = {
  vehicle_type:     "car" | "motorcycle" | "van";
  plate_number:     string;
  make_model:       string | null;
  color:            string | null;
  or_cr_number:     string;
  driver_id_type:   string;
  driver_id_number: string;
  or_cr_path:       string | null;
  id_photo_path:    string | null;
};

type ReserveBody = {
  lot_id:                      string;
  vehicles:                    VehiclePayload[];
  park_date_start:             string;
  total_days:                  number;
  gcash_proof_path:            string;
  gcash_transaction_reference: string | null;
};

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

function getTodayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

  let body: ReserveBody;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const { lot_id, vehicles, park_date_start, total_days, gcash_proof_path, gcash_transaction_reference } = body;

  if (!lot_id || !Array.isArray(vehicles) || vehicles.length === 0)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  if (!park_date_start || !/^\d{4}-\d{2}-\d{2}$/.test(park_date_start))
    return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  if (park_date_start < getTodayManila())
    return NextResponse.json({ error: "Start date cannot be in the past." }, { status: 400 });
  if (!total_days || total_days < 1)
    return NextResponse.json({ error: "Total days must be at least 1." }, { status: 400 });
  if (!gcash_proof_path)
    return NextResponse.json({ error: "GCash payment screenshot is required." }, { status: 400 });

  for (const [i, v] of vehicles.entries()) {
    const n = i + 1;
    if (!["car","motorcycle","van"].includes(v.vehicle_type))
      return NextResponse.json({ error: `Vehicle ${n}: invalid type.` }, { status: 400 });
    if (!v.plate_number?.trim())
      return NextResponse.json({ error: `Vehicle ${n}: plate number required.` }, { status: 400 });
    if (!v.or_cr_number?.trim())
      return NextResponse.json({ error: `Vehicle ${n}: OR/CR number required.` }, { status: 400 });
    if (!v.driver_id_number?.trim())
      return NextResponse.json({ error: `Vehicle ${n}: ID number required.` }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("parking_lots")
    .select("id, name, address, distance_from_port, is_active, accepts_car, accepts_motorcycle, accepts_van, car_rate_cents, motorcycle_rate_cents, van_rate_cents")
    .eq("id", lot_id).eq("is_active", true).maybeSingle();

  if (!lot) return NextResponse.json({ error: "Parking lot not found or unavailable." }, { status: 404 });

  for (const [i, v] of vehicles.entries()) {
    const n = i + 1;
    if (v.vehicle_type === "car"        && !lot.accepts_car)        return NextResponse.json({ error: `Vehicle ${n}: lot does not accept cars.` },        { status: 400 });
    if (v.vehicle_type === "motorcycle" && !lot.accepts_motorcycle) return NextResponse.json({ error: `Vehicle ${n}: lot does not accept motorcycles.` }, { status: 400 });
    if (v.vehicle_type === "van"        && !lot.accepts_van)        return NextResponse.json({ error: `Vehicle ${n}: lot does not accept vans.` },         { status: 400 });
  }

  const { data: settings } = await supabase
    .from("parking_settings")
    .select("default_car_rate_cents, default_motorcycle_rate_cents, default_van_rate_cents, commission_per_vehicle_cents, platform_fee_cents, processing_fee_cents, max_parking_days")
    .eq("id", 1).maybeSingle();

  const maxDays          = settings?.max_parking_days             ?? 45;
  const commissionPerVeh = settings?.commission_per_vehicle_cents ?? 10000;
  const platformFee      = settings?.platform_fee_cents           ?? 3500;
  const processingFee    = settings?.processing_fee_cents         ?? 3000;
  const defaultCarRate   = settings?.default_car_rate_cents        ?? 25000;
  const defaultMotoRate  = settings?.default_motorcycle_rate_cents ?? 25000;
  const defaultVanRate   = settings?.default_van_rate_cents        ?? null;

  if (total_days > maxDays)
    return NextResponse.json({ error: `Maximum parking duration is ${maxDays} days.` }, { status: 400 });

  const { data: avail } = await supabase
    .from("parking_slot_availability")
    .select("booked_car, booked_motorcycle, booked_van, total_slots_car, total_slots_motorcycle, total_slots_van")
    .eq("lot_id", lot_id).maybeSingle();

  if (avail) {
    const reqCar  = vehicles.filter(v => v.vehicle_type === "car").length;
    const reqMoto = vehicles.filter(v => v.vehicle_type === "motorcycle").length;
    const reqVan  = vehicles.filter(v => v.vehicle_type === "van").length;
    const avCar   = avail.total_slots_car        - (avail.booked_car        ?? 0);
    const avMoto  = avail.total_slots_motorcycle - (avail.booked_motorcycle ?? 0);
    const avVan   = avail.total_slots_van        - (avail.booked_van        ?? 0);
    if (reqCar  > avCar)  return NextResponse.json({ error: `Only ${avCar} confirmed car slot(s) available.` },        { status: 409 });
    if (reqMoto > avMoto) return NextResponse.json({ error: `Only ${avMoto} confirmed motorcycle slot(s) available.` }, { status: 409 });
    if (reqVan  > avVan)  return NextResponse.json({ error: `Only ${avVan} confirmed van slot(s) available.` },         { status: 409 });
  }

  const lotCarRate  = lot.car_rate_cents        ?? defaultCarRate;
  const lotMotoRate = lot.motorcycle_rate_cents ?? defaultMotoRate;
  const lotVanRate  = lot.van_rate_cents        ?? defaultVanRate ?? defaultCarRate;

  function rateFor(type: string): number {
    if (type === "car")        return lotCarRate;
    if (type === "motorcycle") return lotMotoRate;
    if (type === "van")        return lotVanRate;
    return lotCarRate;
  }

  const parkingFee      = vehicles.reduce((s, v) => s + rateFor(v.vehicle_type) * total_days, 0);
  const commission      = commissionPerVeh * vehicles.length;
  const totalAmount     = parkingFee + platformFee + processingFee;
  const ownerReceivable = parkingFee - commission;
  const parkDateEnd     = addDays(park_date_start, total_days);

  let reference = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReference();
    const { data: existing } = await supabase
      .from("parking_reservations").select("reference").eq("reference", candidate).maybeSingle();
    if (!existing) { reference = candidate; break; }
  }
  if (!reference)
    return NextResponse.json({ error: "Could not generate reference. Please try again." }, { status: 500 });

  // Use user.fullName (camelCase) — matches what getAuthUser() returns
  const customerName = user.fullName?.trim() || user.email;

  const { data: booking, error: insertErr } = await supabase
    .from("parking_reservations")
    .insert({
      reference,
      lot_id,
      customer_profile_id:         user.id,
      customer_full_name:          customerName,
      customer_email:              user.email,
      customer_mobile:             null,   // not collected at booking time
      vehicles: vehicles.map(v => ({
        vehicle_type:     v.vehicle_type,
        plate_number:     v.plate_number.toUpperCase(),
        make_model:       v.make_model   ?? null,
        color:            v.color        ?? null,
        or_cr_number:     v.or_cr_number,
        driver_id_type:   v.driver_id_type,
        driver_id_number: v.driver_id_number,
        or_cr_path:       v.or_cr_path   ?? null,
        id_photo_path:    v.id_photo_path ?? null,
      })),
      vehicle_count:               vehicles.length,
      park_date_start,
      park_date_end:               parkDateEnd,
      total_days,
      rate_cents_per_vehicle_per_day: rateFor(vehicles[0].vehicle_type),
      parking_fee_cents:           parkingFee,
      commission_cents:            commission,
      platform_fee_cents:          platformFee,
      processing_fee_cents:        processingFee,
      total_amount_cents:          totalAmount,
      owner_receivable_cents:      ownerReceivable,
      payment_method:              "gcash",
      payment_status:              "pending",
      payment_proof_path:          gcash_proof_path,
      gcash_transaction_reference: gcash_transaction_reference ?? null,
      status:                      "pending_payment",
      lot_snapshot_name:           lot.name,
      lot_snapshot_address:        lot.address,
      lot_snapshot_distance:       lot.distance_from_port ?? null,
      rate_snapshot_label:         `₱${(rateFor(vehicles[0].vehicle_type) / 100).toLocaleString()}/day`,
      created_by:                  user.id,
    })
    .select("id, reference")
    .single();

  if (insertErr || !booking) {
    console.error("[reserve] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create booking. Please try again." }, { status: 500 });
  }

  await supabase.from("parking_reservation_logs").insert({
    reservation_id: booking.id,
    event_type:     "created",
    performed_by:   user.id,
    notes:          `Booking submitted with GCash proof. ${vehicles.length} vehicle(s), ${total_days} day(s). Total: ₱${(totalAmount / 100).toLocaleString()}.`,
    metadata: {
      vehicles:           vehicles.map(v => ({ plate: v.plate_number, type: v.vehicle_type })),
      park_date_start,
      park_date_end:      parkDateEnd,
      total_days,
      total_amount_cents: totalAmount,
      gcash_proof_path,
      gcash_ref:          gcash_transaction_reference ?? null,
    },
  });

  return NextResponse.json({ reference: booking.reference, id: booking.id });
}

