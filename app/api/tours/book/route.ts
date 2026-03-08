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
  const passengers_json = formData.get("passengers_json") as string;

  console.log("📊 total_pax=", total_pax, "booking_type=", booking_type);
  console.log("📋 passengers_json=", passengers_json);

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

  // ── Save passenger manifest from JSON ────────────────────
  try {
    const passengersRaw = JSON.parse(passengers_json || "[]") as Array<{
      full_name: string;
      address: string;
      birthdate: string;
      age: string;
      contact_number: string;
      emergency_contact_name: string;
      emergency_contact_number: string;
    }>;

    const passengersToInsert = passengersRaw
      .filter(p => p.full_name?.trim())
      .map((p, i) => ({
        booking_id: booking.id,
        passenger_number: i + 1,
        full_name: p.full_name.trim(),
        address: p.address?.trim() || "",
        birthdate: p.birthdate || null,
        age: p.birthdate ? calculateAge(p.birthdate) : (parseInt(p.age) || 0),
        contact_number: p.contact_number?.trim() || "",
        emergency_contact_name: p.emergency_contact_name?.trim() || "",
        emergency_contact_number: p.emergency_contact_number?.trim() || "",
        linked_profile_id: i === 0 ? user.id : null,
      }));

    console.log("🧑 PASSENGERS TO INSERT:", passengersToInsert.length);

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
  } catch (e) {
    console.error("Passengers JSON parse error:", e);
  }

  // ── Redirect to confirmation ──────────────────────────────
  return NextResponse.redirect(
    new URL(`/tours/confirmation?ref=${reference}`, request.url),
    { status: 303 }
  );
}
