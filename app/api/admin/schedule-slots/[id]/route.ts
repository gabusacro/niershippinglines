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
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    is_active?: boolean;
    slot_label?: string | null;
    departure_time?: string;
    estimated_travel_minutes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch slot BEFORE updating so we have the old departure_time
  const { data: oldSlot, error: fetchError } = await supabase
    .from("schedule_slots")
    .select("id, departure_time, estimated_travel_minutes, boat_id, route_id, vessel_route_assignment_id")
    .eq("id", id)
    .single();

  if (fetchError || !oldSlot) {
    return NextResponse.json({ error: fetchError?.message ?? "Slot not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if ("slot_label" in body) updates.slot_label = body.slot_label;
  if (body.departure_time) updates.departure_time = body.departure_time;
  if (body.estimated_travel_minutes) updates.estimated_travel_minutes = body.estimated_travel_minutes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("schedule_slots")
    .update(updates)
    .eq("id", id)
    .select("id, is_active, slot_label, departure_time, estimated_travel_minutes, boat_id, route_id, vessel_route_assignment_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Auto-sync trips when departure_time changed ────────────────────────────
  const newTime = body.departure_time;
  const oldTime = (oldSlot.departure_time as string) ?? "";
  const timeChanged = newTime && newTime.slice(0, 5) !== oldTime.slice(0, 5);
  const travelChanged = body.estimated_travel_minutes != null &&
    body.estimated_travel_minutes !== oldSlot.estimated_travel_minutes;

  if ((timeChanged || travelChanged) && oldSlot.boat_id && oldSlot.route_id) {
    const db = createAdminClient();
    if (db) {
      const today = new Date().toISOString().slice(0, 10);
      const travelMins = body.estimated_travel_minutes ?? (oldSlot.estimated_travel_minutes as number) ?? 120;
      const effectiveNewTime = newTime ?? oldTime;

      // Get assignment date range
      let availableUntil = "2099-12-31";
      if (oldSlot.vessel_route_assignment_id) {
        const { data: assignment } = await db
          .from("vessel_route_assignments")
          .select("available_until")
          .eq("id", oldSlot.vessel_route_assignment_id)
          .single();
        if (assignment?.available_until) availableUntil = assignment.available_until;
      }

      // Step 1: Find future trips with the OLD departure time
      const { data: oldTrips } = await db
        .from("trips")
        .select("id")
        .eq("boat_id", oldSlot.boat_id as string)
        .eq("route_id", oldSlot.route_id as string)
        .eq("departure_time", oldTime)
        .gte("departure_date", today)
        .eq("status", "scheduled");

      const oldTripIds = (oldTrips ?? []).map((t) => t.id);

      if (oldTripIds.length > 0) {
        // Only delete trips with no active bookings
        const { data: bookedTrips } = await db
          .from("bookings")
          .select("trip_id")
          .in("trip_id", oldTripIds)
          .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"]);
        const bookedSet = new Set((bookedTrips ?? []).map((b) => b.trip_id));
        const deletable = oldTripIds.filter((tid) => !bookedSet.has(tid));
        if (deletable.length > 0) {
          await db.from("trips").delete().in("id", deletable);
        }
      }

      // Step 2: Regenerate trips with the NEW departure time
      if (timeChanged && effectiveNewTime) {
        const [h, m] = effectiveNewTime.split(":").map(Number);
        const depMins = (h ?? 0) * 60 + (m ?? 0);
        const arrMins = depMins + travelMins;
        const arrH = Math.floor(arrMins / 60) % 24;
        const arrM = arrMins % 60;
        const arrivalTime = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}:00`;
        const departureTimeFull = effectiveNewTime.length === 5
          ? `${effectiveNewTime}:00`
          : effectiveNewTime;

        const { data: boat } = await db
          .from("boats").select("capacity, online_quota")
          .eq("id", oldSlot.boat_id as string).single();
        const onlineQuota = boat?.online_quota ?? 50;
        const walkInQuota = (boat?.capacity ?? 150) - onlineQuota;

        const tripsToCreate: Array<Record<string, unknown>> = [];
        const end = new Date(availableUntil);
        for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
          tripsToCreate.push({
            boat_id: oldSlot.boat_id,
            route_id: oldSlot.route_id,
            departure_date: d.toISOString().slice(0, 10),
            departure_time: departureTimeFull,
            estimated_arrival_time: arrivalTime,
            online_quota: onlineQuota,
            walk_in_quota: walkInQuota,
            status: "scheduled",
          });
        }

        if (tripsToCreate.length > 0) {
          await db.from("trips").upsert(tripsToCreate, {
            onConflict: "boat_id,route_id,departure_date,departure_time",
            ignoreDuplicates: true,
          });
        }
      }
    }
  }

  return NextResponse.json(data);
}

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

  // Get slot info BEFORE deleting
  const { data: slot } = await supabase
    .from("schedule_slots")
    .select("boat_id, route_id, departure_time")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("schedule_slots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-delete future unbooked trips for this departure time
  if (slot?.boat_id && slot?.route_id && slot?.departure_time) {
    const db = createAdminClient();
    if (db) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: oldTrips } = await db
        .from("trips").select("id")
        .eq("boat_id", slot.boat_id).eq("route_id", slot.route_id)
        .eq("departure_time", slot.departure_time)
        .gte("departure_date", today).eq("status", "scheduled");

      const oldTripIds = (oldTrips ?? []).map((t) => t.id);
      if (oldTripIds.length > 0) {
        const { data: bookedTrips } = await db
          .from("bookings").select("trip_id")
          .in("trip_id", oldTripIds)
          .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"]);
        const bookedSet = new Set((bookedTrips ?? []).map((b) => b.trip_id));
        const deletable = oldTripIds.filter((tid) => !bookedSet.has(tid));
        if (deletable.length > 0) await db.from("trips").delete().in("id", deletable);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
