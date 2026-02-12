import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/** POST: Delete multiple trips. Only deletes those with 0 confirmed passengers. Admin only. */
export async function POST(request: NextRequest) {
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

  // Only block on confirmed passengers for CURRENT/FUTURE trips (departure_date >= today)
  const today = new Date().toISOString().slice(0, 10);
  const { data: futureTrips } = await db.from("trips").select("id").in("id", tripIds).gte("departure_date", today);
  const futureTripIds = new Set((futureTrips ?? []).map((t) => t.id));
  const { data: confirmedBookings } = await db
    .from("bookings")
    .select("trip_id, passenger_count")
    .in("trip_id", tripIds)
    .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
  const confirmedByTrip = new Map<string, number>();
  for (const b of confirmedBookings ?? []) {
    if (!futureTripIds.has(b.trip_id)) continue; // Past trip — does not block delete
    confirmedByTrip.set(b.trip_id, (confirmedByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
  }
  const toDelete = tripIds.filter((id) => (confirmedByTrip.get(id) ?? 0) === 0);
  const skipped = tripIds.length - toDelete.length;

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
