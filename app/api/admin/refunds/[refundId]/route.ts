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

  // Build update payload based on action
  const update: Record<string, unknown> = {};

  if (action === "review") {
    update.status = "under_review";
    if (b.admin_notes) update.admin_notes = b.admin_notes;
  }

  if (action === "approve") {
    update.status = "approved";
    update.approved_by = authUser?.id ?? null;
    update.approved_at = now;
    if (b.amount_cents && typeof b.amount_cents === "number") {
      update.amount_cents = b.amount_cents;
    }
    if (b.admin_notes) update.admin_notes = b.admin_notes;
  }

  if (action === "reject") {
    if (!b.rejection_reason || typeof b.rejection_reason !== "string" || !b.rejection_reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
    }
    update.status = "rejected";
    update.rejection_reason = b.rejection_reason.trim();
    update.approved_by = authUser?.id ?? null;
    update.approved_at = now;
    if (b.admin_notes) update.admin_notes = b.admin_notes;
  }

  if (action === "process") {
    update.status = "processed";
    update.processed_by = authUser?.id ?? null;
    update.processed_at = now;
    if (b.gcash_reference && typeof b.gcash_reference === "string") {
      update.gcash_reference = b.gcash_reference.trim();
    }
    if (b.admin_notes) update.admin_notes = b.admin_notes;
  }

  const { error } = await supabase
    .from("refunds")
    .update(update)
    .eq("id", refundId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: `Refund ${action}d successfully.` });
}

