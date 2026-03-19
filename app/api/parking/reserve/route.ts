import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

function generateParkingRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `TRV-PRK-${rand}`;
}

export async function POST(request: NextRequest) {
  // Must be logged in
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "You must be logged in to reserve parking." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { lot_id, vehicles, park_date_start, total_days } = body as {
    lot_id: string;
    vehicles: {
      vehicle_type: string;
      plate_number: string;
      make_model?: string;
      color?: string;
      or_cr_number: string;
      driver_id_type: string;
      driver_id_number: string;
    }[];
    park_date_start: string;
    total_days: number;
  };

  if (!lot_id)                       return NextResponse.json({ error: "Parking lot is required." }, { status: 400 });
  if (!vehicles?.length)             return NextResponse.json({ error: "At least one vehicle is required." }, { status: 400 });
  if (!park_date_start)              return NextResponse.json({ error: "Start date is required." }, { status: 400 });
  if (!total_days || total_days < 1) return NextResponse.json({ error: "Duration must be at least 1 day." }, { status: 400 });

  for (const [i, v] of vehicles.entries()) {
    if (!v.plate_number?.trim())    return NextResponse.json({ error: `Vehicle ${i + 1}: plate number is required.` }, { status: 400 });
    if (!v.or_cr_number?.trim())    return NextResponse.json({ error: `Vehicle ${i + 1}: OR/CR number is required.` }, { status: 400 });
    if (!v.driver_id_number?.trim()) return NextResponse.json({ error: `Vehicle ${i + 1}: ID number is required.` }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch lot
  const { data: lot } = await supabase
    .from("parking_lots")
    .select("id, name, address, distance_from_port, car_rate_cents, motorcycle_rate_cents, van_rate_cents, truck_rate_cents, total_slots_car, total_slots_motorcycle, total_slots_van, total_slots_truck")
    .eq("id", lot_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!lot) return NextResponse.json({ error: "Parking lot not found." }, { status: 404 });

  // Fetch settings for rates + fees
  const { data: settingsRow } = await supabase
    .from("parking_settings")
    .select("default_car_rate_cents, default_motorcycle_rate_cents, default_van_rate_cents, default_truck_rate_cents, commission_per_vehicle_cents, platform_fee_cents, processing_fee_cents, max_parking_days")
    .eq("id", 1)
    .maybeSingle();

  const maxDays          = settingsRow?.max_parking_days            ?? 45;
  const commissionPerVeh = settingsRow?.commission_per_vehicle_cents ?? 10000;
  const platformFee      = settingsRow?.platform_fee_cents           ?? 3500;
  const processingFee    = settingsRow?.processing_fee_cents         ?? 3000;

  const days = Math.max(1, Math.min(maxDays, total_days));

  // Compute rate per vehicle — lot and settingsRow are confirmed non-null by this point
  const defaultCar        = settingsRow?.default_car_rate_cents        ?? 25000;
  const defaultMotorcycle = settingsRow?.default_motorcycle_rate_cents ?? 25000;
  const defaultVan        = settingsRow?.default_van_rate_cents        ?? 25000;
  const defaultTruck      = settingsRow?.default_truck_rate_cents      ?? 25000;

  function rateForType(type: string): number {
    if (type === "car")        return (lot!.car_rate_cents        ?? defaultCar);
    if (type === "motorcycle") return (lot!.motorcycle_rate_cents ?? defaultMotorcycle);
    if (type === "van")        return (lot!.van_rate_cents        ?? defaultVan);
    if (type === "truck")      return (lot!.truck_rate_cents      ?? defaultTruck);
    return defaultCar;
  }

  // Check slot availability per vehicle type
  const { data: avail } = await supabase
    .from("parking_slot_availability")
    .select("booked_car, booked_motorcycle, booked_van, booked_truck")
    .eq("lot_id", lot_id)
    .maybeSingle();

  const availCar        = (lot.total_slots_car        ?? 0) - (avail?.booked_car        ?? 0);
  const availMotorcycle = (lot.total_slots_motorcycle ?? 0) - (avail?.booked_motorcycle ?? 0);
  const availVan        = (lot.total_slots_van        ?? 0) - (avail?.booked_van        ?? 0);
  const availTruck      = (lot.total_slots_truck      ?? 0) - (avail?.booked_truck      ?? 0);

  // Count how many of each type requested
  const reqCar        = vehicles.filter(v => v.vehicle_type === "car").length;
  const reqMotorcycle = vehicles.filter(v => v.vehicle_type === "motorcycle").length;
  const reqVan        = vehicles.filter(v => v.vehicle_type === "van").length;
  const reqTruck      = vehicles.filter(v => v.vehicle_type === "truck").length;

  if (reqCar        > availCar)        return NextResponse.json({ error: `Only ${availCar} car slot(s) available.` }, { status: 409 });
  if (reqMotorcycle > availMotorcycle) return NextResponse.json({ error: `Only ${availMotorcycle} motorcycle slot(s) available.` }, { status: 409 });
  if (reqVan        > availVan)        return NextResponse.json({ error: `Only ${availVan} van slot(s) available.` }, { status: 409 });
  if (reqTruck      > availTruck)      return NextResponse.json({ error: `Only ${availTruck} truck slot(s) available.` }, { status: 409 });

  // Financials
  const parkingFee    = vehicles.reduce((sum, v) => sum + rateForType(v.vehicle_type) * days, 0);
  const commission    = commissionPerVeh * vehicles.length;
  const totalAmount   = parkingFee + platformFee + processingFee;
  const ownerReceivable = parkingFee - commission;
  const ratePerVehiclePerDay = rateForType(vehicles[0]?.vehicle_type ?? "car");

  // Compute end date
  const startDate = new Date(`${park_date_start}T00:00:00+08:00`);
  const endDate   = new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Generate unique reference
  let reference = generateParkingRef();
  for (let i = 0; i < 5; i++) {
    const { data: ex } = await supabase.from("parking_reservations").select("id").eq("reference", reference).maybeSingle();
    if (!ex) break;
    reference = generateParkingRef();
  }

  // Clean vehicles for JSONB storage
  const vehiclesJson = vehicles.map(v => ({
    vehicle_type:    v.vehicle_type,
    plate_number:    v.plate_number.trim().toUpperCase(),
    make_model:      v.make_model?.trim() || null,
    color:           v.color?.trim() || null,
    or_cr_number:    v.or_cr_number.trim(),
    driver_id_type:  v.driver_id_type,
    driver_id_number: v.driver_id_number.trim(),
    rate_cents_per_day: rateForType(v.vehicle_type),
  }));

  const { error: insertError } = await supabase
    .from("parking_reservations")
    .insert({
      reference,
      lot_id,
      customer_profile_id:   user.id,
      customer_full_name:    user.fullName ?? user.email ?? "—",
      customer_email:        user.email ?? "—",
      customer_mobile:       null,
      vehicles:              vehiclesJson,
      vehicle_count:         vehicles.length,
      park_date_start,
      park_date_end:         endDateStr,
      total_days:            days,
      rate_cents_per_vehicle_per_day: ratePerVehiclePerDay,
      parking_fee_cents:     parkingFee,
      commission_cents:      commission,
      platform_fee_cents:    platformFee,
      processing_fee_cents:  processingFee,
      total_amount_cents:    totalAmount,
      owner_receivable_cents: ownerReceivable,
      payment_method:        "gcash",
      payment_status:        "pending",
      status:                "pending_payment",
      lot_snapshot_name:     lot.name,
      lot_snapshot_address:  lot.address,
      lot_snapshot_distance: lot.distance_from_port,
      created_by:            user.id,
    });

  if (insertError) {
    console.error("[parking/reserve]", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Log the event
  await supabase.from("parking_reservation_logs").insert({
    reservation_id: (await supabase.from("parking_reservations").select("id").eq("reference", reference).maybeSingle()).data?.id,
    event_type:     "created",
    performed_by:   user.id,
    notes:          `Reservation created online. ${vehicles.length} vehicle(s), ${days} days.`,
  });

  return NextResponse.json({
    ok:        true,
    reference,
    total:     totalAmount,
    breakdown: {
      parking_fee:     parkingFee,
      commission:      commission,
      platform_fee:    platformFee,
      processing_fee:  processingFee,
      total:           totalAmount,
      owner_receives:  ownerReceivable,
    },
  });
}
