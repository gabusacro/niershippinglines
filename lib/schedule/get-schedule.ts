import { createClient } from "@/lib/supabase/server";

export interface TimeWithDirection {
  time: string;
  /** e.g. "Siargao (Dapa) → Surigao" for first slot, "Surigao → Siargao (Dapa)" for second */
  directionLabel: string;
}

export interface ScheduleRow {
  routeId: string;
  routeDisplayName: string;
  routeOrigin: string;
  routeDestination: string;
  times: string[];
  /** Per-time direction: first slot = origin→destination, second = destination→origin */
  timesWithDirection: TimeWithDirection[];
  vesselImageUrl?: string | null;
  vesselImageUrls?: string[];
  vesselName?: string;
}

/** Format DB time "HH:MM:SS" or "HH:MM" to "H:MM AM/PM" for display */
function formatTimeForDisplay(t: string): string {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parts[1] ?? "00";
  const am = h < 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
}

/**
 * Fetches schedule: one card per vessel per route.
 * Each vessel only shows its own departure times — no mixing across vessels.
 */
export async function getScheduleFromSupabase(): Promise<ScheduleRow[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Step 1: Get active vessel-route assignments for today
  const { data: assignments } = await supabase
    .from("vessel_route_assignments")
    .select("id, boat_id, route_id, available_from, available_until, is_active")
    .eq("is_active", true)
    .lte("available_from", today)
    .gte("available_until", today);

  if (!assignments?.length) return [];

  // Step 2: Get boats for those assignments — running only
  const boatIds = [...new Set(assignments.map((a) => a.boat_id as string))];
  const routeIds = [...new Set(assignments.map((a) => a.route_id as string))];

  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, status, image_url, booking_suspended")
    .in("id", boatIds)
    .eq("status", "running");

  if (!boats?.length) return [];

  const runningBoatIds = new Set(boats.map((b) => b.id));
  const boatById = new Map(boats.map((b) => [b.id, b]));

  // Step 3: Get routes
  const { data: routes } = await supabase
    .from("routes")
    .select("id, origin, destination, display_name")
    .in("id", routeIds);

  if (!routes?.length) return [];
  const routeById = new Map(routes.map((r) => [r.id, r]));

  // Step 4: Get active schedule slots for these boat+route combos
  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("boat_id, route_id, departure_time, is_active")
    .in("boat_id", boatIds)
    .in("route_id", routeIds)
    .eq("is_active", true)
    .order("departure_time");

  if (!slots?.length) return [];

  // Step 5: Group slots by vessel+route key
  type SlotGroup = {
    boatId: string;
    routeId: string;
    times: { raw: string; formatted: string }[];
  };

  const groups = new Map<string, SlotGroup>();

  for (const slot of slots) {
    const boatId = slot.boat_id as string;
    const routeId = slot.route_id as string;

    // Only include running boats that have an active assignment today
    if (!runningBoatIds.has(boatId)) continue;
    const hasAssignment = assignments.some(
      (a) => a.boat_id === boatId && a.route_id === routeId
    );
    if (!hasAssignment) continue;

    const formatted = formatTimeForDisplay(slot.departure_time as string);
    if (!formatted) continue;

    const key = `${boatId}::${routeId}`;
    if (!groups.has(key)) {
      groups.set(key, { boatId, routeId, times: [] });
    }
    groups.get(key)!.times.push({ raw: slot.departure_time as string, formatted });
  }

  if (groups.size === 0) return [];

  // Step 6: Build ScheduleRow per group
  const rows: ScheduleRow[] = [];

  for (const group of groups.values()) {
    if (group.times.length === 0) continue;

    const boat = boatById.get(group.boatId);
    const route = routeById.get(group.routeId);
    if (!boat || !route) continue;

    const origin = (route.origin as string) ?? "";
    const destination = (route.destination as string) ?? "";
    const times = group.times.map((t) => t.formatted);

    const timesWithDirection: TimeWithDirection[] = group.times.map((t) => ({
      time: t.formatted,
      directionLabel: `${origin} → ${destination}`,
    }));

    rows.push({
      routeId: group.routeId,
      routeDisplayName: (route.display_name as string) ?? `${origin} → ${destination}`,
      routeOrigin: origin,
      routeDestination: destination,
      times,
      timesWithDirection,
      vesselImageUrl: (boat.image_url as string | null) ?? null,
      vesselName: boat.name as string,
    });
  }

  // Sort by route display name then first departure time
  rows.sort((a, b) => {
    const rc = a.routeDisplayName.localeCompare(b.routeDisplayName);
    if (rc !== 0) return rc;
    return (a.times[0] ?? "").localeCompare(b.times[0] ?? "");
  });

  return rows;
}
