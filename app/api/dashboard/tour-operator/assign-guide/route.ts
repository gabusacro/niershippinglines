import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { booking_id, tour_guide_id } = await request.json();
  if (!booking_id || !tour_guide_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify this booking belongs to this operator
  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("id, schedule_id, tour_operator_id")
    .eq("id", booking_id)
    .eq("tour_operator_id", user.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Check if batch already exists for this booking
  const { data: existingBatchBooking } = await supabase
    .from("tour_batch_bookings")
    .select("id, batch_id")
    .eq("booking_id", booking_id)
    .single();

  if (existingBatchBooking) {
    // Update existing batch with new guide
    const { error } = await supabase
      .from("tour_batches")
      .update({
        tour_guide_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingBatchBooking.batch_id)
      .eq("tour_operator_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "updated" });
  }

  // Create new batch
  const { data: batch, error: batchError } = await supabase
    .from("tour_batches")
    .insert({
      tour_operator_id: user.id,
      tour_guide_id,
      schedule_id: booking.schedule_id,
      guide_payment_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
  }

  // Link booking to batch
  const { error: linkError } = await supabase
    .from("tour_batch_bookings")
    .insert({ batch_id: batch.id, booking_id });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: "created", batch_id: batch.id });
}
