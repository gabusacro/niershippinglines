import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "parking_owner", "parking_crew"];
  if (!allowed.includes(user.role as string))
    return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const start  = searchParams.get("start") ?? new Date().toISOString().split("T")[0];
  const end    = searchParams.get("end")   ?? start;
  const search = searchParams.get("search") ?? "";

  const supabase = await createClient();

  // Get lot IDs for this user
  let lotIds: string[] = [];

  if ((user.role as string) === "admin") {
    const { data } = await supabase.from("parking_lots").select("id");
    lotIds = (data ?? []).map(l => l.id);
  } else if ((user.role as string) === "parking_owner") {
    const { data } = await supabase.from("parking_lots").select("id").eq("owner_id", user.id);
    lotIds = (data ?? []).map(l => l.id);
  } else {
    // parking_crew
    const { data } = await supabase
      .from("parking_lot_crew")
      .select("lot_id")
      .eq("crew_id", user.id)
      .eq("is_active", true);
    lotIds = (data ?? []).map(l => l.lot_id);
  }

  if (lotIds.length === 0) return NextResponse.json({ bookings: [] });

  let query = supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, total_days, vehicle_count, vehicles, customer_full_name, lot_snapshot_name, checked_in_at, checked_out_at, created_at")
    .in("lot_id", lotIds)
    .not("status", "in", '("cancelled")')
    .or(`park_date_start.lte.${end},park_date_end.gte.${start}`)
    .order("park_date_start", { ascending: true });

  if (search.trim()) {
    query = query.or(`reference.ilike.%${search}%,customer_full_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}
