import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_guide") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reference, guide_id } = await request.json();
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = await createClient();

  // Find the booking
  const { data: booking, error: bookingError } = await supabase
    .from("tour_bookings")
    .select("id, reference, customer_name, total_pax, schedule_id, tour:tour_packages(title), schedule:tour_schedules(available_date)")
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

  // Get current tracking status
  const { data: tracking } = await supabase
    .from("tour_passenger_tracking")
    .select("status")
    .eq("booking_id", booking.id)
    .eq("tour_guide_id", guide_id)
    .limit(1)
    .single();

  return NextResponse.json({
    booking: {
      id: booking.id,
      reference: booking.reference,
      customer_name: booking.customer_name,
      tour_title: (booking.tour as { title?: string } | null)?.title ?? "—",
      total_pax: booking.total_pax,
      schedule_date: (booking.schedule as { available_date?: string } | null)?.available_date ?? "—",
      current_status: tracking?.status ?? null,
    },
  });
}
