import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.role as string;
  if (!["admin", "parking_owner"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const lot_id = searchParams.get("lot_id");
  const start  = searchParams.get("start");
  const end    = searchParams.get("end");

  if (!lot_id) return NextResponse.json({ error: "lot_id required" }, { status: 400 });

  const supabase = await createClient();

  // Verify owner owns this lot (skip for admin)
  if (role === "parking_owner") {
    const { data: lot } = await supabase
      .from("parking_lots")
      .select("owner_id")
      .eq("id", lot_id)
      .maybeSingle();
    if (lot?.owner_id !== user.id)
      return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  // FIX 1: Removed the broken foreign key join on checked_in_by_fkey
  // which was causing the 500 error. We fetch checked_in_by as a plain id instead.
  let query = supabase
    .from("parking_reservations")
    .select(`
      id, reference, status,
      park_date_start, park_date_end, total_days,
      vehicle_count, vehicles,
      customer_full_name,
      parking_fee_cents, commission_cents,
      checked_in_at, checked_out_at, checked_in_by
    `)
    .eq("lot_id", lot_id)
    .not("status", "in", '("cancelled")')
    .order("park_date_start", { ascending: false });

  // FIX 2: Always include active bookings (confirmed/checked_in/overstay/pending)
  // regardless of date range — same logic as the crew bookings fix.
  if (start && end) {
    query = query.or(
      `and(park_date_start.lte.${end},park_date_end.gte.${start}),status.in.(confirmed,checked_in,overstay,pending_payment)`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[owner/bookings] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // FIX 3: Since we removed the broken join, map the data cleanly.
  const bookings = (data ?? []).map((b: {
    id: string; reference: string; status: string;
    park_date_start: string; park_date_end: string; total_days: number;
    vehicle_count: number; vehicles: unknown;
    customer_full_name: string;
    parking_fee_cents: number; commission_cents: number;
    checked_in_at: string | null; checked_out_at: string | null;
    checked_in_by: string | null;
  }) => ({
    ...b,
    checked_in_by_name: null,
  }));

  return NextResponse.json({ bookings });
}
