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

type VesselInfo = { boatId: string; name: string; image_url: string | null };

/**
 * Returns route IDs that have at least one upcoming trip with a boat in "running" status,
 * and one representative vessel (id, name, image_url) per route for display.
 */
async function getRouteIdsWithAvailableVessels(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ routeIds: Set<string>; vesselByRouteId: Map<string, VesselInfo> }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: trips } = await supabase
    .from("trips")
    .select("route_id, boat:boats(id, name, status, image_url)")
    .gte("departure_date", today);

  const routeIds = new Set<string>();
  const vesselByRouteId = new Map<string, VesselInfo>();
  if (!trips?.length) return { routeIds, vesselByRouteId };

  for (const t of trips) {
    const row = t as { route_id: string; boat?: { id?: string; name?: string; status?: string; image_url?: string | null } | null };
    const boat = row.boat;
    if (boat?.status === "running" && boat?.id) {
      routeIds.add(row.route_id);
      if (!vesselByRouteId.has(row.route_id) && boat.name) {
        vesselByRouteId.set(row.route_id, {
          boatId: boat.id,
          name: boat.name,
          image_url: boat.image_url ?? null,
        });
      }
    }
  }
  return { routeIds, vesselByRouteId };
}

/**
 * Fetches schedule from Supabase: each route with its active departure times (from schedule_slots).
 * Only includes routes that have at least one upcoming trip with a vessel in "running" status.
 */
export async function getScheduleFromSupabase(): Promise<ScheduleRow[]> {
  const supabase = await createClient();

  const [{ routeIds: routeIdsWithVessels, vesselByRouteId }, slotsResult] = await Promise.all([
    getRouteIdsWithAvailableVessels(supabase),
    supabase
      .from("schedule_slots")
      .select("route_id, departure_time")
      .eq("is_active", true)
      .order("departure_time"),
  ]);

  const { data: slots, error: slotsError } = slotsResult;
  if (slotsError || !slots?.length) {
    return [];
  }

  const routeIds = [...new Set(slots.map((s) => s.route_id))].filter((id) => routeIdsWithVessels.has(id));
  if (routeIds.length === 0) return [];

  const boatIds = [...new Set([...vesselByRouteId.values()].map((v) => v.boatId))];
  const { data: boatImagesRows } = boatIds.length > 0
    ? await supabase
        .from("boat_images")
        .select("boat_id, image_url, sort_order")
        .in("boat_id", boatIds)
        .order("sort_order")
    : { data: [] };
  const imagesByBoatId = new Map<string, string[]>();
  for (const row of boatImagesRows ?? []) {
    const r = row as { boat_id: string; image_url: string; sort_order: number };
    const arr = imagesByBoatId.get(r.boat_id) ?? [];
    arr.push(r.image_url);
    imagesByBoatId.set(r.boat_id, arr);
  }

  const { data: routes, error: routesError } = await supabase
    .from("routes")
    .select("id, origin, destination, display_name")
    .in("id", routeIds)
    .order("display_name");

  if (routesError || !routes?.length) {
    return [];
  }

  const slotsByRouteId = new Map<string, { time: string; formatted: string }[]>();
  for (const s of slots) {
    if (!routeIdsWithVessels.has(s.route_id)) continue;
    const timeStr = typeof s.departure_time === "string" ? s.departure_time : "";
    const formatted = formatTimeForDisplay(timeStr);
    if (!formatted) continue;
    const arr = slotsByRouteId.get(s.route_id) ?? [];
    arr.push({ time: timeStr, formatted });
    slotsByRouteId.set(s.route_id, arr);
  }

  return routes.map((r) => {
    const vessel = vesselByRouteId.get(r.id);
    const mainUrl = vessel?.image_url ?? null;
    const extraUrls = vessel ? (imagesByBoatId.get(vessel.boatId) ?? []) : [];
    const vesselImageUrls = mainUrl ? [mainUrl, ...extraUrls] : extraUrls;
    const slotList = slotsByRouteId.get(r.id) ?? [];
    const times = slotList.map((s) => s.formatted);
    const origin = r.origin ?? "";
    const destination = r.destination ?? "";
    const timesWithDirection: TimeWithDirection[] = slotList.map((s, idx) => ({
      time: s.formatted,
      directionLabel: idx === 0 ? `${origin} → ${destination}` : `${destination} → ${origin}`,
    }));
    return {
      routeId: r.id,
      routeDisplayName: r.display_name,
      routeOrigin: origin,
      routeDestination: destination,
      times,
      timesWithDirection,
      vesselImageUrl: mainUrl,
      vesselImageUrls: vesselImageUrls.length > 0 ? vesselImageUrls : undefined,
      vesselName: vessel?.name,
    };
  }).filter((row) => row.times.length > 0);
}
