import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * POST: Claim all guest bookings whose customer_email matches the signed-in user's email.
 * Used when a passenger lands on dashboard after registering (so we don't rely on ref in URL).
 */
export async function POST() {
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

  const { data: bookings, error: fetchErr } = await admin
    .from("bookings")
    .select("id")
    .is("created_by", null)
    .ilike("customer_email", emailTrim);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const ids = (bookings ?? []).map((b) => b.id);
  if (ids.length === 0) {
    return NextResponse.json({ claimed: 0 });
  }
  const { error: updateErr } = await admin
    .from("bookings")
    .update({ created_by: user.id, updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ claimed: ids.length });
}
