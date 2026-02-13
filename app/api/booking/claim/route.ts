import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST: Claim a guest booking (reference) so it becomes owned by the current user.
 * Only succeeds if the booking has created_by null and customer_email matches the
 * signed-in user's email (case-insensitive). Uses admin client to set created_by.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : null;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user?.email?.trim()) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const emailTrim = user.email.trim().toLowerCase();
  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select("id, customer_email, created_by")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if ((booking as { created_by: string | null }).created_by != null) {
    return NextResponse.json({ error: "Booking already linked to an account" }, { status: 400 });
  }
  const customerEmail = (booking as { customer_email?: string | null }).customer_email?.trim().toLowerCase();
  if (!customerEmail || customerEmail !== emailTrim) {
    return NextResponse.json({ error: "This booking can only be claimed by an account with the same email used when booking" }, { status: 403 });
  }

  const { error: updateErr } = await admin
    .from("bookings")
    .update({ created_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ claimed: true, reference });
}
