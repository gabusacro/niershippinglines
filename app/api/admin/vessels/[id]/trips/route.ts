import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE: Remove trips for this vessel. Only deletes those with 0 confirmed passengers.
 * Body: { trip_ids: string[] }. Trips must belong to this vessel. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vesselId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Server config: SUPABASE_SERVICE_ROLE_KEY required for delete. Add it to .env.local (Project Settings > API > service_role)." },
      { status: 503 }
    );
  }

  let body: { trip_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tripIds = Array.isArray(body?.trip_ids) ? body.trip_ids.filter((id): id is string => typeof id === "string") : [];
  if (tripIds.length === 0) return NextResponse.json({ error: "Missing trip_ids" }, { status: 400 });

  const { data: vesselTrips } = await db
    .from("trips")
    .select("id")
    .eq("boat_id", vesselId)
    .in("id", tripIds);
  const allowedIds = new Set((vesselTrips ?? []).map((t) => t.id));
  const toConsider = tripIds.filter((id) => allowedIds.has(id));
  if (toConsider.length === 0) {
    return NextResponse.json({ error: "No trips found for this vessel with the given ids." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: futureTrips } = await db.from("trips").select("id").in("id", toConsider).gte("departure_date", today);
  const futureTripIds = new Set((futureTrips ?? []).map((t) => t.id));
  const { data: confirmedBookings } = await db
    .from("bookings")
    .select("trip_id, passenger_count")
    .in("trip_id", toConsider)
    .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
  const confirmedByTrip = new Map<string, number>();
  for (const b of confirmedBookings ?? []) {
    if (!futureTripIds.has(b.trip_id)) continue;
    confirmedByTrip.set(b.trip_id, (confirmedByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
  }
  const toDelete = toConsider.filter((id) => (confirmedByTrip.get(id) ?? 0) === 0);
  const skipped = toConsider.length - toDelete.length;

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, skipped, errors: undefined });
  }

  const CHUNK = 50;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const chunk = toDelete.slice(i, i + CHUNK);
    const { data: tripsData } = await db.from("trips").select("id, departure_date, departure_time, boat:boats(name), route:routes(display_name)").in("id", chunk);
    for (const t of tripsData ?? []) {
      const tt = t as { id: string; departure_date?: string; departure_time?: string; boat?: { name?: string } | null; route?: { display_name?: string } | null };
      const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("trip_id", tt.id);
      const hasBookings = (count ?? 0) > 0;
      if (hasBookings) {
        const snapshotUpdate = {
          trip_snapshot_vessel_name: tt.boat?.name ?? null,
          trip_snapshot_route_name: tt.route?.display_name ?? null,
          trip_snapshot_departure_date: tt.departure_date ?? null,
          trip_snapshot_departure_time: tt.departure_time ?? null,
          trip_id: null,
        };
        let snapErr = (await db.from("bookings").update(snapshotUpdate).eq("trip_id", tt.id)).error;
        if (snapErr) {
          const msg = snapErr.message?.toLowerCase() ?? "";
          if (msg.includes("trip_snapshot") || msg.includes("schema cache") || msg.includes("column")) {
            snapErr = (await db.from("bookings").update({ trip_id: null }).eq("trip_id", tt.id)).error;
          }
          if (snapErr) return NextResponse.json({ error: `bookings: ${snapErr.message}. Run migration 016 in Supabase SQL Editor.` }, { status: 500 });
        }
      }
    }
    const { error: bcErr1 } = await db.from("booking_changes").delete().in("from_trip_id", chunk);
    if (bcErr1) return NextResponse.json({ error: `booking_changes: ${bcErr1.message}` }, { status: 500 });
    const { error: bcErr2 } = await db.from("booking_changes").delete().in("to_trip_id", chunk);
    if (bcErr2) return NextResponse.json({ error: `booking_changes: ${bcErr2.message}` }, { status: 500 });
    const { error: tripErr } = await db.from("trips").delete().in("id", chunk);
    if (tripErr) return NextResponse.json({ error: `trips: ${tripErr.message}` }, { status: 500 });
  }

  revalidatePath("/admin/vessels", "layout");
  return NextResponse.json({ deleted: toDelete.length, skipped, errors: undefined });
}

/**
 * POST: Create trips for this vessel on a route for a date range.
 * Uses schedule_slots for that route to get departure times; creates one trip per (date, time) with this boat.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boatId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { route_id?: string; start_date?: string; end_date?: string; port_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { route_id: routeId, start_date: startDate, end_date: endDate, port_id: portId } = body;
  if (!routeId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing route_id, start_date, or end_date" },
      { status: 400 }
    );
  }
  const portIdOrNull = typeof portId === "string" && portId.trim() ? portId.trim() : null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Invalid start_date or end_date" }, { status: 400 });
  }

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("id, online_quota, capacity")
    .eq("id", boatId)
    .single();
  if (boatError || !boat) {
    return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  }

  const { data: newRoute } = await supabase
    .from("routes")
    .select("origin, destination")
    .eq("id", routeId)
    .single();

  const { data: overlappingTrips, error: overlapError } = await supabase
    .from("trips")
    .select("id, route:routes(origin, destination, display_name)")
    .eq("boat_id", boatId)
    .gte("departure_date", startDate)
    .lte("departure_date", endDate)
    .neq("route_id", routeId);
  if (overlapError) {
    return NextResponse.json({ error: overlapError.message }, { status: 500 });
  }

  const newOrigin = (newRoute as { origin?: string } | null)?.origin ?? "";
  const newDest = (newRoute as { destination?: string } | null)?.destination ?? "";

  for (const t of overlappingTrips ?? []) {
    const r = (t as { route?: { origin?: string; destination?: string; display_name?: string } | null })?.route;
    if (!r) continue;
    const otherOrigin = r.origin ?? "";
    const otherDest = r.destination ?? "";
    const isOppositeRoute = otherOrigin === newDest && otherDest === newOrigin;
    if (isOppositeRoute) continue;
    const otherDisplay = r.display_name ?? "another route";
    return NextResponse.json(
      {
        error: `This vessel is already assigned to ${otherDisplay} for part of this date range. A vessel can only be on one route (or its return leg) per date. Choose a different date range or vessel.`,
      },
      { status: 400 }
    );
  }

  const { data: slots, error: slotsError } = await supabase
    .from("schedule_slots")
    .select("departure_time")
    .eq("route_id", routeId)
    .eq("is_active", true)
    .order("departure_time");
  if (slotsError || !slots?.length) {
    return NextResponse.json(
      { error: "No active schedule slots for this route. Add times in schedule_slots first." },
      { status: 400 }
    );
  }

  const onlineQuota = boat.online_quota ?? 150;
  const walkInQuota = Math.max(0, (boat.capacity ?? 200) - onlineQuota);

  const created: string[] = [];
  let skippedCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    for (const slot of slots) {
      const raw = slot.departure_time;
      const timeForDb = typeof raw === "string"
        ? (raw.length >= 8 ? raw : `${raw.slice(0, 5)}:00`)
        : "00:00:00";

      const { data: existing } = await supabase
        .from("trips")
        .select("id")
        .eq("boat_id", boatId)
        .eq("departure_date", dateStr)
        .eq("departure_time", timeForDb)
        .maybeSingle();

      if (existing) {
        skippedCount++;
        continue;
      }

      const insertPayload: Record<string, unknown> = {
        boat_id: boatId,
        route_id: routeId,
        departure_date: dateStr,
        departure_time: timeForDb,
        online_quota: onlineQuota,
        walk_in_quota: walkInQuota,
        status: "scheduled",
      };
      if (portIdOrNull) insertPayload.port_id = portIdOrNull;

      const { data: newTrip, error: insertErr } = await supabase
        .from("trips")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr) {
        return NextResponse.json(
          { error: insertErr.message, created: created.length },
          { status: 500 }
        );
      }
      if (newTrip?.id) created.push(newTrip.id);
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skippedCount,
    message: `Created ${created.length} trip(s) for this vessel. ${skippedCount} already existed.`,
  });
}
