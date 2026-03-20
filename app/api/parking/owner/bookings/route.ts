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
    const { data: lot } = await supabase.from("parking_lots").select("owner_id").eq("id", lot_id).maybeSingle();
    if (lot?.owner_id !== user.id) return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  let query = supabase
    .from("parking_reservations")
    .select(`
      id, reference, status,
      park_date_start, park_date_end, total_days,
      vehicle_count, vehicles,
      customer_full_name,
      parking_fee_cents, commission_cents,
      checked_in_at, checked_out_at,
      checked_in_by:profiles!checked_in_by_fkey(full_name)
    `)
    .eq("lot_id", lot_id)
    .order("park_date_start", { ascending: false });

  if (start) query = query.gte("park_date_start", start);
  if (end)   query = query.lte("park_date_start", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookings = (data ?? []).map((b: {
    id: string; reference: string; status: string;
    park_date_start: string; park_date_end: string; total_days: number;
    vehicle_count: number; vehicles: unknown;
    customer_full_name: string;
    parking_fee_cents: number; commission_cents: number;
    checked_in_at: string | null; checked_out_at: string | null;
    checked_in_by: { full_name: string } | { full_name: string }[] | null;
  }) => {
    const checkedInBy = Array.isArray(b.checked_in_by) ? b.checked_in_by[0] : b.checked_in_by;
    return { ...b, checked_in_by_name: (checkedInBy as { full_name?: string } | null)?.full_name ?? null };
  });

  return NextResponse.json({ bookings });
}
