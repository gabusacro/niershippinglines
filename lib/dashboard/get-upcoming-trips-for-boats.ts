import { createClient } from "@/lib/supabase/server";
import { getTodayInManila, isTripDeparted } from "@/lib/admin/ph-time";

export type UpcomingTripForBooth = {
  id: string;
  departure_date: string;
  departure_time: string;
  boat: { id: string; name: string } | null;
  route: { display_name?: string; origin?: string; destination?: string } | null;
  departed: boolean;
  online_quota: number;
  online_booked: number;
  walk_in_quota: number;
  walk_in_booked: number;
};

/**
 * Today + upcoming trips (next 14 days) for the given boat IDs.
 * Used by ticket booth to select which trip to issue a ticket for.
 */
export async function getUpcomingTripsForBoats(boatIds: string[]): Promise<UpcomingTripForBooth[]> {
  if (boatIds.length === 0) return [];
  const supabase = await createClient();
  const today = getTodayInManila();

  // 14 days from today
  const futureDate = new Date(today + "T00:00:00");
  futureDate.setDate(futureDate.getDate() + 14);
  const endDate = futureDate.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(id, name), route:routes(display_name, origin, destination)")
    .gte("departure_date", today)
    .lte("departure_date", endDate)
    .eq("status", "scheduled")
    .in("boat_id", boatIds)
    .order("departure_date")
    .order("departure_time");

  if (error) return [];
  return (data ?? []).map((t: any) => ({
    id: t.id,
    departure_date: t.departure_date,
    departure_time: t.departure_time,
    boat: t.boat as UpcomingTripForBooth["boat"],
    route: t.route as UpcomingTripForBooth["route"],
    departed: isTripDeparted(t.departure_date, t.departure_time ?? ""),
    online_quota:   t.online_quota   ?? 0,
    online_booked:  t.online_booked  ?? 0,
    walk_in_quota:  t.walk_in_quota  ?? 0,
    walk_in_booked: t.walk_in_booked ?? 0,
  }));
}
