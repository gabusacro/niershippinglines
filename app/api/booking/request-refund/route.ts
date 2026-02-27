import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_REASONS = ["weather_disturbance", "vessel_cancellation"] as const;

/**
 * POST /api/booking/request-refund
 * Passenger requests a refund. Admin will review and process.
 * Only weather disturbance or vessel cancellation per policy.
 */
export async function POST(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reference?: string; reason?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = (body.reference ?? "").trim().toUpperCase();
  const reason = (body.reason ?? "").trim();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";

  if (!reference) return NextResponse.json({ error: "Missing booking reference" }, { status: 400 });
  if (!ALLOWED_REASONS.includes(reason as (typeof ALLOWED_REASONS)[number])) {
    return NextResponse.json(
      {
        error: "Refunds only for weather disturbance or vessel cancellation. Select a valid reason.",
        allowed_reasons: [...ALLOWED_REASONS],
      },
      { status: 400 }
    );
  }

  // Use adminClient to bypass RLS for the lookup — we verify ownership via email below
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const db = adminClient ?? supabase;

  const { data: booking, error: fetchErr } = await db
    .from("bookings")
    .select("id, customer_email, status, refund_requested_at, created_by, total_amount_cents")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchErr) {
    console.error("[request-refund] fetch error:", fetchErr.message);
    return NextResponse.json({ error: "Could not look up booking. Please try again." }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found. Check the reference and try again." }, { status: 404 });
  }

  // Verify ownership: booking email must match logged-in user's email
  // OR the booking was created by this user's account
  const userEmail = (user.email ?? "").toLowerCase().trim();
  const bookingEmail = (booking.customer_email ?? "").toLowerCase().trim();
  const isEmailMatch = userEmail && bookingEmail === userEmail;
  const isCreatedBy = booking.created_by === user.id;

  if (!isEmailMatch && !isCreatedBy) {
    return NextResponse.json(
      { error: "You can only request a refund for your own booking." },
      { status: 403 }
    );
  }

  if (booking.status === "refunded") {
    return NextResponse.json({ error: "This booking has already been refunded." }, { status: 400 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Cannot request a refund for a cancelled booking." }, { status: 400 });
  }
  if (!["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(booking.status)) {
    return NextResponse.json(
      { error: `Cannot request a refund for a booking with status: ${booking.status}` },
      { status: 400 }
    );
  }
  if (booking.refund_requested_at) {
    return NextResponse.json(
      { error: "A refund has already been requested for this booking. Our team will process it soon." },
      { status: 400 }
    );
  }

  // Step 1: Update the booking row
  const { error: updateErr } = await db
    .from("bookings")
    .update({
      refund_requested_at: new Date().toISOString(),
      refund_status: "pending",
      refund_request_reason: reason,
      refund_request_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateErr) {
    console.error("[request-refund] update error:", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Step 2: Insert a row into the refunds table so admin dashboard can see it
  const { error: refundInsertErr } = await db
    .from("refunds")
    .insert({
      booking_id: booking.id,
      amount_cents: booking.total_amount_cents,
      reason: notes || reason,
      status: "requested",
      refund_type: "full",
      policy_basis: reason === "weather_disturbance" ? "weather" 
      : reason === "vessel_cancellation" ? "vessel_unable" 
      : "other",
      requested_by: user.id,
      requested_at: new Date().toISOString(),
    });

  if (refundInsertErr) {
    // Log but don't block the user — booking update already succeeded
    console.error("[request-refund] refund insert error:", refundInsertErr.message);
  }

  return NextResponse.json({
    ok: true,
    message: "Refund request submitted. Our team will review and process it shortly. Check your booking page for status updates.",
  });
}