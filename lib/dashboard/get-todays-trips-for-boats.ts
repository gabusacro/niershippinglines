import { createClient } from "@/lib/supabase/server";
import { getTodayInManila, isTripDeparted } from "@/lib/admin/ph-time";

export type TodayTripForCrew = {
  id: string;
  departure_date: string;
  departure_time: string;
  boat: { id: string; name: string } | null;
  route: { display_name?: string; origin?: string; destination?: string } | null;
  /** True if this trip has already departed (Manila time). */
  departed: boolean;
};

/**
 * Today's trips for the given boat IDs (Manila date).
 * Ordered by departure_time. Includes departed trips so crew/captain can view any trip's manifest.
 * "Current" trip = first not-departed; if all departed, use last trip.
 */
export async function getTodaysTripsForBoats(boatIds: string[]): Promise<TodayTripForCrew[]> {
  if (boatIds.length === 0) return [];
  const supabase = await createClient();
  const today = getTodayInManila();

  const { data, error } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, boat:boats(id, name), route:routes(display_name, origin, destination)")
    .eq("departure_date", today)
    .eq("status", "scheduled")
    .in("boat_id", boatIds)
    .order("departure_time");

  if (error) return [];
  const rows = (data ?? []) as unknown as (Omit<TodayTripForCrew, "departed"> & { departure_date: string; departure_time: string })[];
  return rows.map((t) => ({
    id: t.id,
    departure_date: t.departure_date,
    departure_time: t.departure_time,
    boat: t.boat as TodayTripForCrew["boat"],
    route: t.route as TodayTripForCrew["route"],
    departed: isTripDeparted(t.departure_date, t.departure_time ?? ""),
  }));
}

/**
 * From today's trips for crew boats, pick the "current" one:
 * first not-departed by time; if all departed, last trip.
 */
export function getCurrentTripFromTodays(
  trips: TodayTripForCrew[]
): TodayTripForCrew | null {
  if (trips.length === 0) return null;
  const next = trips.find((t) => !t.departed);
  return next ?? trips[trips.length - 1];
}
