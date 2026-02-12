import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: List alternative trips for reassignment (same route, upcoming, with available seats). Admin only. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const { searchParams } = new URL(request.url);
  const passengerCount = Math.max(0, parseInt(searchParams.get("passenger_count") ?? "1", 10));
  const isWalkIn = searchParams.get("is_walk_in") === "true";

  const { data: currentTrip, error: tripErr } = await supabase
    .from("trips")
    .select("id, route_id, boat_id")
    .eq("id", tripId)
    .single();
  if (tripErr || !currentTrip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const col = isWalkIn ? "walk_in_booked" : "online_booked";
  const quotaCol = isWalkIn ? "walk_in_quota" : "online_quota";

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(name), route:routes(display_name, origin, destination)")
    .eq("route_id", currentTrip.route_id)
    .gte("departure_date", today)
    .neq("id", tripId)
    .order("departure_date")
    .order("departure_time")
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (trips ?? [])
    .map((t) => {
      const booked = (t as Record<string, number>)[col] ?? 0;
      const quota = (t as Record<string, number>)[quotaCol] ?? 0;
      const avail = quota - booked;
      return { trip: t, avail };
    })
    .filter(({ avail }) => avail >= passengerCount)
    .map(({ trip }) => {
      const boat = trip.boat as { name?: string } | null;
      const route = trip.route as { display_name?: string; origin?: string; destination?: string } | null;
      return {
        id: trip.id,
        departure_date: trip.departure_date,
        departure_time: String(trip.departure_time ?? "").slice(0, 5),
        boat_name: boat?.name ?? "—",
        route_label: route?.display_name ?? `${route?.origin ?? ""} → ${route?.destination ?? ""}`,
      };
    });

  return NextResponse.json({ alternatives: items });
}
