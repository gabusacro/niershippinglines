import { createClient } from "@/lib/supabase/server";
import { getTodayInManila, isTripDeparted } from "@/lib/admin/ph-time";

export type UpcomingTripRow = {
  id: string;
  departure_date: string;
  departure_time: string;
  online_quota: number;
  online_booked: number;
  walk_in_quota: number;
  walk_in_booked: number;
  boat: { id: string; name: string; capacity: number } | null;
  route: { id: string; display_name: string; origin: string; destination: string } | null;
};

/** Trips for today through ~60 days ahead (covers next month/March), scheduled only. Uses Philippines time. */
export async function getUpcomingTrips(): Promise<UpcomingTripRow[]> {
  const supabase = await createClient();
  const today = getTodayInManila();
  const [y, m, d] = today.split("-").map(Number);
  const lastDay = new Date(y, m - 1, d + 60);
  const lastDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(id, name, capacity, status), route:routes(id, display_name, origin, destination)"
    )
    .eq("status", "scheduled")
    .gte("departure_date", today)
    .lte("departure_date", lastDate)
    .order("departure_date")
    .order("departure_time");

  if (error) return [];
  const rows = (data ?? []) as (UpcomingTripRow & { boat: { status?: string } | null })[];
  return rows.filter(
    (row) =>
      row.boat?.status === "running" &&
      !isTripDeparted(row.departure_date, row.departure_time ?? "")
  );
}

export { formatTime, getDayLabel } from "./format";
