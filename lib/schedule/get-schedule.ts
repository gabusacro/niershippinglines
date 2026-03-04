import { createClient } from "@/lib/supabase/server";

export interface TripSlot {
  routeId: string;
  routeDisplayName: string;
  routeOrigin: string;
  routeDestination: string;
  departureTime: string; // formatted "4:20 AM"
}

export interface VesselScheduleRow {
  vesselId: string;
  vesselName: string;
  vesselImageUrl: string | null;
  trips: TripSlot[]; // all active departure slots across all routes, sorted by time
}

// Keep ScheduleRow for any legacy usage
export interface ScheduleRow {
  routeId: string;
  routeDisplayName: string;
  routeOrigin: string;
  routeDestination: string;
  times: string[];
  timesWithDirection: { time: string; directionLabel: string }[];
  vesselImageUrl?: string | null;
  vesselImageUrls?: string[];
  vesselName?: string;
}

function formatTimeForDisplay(t: string): string {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parts[1] ?? "00";
  const am = h < 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
}

export async function getScheduleFromSupabase(): Promise<VesselScheduleRow[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Step 1: Active vessel-route assignments valid today
  const { data: assignments } = await supabase
    .from("vessel_route_assignments")
    .select("id, boat_id, route_id")
    .eq("is_active", true)
    .lte("available_from", today)
    .gte("available_until", today);

  if (!assignments?.length) return [];

  const boatIds = [...new Set(assignments.map((a) => a.boat_id as string))];
  const routeIds = [...new Set(assignments.map((a) => a.route_id as string))];

  // Step 2: Running vessels only
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, status, image_url")
    .in("id", boatIds)
    .eq("status", "running");

  if (!boats?.length) return [];

  const runningBoatIds = new Set(boats.map((b) => b.id as string));
  const boatById = new Map(boats.map((b) => [b.id as string, b]));

  // Step 3: Routes
  const { data: routes } = await supabase
    .from("routes")
    .select("id, origin, destination, display_name")
    .in("id", routeIds);

  if (!routes?.length) return [];
  const routeById = new Map(routes.map((r) => [r.id as string, r]));

  // Step 4: Active schedule slots
  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("boat_id, route_id, departure_time")
    .in("boat_id", [...runningBoatIds])
    .in("route_id", routeIds)
    .eq("is_active", true)
    .order("departure_time");

  if (!slots?.length) return [];

  // Step 5: Build vessel-centric map
  // Key: vesselId → TripSlot[]
  const vesselTrips = new Map<string, TripSlot[]>();

  for (const slot of slots) {
    const boatId = slot.boat_id as string;
    const routeId = slot.route_id as string;

    if (!runningBoatIds.has(boatId)) continue;

    // Must have an active assignment for this boat+route today
    const hasAssignment = assignments.some(
      (a) => a.boat_id === boatId && a.route_id === routeId
    );
    if (!hasAssignment) continue;

    const route = routeById.get(routeId);
    if (!route) continue;

    const formatted = formatTimeForDisplay(slot.departure_time as string);
    if (!formatted) continue;

    if (!vesselTrips.has(boatId)) vesselTrips.set(boatId, []);
    vesselTrips.get(boatId)!.push({
      routeId,
      routeDisplayName: (route.display_name as string) ?? `${route.origin} → ${route.destination}`,
      routeOrigin: (route.origin as string) ?? "",
      routeDestination: (route.destination as string) ?? "",
      departureTime: formatted,
    });
  }

  if (vesselTrips.size === 0) return [];

  // Step 6: Build final rows sorted by vessel name
  const rows: VesselScheduleRow[] = [];

  for (const [boatId, trips] of vesselTrips.entries()) {
    if (trips.length === 0) continue;
    const boat = boatById.get(boatId);
    if (!boat) continue;

    rows.push({
      vesselId: boatId,
      vesselName: boat.name as string,
      vesselImageUrl: (boat.image_url as string | null) ?? null,
      trips, // already sorted by departure_time from DB query
    });
  }

  rows.sort((a, b) => a.vesselName.localeCompare(b.vesselName));
  return rows;
}
