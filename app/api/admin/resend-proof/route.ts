import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/** POST: Admin/ticket_booth only. Clears payment proof and requests passenger to resend (wrong screenshot, no reference visible). */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !["admin", "ticket_booth"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = (body as Record<string, unknown>).reference;
  if (!reference || typeof reference !== "string" || !reference.trim()) {
    return NextResponse.json({ error: "Missing or invalid reference" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, payment_proof_path")
    .eq("reference", reference.trim())
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "pending_payment") {
    return NextResponse.json({ error: "Booking is not pending payment" }, { status: 400 });
  }
  if (!(booking as { payment_proof_path?: string | null }).payment_proof_path) {
    return NextResponse.json({ error: "No payment proof to resend" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_proof_path: null,
      proof_resend_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Proof cleared. Passenger will see a message to resend photo or enter reference manually.",
    reference: reference.trim(),
  });
}
