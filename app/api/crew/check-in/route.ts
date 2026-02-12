import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** POST: Mark ticket as checked_in or boarded. Crew/ticket_booth/admin/captain only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(profile?.role ?? "");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { reference?: string; passenger_index?: number; action?: "checked_in" | "boarded" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  const action = body.action === "checked_in" || body.action === "boarded" ? body.action : "checked_in";

  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const validStatuses = ["confirmed", "checked_in", "boarded"];
  if (!validStatuses.includes(booking.status ?? "")) {
    return NextResponse.json({ error: `Cannot check in: status is ${booking.status}` }, { status: 400 });
  }

  const updates: { status?: string; checked_in_at?: string; boarded_at?: string } = {};
  if (action === "checked_in") {
    updates.status = "checked_in";
    updates.checked_in_at = new Date().toISOString();
  } else {
    updates.status = "boarded";
    updates.boarded_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", booking.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: updates.status });
}
