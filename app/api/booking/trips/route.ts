import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTodayInManila, isTripDepartureAtLeast30MinFromNow } from "@/lib/admin/ph-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("route_id");
  const date = searchParams.get("date");
  if (!routeId || !date) {
    return NextResponse.json(
      { error: "Missing route_id or date" },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const todayManila = getTodayInManila();
  const selectWithPort =
    "id, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, status, boat:boats(id, name, status), route:routes(id, display_name, origin, destination), port:ports(id, name)";
  const selectWithoutPort =
    "id, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, status, boat:boats(id, name, status), route:routes(id, display_name, origin, destination)";

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  const res = await supabase
    .from("trips")
    .select(selectWithPort)
    .eq("route_id", routeId)
    .eq("departure_date", date)
    .eq("status", "scheduled")
    .order("departure_time");
  data = res.data;
  error = res.error;

  if (error && (error.message?.includes("ports") || error.message?.includes("port_id"))) {
    const fallback = await supabase
      .from("trips")
      .select(selectWithoutPort)
      .eq("route_id", routeId)
      .eq("departure_date", date)
      .eq("status", "scheduled")
      .order("departure_time");
    data = fallback.data;
    error = fallback.error;
    if (data) {
      data = (data as Record<string, unknown>[]).map((t) => ({ ...t, port: null }));
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const onlyRunningBoats = (trips: unknown[]) =>
    trips.filter((t) => (t as { boat?: { status?: string } }).boat?.status === "running");

  let available = onlyRunningBoats(data ?? []).filter(
    (t) => (t as { online_quota?: number; online_booked?: number }).online_quota! - ((t as { online_booked?: number }).online_booked ?? 0) > 0
  );

  // For today (Philippines): only show trips that depart at least 30 min from now so the passenger has time to pay and board.
  if (date === todayManila) {
    available = available.filter((t) => {
      const depDate = (t as { departure_date?: string }).departure_date ?? date;
      const depTime = (t as { departure_time?: string }).departure_time ?? "";
      return isTripDepartureAtLeast30MinFromNow(depDate, depTime);
    });
  }

  return NextResponse.json(available);
}
