import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/** PATCH: Update trip (e.g. walk_in_booked for ticket booth). Admin or ticket_booth. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "ticket_booth") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const MANIFEST_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

  let body: { walk_in_booked?: number; reconcile_walk_in?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: trip, error: fetchErr } = await supabase
    .from("trips")
    .select("id, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(capacity)")
    .eq("id", id)
    .single();

  if (fetchErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const boat = trip.boat as { capacity?: number } | null;
  const capacity = boat?.capacity ?? (trip.online_quota ?? 0) + (trip.walk_in_quota ?? 0);
  const ob = trip.online_booked ?? 0;

  if (body.reconcile_walk_in === true) {
    const { data: walkInBookings } = await supabase
      .from("bookings")
      .select("passenger_count")
      .eq("trip_id", id)
      .eq("is_walk_in", true)
      .in("status", [...MANIFEST_STATUSES]);
    const wbNew = (walkInBookings ?? []).reduce((s, b) => s + (b.passenger_count ?? 0), 0);
    const { error: updateErr } = await supabase
      .from("trips")
      .update({ walk_in_booked: wbNew })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    revalidatePath("/admin/reports", "layout");
    revalidatePath(`/admin/reports/trip/${id}`, "layout");
    return NextResponse.json({ ok: true, walk_in_booked: wbNew, reconciled: true });
  }

  if (typeof body.walk_in_booked !== "number") {
    return NextResponse.json({ error: "walk_in_booked (number) or reconcile_walk_in (true) required" }, { status: 400 });
  }

  const wbNew = Math.max(0, Math.floor(body.walk_in_booked));
  const maxWalkIn = capacity - ob;

  if (ob + wbNew > capacity) {
    return NextResponse.json({ error: `Total passengers (online ${ob} + walk-in ${wbNew}) cannot exceed capacity ${capacity}. You can enter up to ${maxWalkIn} walk-in.` }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("trips")
    .update({ walk_in_booked: wbNew })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  revalidatePath("/admin/reports", "layout");
  revalidatePath(`/admin/reports/trip/${id}`, "layout");
  return NextResponse.json({ ok: true, walk_in_booked: wbNew });
}

/** DELETE: Remove a trip. Only allowed when no passengers booked. Admin only. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || id === "undefined" || id === "null") {
    return NextResponse.json({ error: "Missing or invalid trip id." }, { status: 400 });
  }
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

  const { data: trip, error: fetchErr } = await db
    .from("trips")
    .select("id, departure_date")
    .eq("id", id)
    .single();
  if (fetchErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const isFutureTrip = (trip.departure_date ?? "") >= today;
  if (isFutureTrip) {
    const { data: confirmedBookings } = await db
      .from("bookings")
      .select("passenger_count")
      .eq("trip_id", id)
      .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
    const confirmedCount = (confirmedBookings ?? []).reduce((s, b) => s + (b.passenger_count ?? 0), 0);
    if (confirmedCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${confirmedCount} confirmed passenger(s) on this future trip. Reassign or refund first.` },
        { status: 400 }
      );
    }
  }

  const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("trip_id", id);
  const hasBookings = (count ?? 0) > 0;
  if (hasBookings) {
    const { data: tripData } = await db.from("trips").select("departure_date, departure_time, boat:boats(name), route:routes(display_name)").eq("id", id).single();
    const tt = tripData as { boat?: { name?: string } | null; route?: { display_name?: string } | null; departure_date?: string; departure_time?: string } | null;
    const snapshotUpdate = {
      trip_snapshot_vessel_name: tt?.boat?.name ?? null,
      trip_snapshot_route_name: tt?.route?.display_name ?? null,
      trip_snapshot_departure_date: tt?.departure_date ?? null,
      trip_snapshot_departure_time: tt?.departure_time ?? null,
      trip_id: null,
    };
    let snapErr = (await db.from("bookings").update(snapshotUpdate).eq("trip_id", id)).error;
    if (snapErr) {
      const msg = snapErr.message?.toLowerCase() ?? "";
      if (msg.includes("trip_snapshot") || msg.includes("schema cache") || msg.includes("column")) {
        snapErr = (await db.from("bookings").update({ trip_id: null }).eq("trip_id", id)).error;
      }
      if (snapErr) return NextResponse.json({ error: snapErr.message + ". Run migration 016 in Supabase SQL Editor." }, { status: 500 });
    }
  }

  await db.from("booking_changes").delete().or(`from_trip_id.eq.${id},to_trip_id.eq.${id}`);
  const { error } = await db.from("trips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/vessels", "layout");
  return NextResponse.json({ ok: true });
}
