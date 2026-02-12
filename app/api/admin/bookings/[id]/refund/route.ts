import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** POST: Process refund for a booking. Admin only. Creates refund record and sets status to refunded. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { reason?: string; gcash_reference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = String(body.reason ?? "Admin refund").trim() || "Admin refund";
  const gcashReference = typeof body.gcash_reference === "string" ? body.gcash_reference.trim() || null : null;

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status, total_amount_cents")
    .eq("id", id)
    .single();
  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "refunded") return NextResponse.json({ error: "Booking already refunded" }, { status: 400 });
  if (!["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot refund cancelled booking" }, { status: 400 });
  }

  const { error: refundErr } = await supabase.from("refunds").insert({
    booking_id: id,
    amount_cents: booking.total_amount_cents ?? 0,
    reason,
    processed_by: user.id,
    gcash_reference: gcashReference,
  });
  if (refundErr) return NextResponse.json({ error: refundErr.message }, { status: 500 });

  const { error: statusErr } = await supabase
    .from("bookings")
    .update({ status: "refunded" })
    .eq("id", id);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Refund processed" });
}
