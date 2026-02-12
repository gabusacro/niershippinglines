import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/** POST: Passenger acknowledges receipt of refund. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "No email" }, { status: 400 });

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("reference", reference)
    .ilike("customer_email", email)
    .maybeSingle();

  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "refunded") return NextResponse.json({ error: "Booking is not refunded" }, { status: 400 });

  const db = createAdminClient() ?? supabase;
  const { error: updateErr } = await db
    .from("bookings")
    .update({ refund_acknowledged_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateErr) {
    const msg = updateErr.message?.toLowerCase() ?? "";
    if (msg.includes("refund_acknowledged_at") || msg.includes("schema cache")) {
      return NextResponse.json(
        { error: "Database migration required. Add refund_acknowledged_at column to bookings. Run migration 017 in Supabase SQL Editor." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
