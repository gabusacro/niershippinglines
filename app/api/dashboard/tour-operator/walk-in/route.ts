import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const tour_id       = formData.get("tour_id") as string;
  const schedule_id   = formData.get("schedule_id") as string;
  const booking_type  = formData.get("booking_type") as string;
  const customer_name = formData.get("customer_name") as string;
  const customer_email = formData.get("customer_email") as string;
  const customer_phone = formData.get("customer_phone") as string;
  const health_declaration = formData.get("health_declaration_accepted") === "true";
  const notes         = formData.get("notes") as string;
  const passengersRaw = formData.get("passengers") as string;

  if (!tour_id || !schedule_id || !booking_type || !customer_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let passengers: Array<Record<string, string>> = [];
  try {
    passengers = JSON.parse(passengersRaw);
  } catch {
    return NextResponse.json({ error: "Invalid passengers data" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get tour package for pricing
  const { data: tour } = await supabase
    .from("tour_packages")
    .select("joiner_price_cents, private_price_cents")
    .eq("id", tour_id)
    .single();

  if (!tour) return NextResponse.json({ error: "Tour not found" }, { status: 404 });

  const pricePerPax = booking_type === "joiner"
    ? (tour.joiner_price_cents ?? 0)
    : (tour.private_price_cents ?? 0);

  const totalAmountCents = pricePerPax * passengers.length;

  // Generate reference
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const refSuffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const reference = `TRV-TOUR-${refSuffix}`;

  // Create booking — assigned to this operator, walk-in, payment already collected
  const { data: booking, error: bookingError } = await supabase
    .from("tour_bookings")
    .insert({
      reference,
      tour_id,
      schedule_id,
      booking_type,
      booking_source: "walk_in",
      is_walk_in: true,
      customer_name,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      health_declaration_accepted: health_declaration,
      health_declaration_accepted_at: health_declaration ? new Date().toISOString() : null,
      total_pax: passengers.length,
      total_amount_cents: totalAmountCents,
      payment_status: "verified",
      payment_verified_at: new Date().toISOString(),
      payment_verified_by: user.id,
      status: "confirmed",
      notes: notes || null,
      booked_by: user.id,
      tour_operator_id: user.id,
    })
    .select("id, reference")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: bookingError?.message ?? "Failed to create booking" }, { status: 500 });
  }

  // Insert passengers
  if (passengers.length > 0) {
    const passengerInserts = passengers.map((p, i) => ({
      booking_id: booking.id,
      passenger_number: i + 1,
      full_name: p.full_name,
      birthdate: p.birthdate || null,
      age: p.age ? parseInt(p.age) : null,
      address: p.address || null,
      contact_number: p.contact_number || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_number: p.emergency_contact_number || null,
    }));

    await supabase.from("tour_booking_passengers").insert(passengerInserts);
  }

  return NextResponse.json({ success: true, reference: booking.reference });
}
