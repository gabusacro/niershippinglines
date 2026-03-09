import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return "TRV-TOUR-" + random;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "tour_operator")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const formData = await request.formData();

    const schedule_id    = formData.get("schedule_id") as string;
    const tour_id        = formData.get("tour_id") as string;
    const booking_type   = formData.get("booking_type") as string;
    const customer_name  = formData.get("customer_name") as string;
    const customer_email = formData.get("customer_email") as string;
    const customer_phone = formData.get("customer_phone") as string;
    const total_pax      = parseInt(formData.get("total_pax") as string) || 1;
    const unit_price_cents  = parseInt(formData.get("unit_price_cents") as string) || 0;
    const total_amount_cents = parseInt(formData.get("total_amount_cents") as string) || 0;
    const health_declaration_accepted = formData.get("health_declaration_accepted") === "true";

    // Parse passengers JSON
    const passengersRaw = formData.get("passengers") as string;
    let passengers: Array<{
      full_name: string;
      birthdate: string;
      age: number;
      address: string;
      contact_number: string;
      emergency_contact_name: string;
      emergency_contact_number: string;
    }> = [];
    try {
      passengers = JSON.parse(passengersRaw || "[]");
    } catch {
      return NextResponse.redirect(
        new URL("/admin/tours/manual-booking?error=Invalid+passenger+data", request.url)
      );
    }

    if (!schedule_id || !tour_id || !customer_name || passengers.length === 0) {
      return NextResponse.redirect(
        new URL("/admin/tours/manual-booking?error=Missing+required+fields", request.url)
      );
    }

    const supabase = await createClient();

    // Generate unique reference
    let reference = generateReference();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("tour_bookings")
        .select("id")
        .eq("reference", reference)
        .single();
      if (!existing) break;
      reference = generateReference();
      attempts++;
    }

    // Fetch schedule + tour snapshot data
    const { data: schedule } = await supabase
      .from("tour_schedules")
      .select("available_date, departure_time")
      .eq("id", schedule_id)
      .single();

    const { data: tour } = await supabase
      .from("tour_packages")
      .select("title, pickup_time_label")
      .eq("id", tour_id)
      .single();

    // Insert booking — immediately paid + confirmed (walk-in cash)
    const { data: booking, error: bookingError } = await supabase
      .from("tour_bookings")
      .insert({
        reference,
        schedule_id,
        tour_id,
        booking_type,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        total_pax,
        unit_price_cents,
        total_amount_cents,
        subtotal_cents: total_amount_cents,
        admin_fee_cents: 0,
        gcash_fee_cents: 0,
        discount_cents: 0,
        payment_method: "cash",
        payment_status: "verified",
        status: "confirmed",
        is_walk_in: true,
        booking_source: "walk_in",
        health_declaration_accepted,
        health_declaration_accepted_at: health_declaration_accepted
          ? new Date().toISOString()
          : null,
        paid_at: new Date().toISOString(),
        payment_verified_by: user.id,
        payment_verified_at: new Date().toISOString(),
        // Snapshots
        tour_snapshot_title: tour?.title ?? null,
        tour_snapshot_date: schedule?.available_date ?? null,
        tour_snapshot_time: schedule?.departure_time ?? null,
        tour_snapshot_price_cents: unit_price_cents,
        tour_snapshot_booking_type: booking_type,
        booked_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("Walk-in booking insert error:", bookingError);
      return NextResponse.redirect(
        new URL(
          "/admin/tours/manual-booking?error=" + encodeURIComponent(bookingError?.message ?? "Insert failed"),
          request.url
        )
      );
    }

    // Insert passengers
    const passengerRows = passengers.map((p, i) => ({
      booking_id: booking.id,
      passenger_number: i + 1,
      full_name: p.full_name,
      birthdate: p.birthdate || null,
      age: p.age || null,
      address: p.address || null,
      contact_number: p.contact_number || null,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_number: p.emergency_contact_number || null,
      fare_type: "adult",
      fare_cents: unit_price_cents,
    }));

    const { error: passengerError } = await supabase
      .from("tour_booking_passengers")
      .insert(passengerRows);

    if (passengerError) {
      console.error("Passenger insert error:", passengerError);
    }

    // Update slot counts — simple direct update, no RPC needed
    if (booking_type === "joiner") {
      const { data: sched } = await supabase
        .from("tour_schedules")
        .select("joiner_slots_booked")
        .eq("id", schedule_id)
        .single();
      if (sched) {
        await supabase
          .from("tour_schedules")
          .update({
            joiner_slots_booked: (sched.joiner_slots_booked ?? 0) + total_pax,
          })
          .eq("id", schedule_id);
      }
    } else if (booking_type === "private") {
      const { data: sched } = await supabase
        .from("tour_schedules")
        .select("private_slots_booked")
        .eq("id", schedule_id)
        .single();
      if (sched) {
        await supabase
          .from("tour_schedules")
          .update({
            private_slots_booked: (sched.private_slots_booked ?? 0) + 1,
          })
          .eq("id", schedule_id);
      }
    }

    // Log the event
    await supabase.from("tour_booking_logs").insert({
      booking_id: booking.id,
      event_type: "walk_in_created",
      performed_by: user.id,
      notes: "Walk-in booking created and confirmed by " + user.role,
      metadata: { booking_source: "walk_in", created_by_role: user.role },
    });

    return NextResponse.redirect(
      new URL(
        "/admin/tours/bookings/" + booking.id + "?walkin=success",
        request.url
      ),
      { status: 303 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Walk-in route error:", message);
    return NextResponse.redirect(
      new URL(
        "/admin/tours/manual-booking?error=" + encodeURIComponent(message),
        request.url
      )
    );
  }
}