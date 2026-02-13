import { createClient } from "@/lib/supabase/server";
import { getTodayInManila } from "./ph-time";
const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

export type VesselPassengerRow = {
  vessel_name: string;
  vessel_id: string;
  passenger_count: number;
  trip_count: number;
};

/** Today's passenger count per active vessel (from bookings on today's trips). */
export async function getTodayPassengersByVessel(): Promise<VesselPassengerRow[]> {
  const supabase = await createClient();

  const today = getTodayInManila();
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, boat_id, boat:boats(id, name)")
    .eq("departure_date", today);

  if (tripsError || !trips?.length) return [];

  const tripIds = (trips ?? []).map((t) => t.id);
  const { data: bookings, error: bookError } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  if (bookError) return [];

  const passengersByTrip = new Map<string, number>();
  for (const b of bookings ?? []) {
    const cur = passengersByTrip.get(b.trip_id) ?? 0;
    passengersByTrip.set(b.trip_id, cur + (b.passenger_count ?? 0));
  }

  const byBoat = new Map<string, { name: string; count: number; trips: number }>();
  for (const t of trips ?? []) {
    const boatId = t.boat_id;
    const boatObj = Array.isArray(t.boat) ? (t.boat as { id: string; name: string }[])[0] : (t.boat as { id: string; name: string } | null);
    const boatName = boatObj?.name ?? "Unknown";
    const count = passengersByTrip.get(t.id) ?? 0;
    const existing = byBoat.get(boatId);
    if (existing) {
      existing.count += count;
      existing.trips += 1;
    } else {
      byBoat.set(boatId, { name: boatName, count, trips: 1 });
    }
  }

  return Array.from(byBoat.entries())
    .map(([vessel_id, v]) => ({
      vessel_id,
      vessel_name: v.name,
      passenger_count: v.count,
      trip_count: v.trips,
    }))
    .sort((a, b) => b.passenger_count - a.passenger_count);
}
