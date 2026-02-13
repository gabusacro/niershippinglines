import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/** POST: Passenger saves manual GCash transaction reference (when screenshot cannot be uploaded). */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = (body as Record<string, unknown>).reference;
  const gcashRef = (body as Record<string, unknown>).gcash_transaction_reference;
  if (!reference || typeof reference !== "string" || !reference.trim()) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }
  if (gcashRef !== undefined && gcashRef !== null && typeof gcashRef !== "string") {
    return NextResponse.json({ error: "gcash_transaction_reference must be a string" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, customer_email, status")
    .eq("reference", reference.trim())
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if ((booking.customer_email ?? "").toLowerCase().trim() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can only update your own booking" }, { status: 403 });
  }
  if (booking.status !== "pending_payment") {
    return NextResponse.json({ error: "Booking is not pending payment" }, { status: 400 });
  }

  const value = typeof gcashRef === "string" ? gcashRef.trim() || null : null;

  const updateClient = createAdminClient() ?? supabase;
  const { error: updateError } = await updateClient
    .from("bookings")
    .update({
      gcash_transaction_reference: value,
      ...(value ? { proof_resend_requested_at: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Reference saved.",
    reference: reference.trim(),
    gcash_transaction_reference: value,
  });
}
