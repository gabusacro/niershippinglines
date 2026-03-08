import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return `TRV-TOUR-${ref}`;
}

function calculateAge(birthdate: string): number {
  if (!birthdate) return 0;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? age : 0;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const supabase = await createClient();
  const formData = await request.formData();

  // DEBUG: log all form keys and values
  const allKeys: string[] = [];
  formData.forEach((value, key) => {
    if (key !== "gcash_screenshot") allKeys.push(`${key}=${value}`);
  });
  console.log("📋 FORM DATA KEYS:", allKeys.join(" | "));

  // ── Core booking fields ──────────────────────────────────
  const tour_id      = formData.get("tour_id") as string;
  const schedule_id  = formData.get("schedule_id") as string;
  const booking_type = formData.get("booking_type") as string;
  const total_pax    = parseInt(formData.get("total_pax") as string) || 1;
  const total_amount_cents = parseInt(formData.get("total_amount_cents") as string) || 0;
  const customer_name  = formData.get("customer_name") as string;
  const customer_email = formData.get("customer_email") as string;
  const customer_phone = formData.get("customer_phone") as string;
  const health_declaration_accepted = formData.get("health_declaration_accepted") === "true";

  console.log(`📊 total_pax=${total_pax} booking_type=${booking_type} total_amount_cents=${total_amount_cents}`);

  // ── Upload GCash screenshot ──────────────────────────────
  const gcashFile = formData.get("gcash_screenshot") as File | null;
  let gcash_screenshot_url: string | null = null;

  if (gcashFile && gcashFile.size > 0) {
    const ext = gcashFile.name.split(".").pop();
    const filename = `tours/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await gcashFile.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filename, buffer, { contentType: gcashFile.type, upsert: false });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filename);
      gcash_screenshot_url = urlData.publicUrl;
    }
  }

  // ── Create tour booking ──────────────────────────────────
  const reference = generateReference();

  const { data: booking, error: bookingError } = await supabase
    .from("tour_bookings")
    .insert({
      reference,
      tour_id,
      schedule_id: schedule_id || null,
      booked_by: user.id,
      booking_type,
      total_pax,
      total_amount_cents,
      customer_name,
      customer_email,
      customer_phone,
      health_declaration_accepted,
      health_declaration_accepted_at: health_declaration_accepted ? new Date().toISOString() : null,
      gcash_screenshot_url,
      payment_status: "pending",
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    console.error("Tour booking insert error:", bookingError);
    return NextResponse.redirect(
      new URL(`/tours/${tour_id}?error=booking_failed`, request.url),
      { status: 303 }
    );
  }

  // ── Update slot counters ──────────────────────────────────
  if (schedule_id) {
    if (booking_type === "joiner") {
      await supabase.rpc("increment_tour_joiner_slots", {
        p_schedule_id: schedule_id,
        p_count: total_pax,
      });
    } else if (booking_type === "private") {
      await supabase.rpc("increment_tour_private_slots", {
        p_schedule_id: schedule_id,
      });
    }
  }

  // ── Save passenger manifest ───────────────────────────────
  const passengerFields = [
    "full_name", "address", "birthdate", "age",
    "contact_number", "emergency_contact_name", "emergency_contact_number"
  ];

  const passengersToInsert = [];

  for (let i = 0; i < total_pax; i++) {
    const passenger: Record<string, string | number | null> = {};
    let hasData = false;

    for (const field of passengerFields) {
      const value = formData.get(`passengers[${i}][${field}]`) as string;
      passenger[field] = value || "";
      if (value) hasData = true;
    }

    console.log(`👤 Passenger ${i}: hasData=${hasData} name=${passenger.full_name}`);

    if (hasData) {
      const age = passenger.birthdate
        ? calculateAge(passenger.birthdate as string)
        : 0;

      passengersToInsert.push({
        booking_id: booking.id,
        passenger_number: i + 1,
        full_name: passenger.full_name as string,
        address: passenger.address as string,
        birthdate: passenger.birthdate as string || null,
        age,
        contact_number: passenger.contact_number as string,
        emergency_contact_name: passenger.emergency_contact_name as string,
        emergency_contact_number: passenger.emergency_contact_number as string,
        linked_profile_id: i === 0 ? user.id : null,
      });
    }
  }

  console.log(`🧑 PASSENGERS TO INSERT: ${passengersToInsert.length}`);

  if (passengersToInsert.length > 0) {
    const { error: passengersError } = await supabase
      .from("tour_booking_passengers")
      .insert(passengersToInsert);

    if (passengersError) {
      console.error("Tour passengers insert error:", JSON.stringify(passengersError));
    } else {
      console.log("✅ PASSENGERS SAVED:", passengersToInsert.length);
    }
  }

  // ── Redirect to confirmation ──────────────────────────────
  return NextResponse.redirect(
    new URL(`/tours/confirmation?ref=${reference}`, request.url),
    { status: 303 }
  );
}
