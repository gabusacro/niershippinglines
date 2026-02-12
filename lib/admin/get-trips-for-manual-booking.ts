import { createClient } from "@/lib/supabase/server";

export type TripForManualBooking = {
  id: string;
  departure_date: string;
  departure_time: string;
  walk_in_quota: number;
  walk_in_booked: number;
  boat: { id: string; name: string } | null;
  route: { id: string; display_name: string; origin: string; destination: string } | null;
};

/** Trips from today through next 6 days, scheduled, with walk-in availability. */
export async function getTripsForManualBooking(): Promise<TripForManualBooking[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + 6);
  const lastDate = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, departure_date, departure_time, walk_in_quota, walk_in_booked, boat:boats(id, name, status), route:routes(id, display_name, origin, destination)"
    )
    .eq("status", "scheduled")
    .gte("departure_date", today)
    .lte("departure_date", lastDate)
    .order("departure_date")
    .order("departure_time");

  if (error) return [];
  const rows = (data ?? []) as (TripForManualBooking & { boat: { id: string; name: string; status?: string } | null })[];
  return rows.filter((row) => row.boat?.status === "running");
}
