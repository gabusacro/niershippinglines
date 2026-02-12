import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  let body: { name?: string; capacity?: number; online_quota?: number; status?: string; image_url?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.capacity === "number" && body.capacity > 0) updates.capacity = body.capacity;
  if (typeof body.online_quota === "number" && body.online_quota >= 0) updates.online_quota = body.online_quota;
  if (body.status === "running" || body.status === "maintenance") updates.status = body.status;
  if (body.image_url !== undefined) updates.image_url = typeof body.image_url === "string" ? body.image_url.trim() || null : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("boats")
    .update(updates)
    .eq("id", id)
    .select("id, name, capacity, online_quota, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE: Remove vessel. Fails if it has trips. Admin only. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: vesselTrips } = await db
    .from("trips")
    .select("id")
    .eq("boat_id", id);
  const tripIds = (vesselTrips ?? []).map((t) => t.id);
  const tripCount = tripIds.length;

  if (tripCount > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: futureTrips } = await db.from("trips").select("id").in("id", tripIds).gte("departure_date", today);
    const futureTripIds = new Set((futureTrips ?? []).map((t) => t.id));
    const { data: confirmedBookings } = await db
      .from("bookings")
      .select("trip_id, passenger_count")
      .in("trip_id", tripIds)
      .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
    const confirmedOnFuture = (confirmedBookings ?? [])
      .filter((b) => futureTripIds.has(b.trip_id))
      .reduce((s, b) => s + (b.passenger_count ?? 0), 0);
    if (confirmedOnFuture > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${confirmedOnFuture} confirmed passenger(s) on current/future trips. Reassign or refund first. Past trips with no-shows do not block.`,
          trip_count: tripCount,
          booked_count: confirmedOnFuture,
        },
        { status: 400 }
      );
    }
    for (const tripId of tripIds) {
      const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
      const hasBookings = (count ?? 0) > 0;
      if (hasBookings) {
        const { data: tData } = await db.from("trips").select("departure_date, departure_time, boat:boats(name), route:routes(display_name)").eq("id", tripId).single();
        const tt = tData as { boat?: { name?: string } | null; route?: { display_name?: string } | null; departure_date?: string; departure_time?: string } | null;
        const snapshotUpdate = {
          trip_snapshot_vessel_name: tt?.boat?.name ?? null,
          trip_snapshot_route_name: tt?.route?.display_name ?? null,
          trip_snapshot_departure_date: tt?.departure_date ?? null,
          trip_snapshot_departure_time: tt?.departure_time ?? null,
          trip_id: null,
        };
        let snapErr = (await db.from("bookings").update(snapshotUpdate).eq("trip_id", tripId)).error;
        if (snapErr) {
          const msg = snapErr.message?.toLowerCase() ?? "";
          if (msg.includes("trip_snapshot") || msg.includes("schema cache") || msg.includes("column")) {
            snapErr = (await db.from("bookings").update({ trip_id: null }).eq("trip_id", tripId)).error;
          }
          if (snapErr) return NextResponse.json({ error: `bookings: ${snapErr.message}. Run migration 016 in Supabase SQL Editor.` }, { status: 500 });
        }
      }
      await db.from("booking_changes").delete().or(`from_trip_id.eq.${tripId},to_trip_id.eq.${tripId}`);
      const { error: tripDelErr } = await db.from("trips").delete().eq("id", tripId);
      if (tripDelErr) {
        return NextResponse.json(
          { error: `Could not remove trips: ${tripDelErr.message}. Some trips may still have bookings.` },
          { status: 500 }
        );
      }
    }
  }

  const { error } = await db.from("boats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
