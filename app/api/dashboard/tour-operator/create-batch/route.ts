import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { schedule_id, tour_guide_id, booking_id } = await request.json();

  if (!schedule_id || !tour_guide_id || !booking_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify booking belongs to this operator
  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("id, tour_operator_id")
    .eq("id", booking_id)
    .eq("tour_operator_id", user.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Count existing batches for this schedule + operator to get batch number
  const { count } = await supabase
    .from("tour_batches")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("schedule_id", schedule_id);

  const batchNumber = (count ?? 0) + 1;

  // Create new batch (force new — don't group with existing)
  const { data: newBatch, error: batchError } = await supabase
    .from("tour_batches")
    .insert({
      tour_operator_id: user.id,
      tour_guide_id,
      schedule_id,
      batch_number: batchNumber,
      max_pax: 13,
      guide_payment_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchError || !newBatch) {
    return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
  }

  // Remove booking from old batch if any
  await supabase
    .from("tour_batch_bookings")
    .delete()
    .eq("booking_id", booking_id);

  // Link booking to new batch
  const { error: linkError } = await supabase
    .from("tour_batch_bookings")
    .insert({ batch_id: newBatch.id, booking_id });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    batch_id: newBatch.id,
    batch_number: batchNumber,
  });
}
