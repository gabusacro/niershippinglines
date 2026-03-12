import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_guide") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reference, guide_id, action, today } = await request.json();
  if (!reference || !action) {
    return NextResponse.json({ error: "Missing reference or action" }, { status: 400 });
  }

  const validActions = ["picked_up", "on_tour", "dropped_off", "no_show"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = await createClient();

  // Find the booking
  const { data: booking, error: bookingError } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date), passengers:tour_booking_passengers(id, full_name, passenger_number)")
    .eq("reference", reference)
    .eq("status", "confirmed")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found or not confirmed" }, { status: 404 });
  }

  // Verify this guide is assigned to this booking via tour_batches
  const { data: batchBooking } = await supabase
    .from("tour_batch_bookings")
    .select("batch_id")
    .eq("booking_id", booking.id)
    .single();

  if (!batchBooking) {
    return NextResponse.json({ error: "This booking has no assigned batch yet" }, { status: 403 });
  }

  const { data: batch } = await supabase
    .from("tour_batches")
    .select("tour_guide_id")
    .eq("id", batchBooking.batch_id)
    .single();

  if (!batch || batch.tour_guide_id !== user.id) {
    return NextResponse.json({ error: "This booking is not assigned to you" }, { status: 403 });
  }


  const now = new Date().toISOString();
  const passengers = booking.passengers as Array<{ id: string; full_name: string }> ?? [];

  // Upsert tracking for all passengers in this booking
  for (const passenger of passengers) {
    const { data: existing } = await supabase
      .from("tour_passenger_tracking")
      .select("id, status")
      .eq("booking_id", booking.id)
      .eq("passenger_id", passenger.id)
      .eq("tour_guide_id", guide_id)
      .single();

    const updateData: Record<string, unknown> = {
      status: action,
      updated_at: now,
    };
    if (action === "picked_up")   updateData.picked_up_at = now;
    if (action === "on_tour")     updateData.on_tour_at = now;
    if (action === "dropped_off") updateData.dropped_off_at = now;
    if (action === "no_show")     updateData.no_show_at = now;

    if (existing) {
      await supabase
        .from("tour_passenger_tracking")
        .update(updateData)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("tour_passenger_tracking")
        .insert({
          booking_id: booking.id,
          passenger_id: passenger.id,
          tour_guide_id: guide_id,
          schedule_id: booking.schedule_id,
          ...updateData,
        });
    }
  }

  const actionMessages: Record<string, string> = {
    picked_up:   `Picked up! ${booking.total_pax} guest(s) marked as picked up.`,
    on_tour:     `On tour! ${booking.total_pax} guest(s) marked as on tour.`,
    dropped_off: `Dropped off! ${booking.total_pax} guest(s) marked as dropped off.`,
    no_show:     "Marked as no show.",
  };

  return NextResponse.json({
    success: true,
    message: actionMessages[action],
    booking: {
      reference: booking.reference,
      customer_name: booking.customer_name,
      tour_title: (booking.tour as { title?: string } | null)?.title ?? "—",
      total_pax: booking.total_pax,
    },
  });
}