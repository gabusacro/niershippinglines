import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: List bookings for a trip with passenger details and booking source. Admin only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, reference, customer_full_name, customer_email, customer_mobile, passenger_count, passenger_details, status, is_walk_in, created_by, total_amount_cents")
    .eq("trip_id", tripId)
    .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"])
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creatorIds = [...new Set((bookings ?? []).map((b) => b.created_by).filter(Boolean))] as string[];
  const creators = new Map<string, { role: string; full_name: string | null }>();
  if (creatorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .in("id", creatorIds);
    for (const p of profs ?? []) {
      creators.set(p.id, { role: p.role ?? "—", full_name: p.full_name ?? null });
    }
  }

  const items = (bookings ?? []).map((b) => {
    const creator = b.created_by ? creators.get(b.created_by) : null;
    let source = "Online (passenger)";
    if (b.is_walk_in) {
      source = creator?.role === "admin" ? "Walk-in (admin)" : creator?.role === "ticket_booth" ? "Walk-in (ticket booth)" : "Walk-in";
    } else if (creator?.role === "admin") {
      source = "Admin";
    } else if (creator?.role === "ticket_booth") {
      source = "Ticket booth";
    }
    const pd = (b.passenger_details ?? []) as { fare_type?: string; full_name?: string }[];
    const names = pd.length > 0 ? pd.map((p) => p.full_name ?? "—").filter(Boolean) : [b.customer_full_name ?? "—"];
    return {
      id: b.id,
      reference: b.reference,
      customer_full_name: b.customer_full_name,
      customer_email: b.customer_email,
      customer_mobile: b.customer_mobile,
      passenger_count: b.passenger_count,
      passenger_names: names,
      status: b.status,
      total_amount_cents: b.total_amount_cents,
      booking_source: source,
      is_walk_in: b.is_walk_in,
    };
  });

  return NextResponse.json({ bookings: items });
}
