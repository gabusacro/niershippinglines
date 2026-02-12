import { createClient } from "@/lib/supabase/server";

export type UpcomingTripRow = {
  id: string;
  departure_date: string;
  departure_time: string;
  online_quota: number;
  online_booked: number;
  boat: { id: string; name: string } | null;
  route: { id: string; display_name: string; origin: string; destination: string } | null;
};

/** Trips for today through today+6 (7 days), scheduled only, ordered by date then time. */
export async function getUpcomingTrips(): Promise<UpcomingTripRow[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + 6);
  const lastDate = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, departure_date, departure_time, online_quota, online_booked, boat:boats(id, name, status), route:routes(id, display_name, origin, destination)"
    )
    .eq("status", "scheduled")
    .gte("departure_date", today)
    .lte("departure_date", lastDate)
    .order("departure_date")
    .order("departure_time");

  if (error) return [];
  const rows = (data ?? []) as (UpcomingTripRow & { boat: { status?: string } | null })[];
  return rows.filter((row) => row.boat?.status === "running");
}

export { formatTime, getDayLabel } from "./format";
