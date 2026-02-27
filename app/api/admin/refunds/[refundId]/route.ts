import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { refundId } = await params;
  if (!refundId) return NextResponse.json({ error: "Missing refundId" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const action = b.action as string;

  if (!["review", "approve", "reject", "process"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Must be review, approve, reject, or process." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  // First, get the refund record so we know the booking_id
  const { data: refund, error: fetchErr } = await supabase
    .from("refunds")
    .select("id, booking_id, status")
    .eq("id", refundId)
    .maybeSingle();

  if (fetchErr || !refund) {
    return NextResponse.json({ error: "Refund not found." }, { status: 404 });
  }

  // Build update payload for refunds table
  const refundUpdate: Record<string, unknown> = {};

  // Map action → refund status and booking refund_status
  // These are the values that sync back to bookings.refund_status
  const bookingRefundStatusMap: Record<string, string> = {
    review:  "under_review",
    approve: "approved",
    reject:  "rejected",
    process: "processed",
  };

  if (action === "review") {
    refundUpdate.status = "under_review";
    if (b.admin_notes) refundUpdate.admin_notes = b.admin_notes;
  }

  if (action === "approve") {
    refundUpdate.status = "approved";
    refundUpdate.approved_by = authUser?.id ?? null;
    refundUpdate.approved_at = now;
    if (b.amount_cents && typeof b.amount_cents === "number") {
      refundUpdate.amount_cents = b.amount_cents;
    }
    if (b.admin_notes) refundUpdate.admin_notes = b.admin_notes;
  }

  if (action === "reject") {
    if (!b.rejection_reason || typeof b.rejection_reason !== "string" || !b.rejection_reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
    }
    refundUpdate.status = "rejected";
    refundUpdate.rejection_reason = b.rejection_reason.trim();
    refundUpdate.approved_by = authUser?.id ?? null;
    refundUpdate.approved_at = now;
    if (b.admin_notes) refundUpdate.admin_notes = b.admin_notes;
  }

  if (action === "process") {
    refundUpdate.status = "processed";
    refundUpdate.processed_by = authUser?.id ?? null;
    refundUpdate.processed_at = now;
    if (b.gcash_reference && typeof b.gcash_reference === "string") {
      refundUpdate.gcash_reference = b.gcash_reference.trim();
    }
    if (b.admin_notes) refundUpdate.admin_notes = b.admin_notes;
  }

  // Step 1: Update the refunds table
  const { error: refundErr } = await supabase
    .from("refunds")
    .update(refundUpdate)
    .eq("id", refundId);

  if (refundErr) return NextResponse.json({ error: refundErr.message }, { status: 500 });

  // Step 2: Sync status back to bookings.refund_status so passenger can see it
  const newBookingRefundStatus = bookingRefundStatusMap[action];

  // For "process" action: also set booking.status = "refunded" so crew know ticket is void
  const bookingUpdate: Record<string, unknown> = {
    refund_status: newBookingRefundStatus,
    updated_at: now,
  };

  if (action === "process") {
    bookingUpdate.status = "refunded"; // ⭐ Marks ticket as void — crew scan will block boarding
  }

  if (action === "reject") {
    // If rejected, clear refund_status back to none so passenger can see rejection
    // but booking stays in its current status (confirmed/etc)
    bookingUpdate.refund_status = "rejected";
  }

  const { error: bookingErr } = await supabase
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", refund.booking_id);

  if (bookingErr) {
    console.error("[refund PATCH] Failed to sync booking status:", bookingErr.message);
    // Don't fail the whole request — refund table already updated
  }

  return NextResponse.json({ ok: true, message: `Refund ${action}d successfully.` });
}
