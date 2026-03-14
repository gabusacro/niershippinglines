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

  // ── PROPER GROUPING LOGIC ────────────────────────────────────────────
  // Find existing batch for this operator + same guide + same schedule
  // This groups all joiners on the same day/package into ONE batch
  const { data: existingBatch } = await supabase
    .from("tour_batches")
    .select("id")
    .eq("tour_operator_id", user.id)
    .eq("tour_guide_id", tour_guide_id)
    .eq("schedule_id", booking.schedule_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  let batchId: string;

  if (existingBatch) {
    // ── Reuse existing batch (same guide + same schedule) ──────────────
    batchId = existingBatch.id;

    // Check if this booking is already in this batch
    const { data: alreadyLinked } = await supabase
      .from("tour_batch_bookings")
      .select("id")
      .eq("batch_id", batchId)
      .eq("booking_id", booking_id)
      .single();

    if (!alreadyLinked) {
      // Remove booking from any OTHER batch first (if reassigning guide)
      const { data: oldLink } = await supabase
        .from("tour_batch_bookings")
        .select("id, batch_id")
        .eq("booking_id", booking_id)
        .single();

      if (oldLink && oldLink.batch_id !== batchId) {
        // Remove from old batch
        await supabase
          .from("tour_batch_bookings")
          .delete()
          .eq("id", oldLink.id);

        // If old batch is now empty, delete it
        const { count } = await supabase
          .from("tour_batch_bookings")
          .select("*", { count: "exact", head: true })
          .eq("batch_id", oldLink.batch_id);

        if (count === 0) {
          await supabase.from("tour_batches").delete().eq("id", oldLink.batch_id);
        }
      }

      // Link booking to the existing batch
      const { error: linkError } = await supabase
        .from("tour_batch_bookings")
        .insert({ batch_id: batchId, booking_id });

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, action: "grouped", batch_id: batchId });

  } else {
    // ── No existing batch for this guide+schedule — create new one ──────
    // But first check if booking is already in a batch with a DIFFERENT guide
    const { data: oldLink } = await supabase
      .from("tour_batch_bookings")
      .select("id, batch_id")
      .eq("booking_id", booking_id)
      .single();

    if (oldLink) {
      // Reassigning to a different guide — update the batch guide
      const { error: updateError } = await supabase
        .from("tour_batches")
        .update({
          tour_guide_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", oldLink.batch_id)
        .eq("tour_operator_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, action: "reassigned", batch_id: oldLink.batch_id });
    }

    // Create brand new batch
    const { data: newBatch, error: batchError } = await supabase
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

    if (batchError || !newBatch) {
      return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
    }

    batchId = newBatch.id;

    const { error: linkError } = await supabase
      .from("tour_batch_bookings")
      .insert({ batch_id: batchId, booking_id });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "created", batch_id: batchId });
  }
}
