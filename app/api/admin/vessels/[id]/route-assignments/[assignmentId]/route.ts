import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// PATCH: Toggle active or update date range — auto-extends/trims trips
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id: boatId, assignmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { is_active?: boolean; available_from?: string; available_until?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch current assignment BEFORE updating
  const { data: oldAssignment } = await supabase
    .from("vessel_route_assignments")
    .select("route_id, available_from, available_until, is_active, schedule_slots(boat_id, route_id, departure_time, estimated_travel_minutes, is_active)")
    .eq("id", assignmentId)
    .eq("boat_id", boatId)
    .single();

  if (!oldAssignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (body.available_from) updates.available_from = body.available_from;
  if (body.available_until) updates.available_until = body.available_until;

  const { error } = await supabase
    .from("vessel_route_assignments")
    .update(updates)
    .eq("id", assignmentId)
    .eq("boat_id", boatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Auto-sync trips ────────────────────────────────────────────────────────
  const db = createAdminClient();
  if (db) {
    const today = new Date().toISOString().slice(0, 10);
    const newUntil = body.available_until ?? (oldAssignment.available_until as string);
    const oldUntil = oldAssignment.available_until as string;
    const routeId = oldAssignment.route_id as string;
    const slots = ((oldAssignment.schedule_slots as Array<{
      boat_id: string; route_id: string; departure_time: string;
      estimated_travel_minutes: number; is_active: boolean;
    }>) ?? []).filter((s) => s.is_active);

    // Case 1: Range EXTENDED — generate new trips from old end+1 to new end
    if (newUntil > oldUntil && slots.length > 0) {
      const { data: boat } = await db.from("boats").select("capacity, online_quota").eq("id", boatId).single();
      const onlineQuota = boat?.online_quota ?? 50;
      const walkInQuota = (boat?.capacity ?? 150) - onlineQuota;
      const extendFrom = new Date(oldUntil);
      extendFrom.setDate(extendFrom.getDate() + 1);
      const extendTo = new Date(newUntil);
      const tripsToCreate: Array<Record<string, unknown>> = [];
      for (let d = new Date(extendFrom); d <= extendTo; d.setDate(d.getDate() + 1)) {
        for (const slot of slots) {
          const [h, m] = slot.departure_time.split(":").map(Number);
          const depMins = (h ?? 0) * 60 + (m ?? 0);
          const arrMins = depMins + (slot.estimated_travel_minutes ?? 120);
          const arrH = Math.floor(arrMins / 60) % 24;
          const arrM = arrMins % 60;
          tripsToCreate.push({
            boat_id: boatId, route_id: routeId,
            departure_date: d.toISOString().slice(0, 10),
            departure_time: slot.departure_time,
            estimated_arrival_time: `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}:00`,
            online_quota: onlineQuota, walk_in_quota: walkInQuota, status: "scheduled",
          });
        }
      }
      if (tripsToCreate.length > 0) {
        await db.from("trips").upsert(tripsToCreate, {
          onConflict: "boat_id,route_id,departure_date,departure_time",
          ignoreDuplicates: true,
        });
      }
    }

    // Case 2: Range SHORTENED — delete unbooked trips after new end date
    if (newUntil < oldUntil) {
      const afterNewEnd = new Date(newUntil);
      afterNewEnd.setDate(afterNewEnd.getDate() + 1);
      const { data: extraTrips } = await db.from("trips").select("id")
        .eq("boat_id", boatId).eq("route_id", routeId)
        .gte("departure_date", afterNewEnd.toISOString().slice(0, 10)).eq("status", "scheduled");
      const extraIds = (extraTrips ?? []).map((t) => t.id);
      if (extraIds.length > 0) {
        const { data: bookedTrips } = await db.from("bookings").select("trip_id")
          .in("trip_id", extraIds)
          .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"]);
        const bookedSet = new Set((bookedTrips ?? []).map((b) => b.trip_id));
        const deletable = extraIds.filter((id) => !bookedSet.has(id));
        if (deletable.length > 0) await db.from("trips").delete().in("id", deletable);
      }
    }

    // Case 3: Deactivated — delete ALL future unbooked trips for this vessel+route
    if (body.is_active === false) {
      const { data: futureTrips } = await db.from("trips").select("id")
        .eq("boat_id", boatId).eq("route_id", routeId)
        .gte("departure_date", today).eq("status", "scheduled");
      const futureIds = (futureTrips ?? []).map((t) => t.id);
      if (futureIds.length > 0) {
        const { data: bookedTrips } = await db.from("bookings").select("trip_id")
          .in("trip_id", futureIds)
          .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"]);
        const bookedSet = new Set((bookedTrips ?? []).map((b) => b.trip_id));
        const deletable = futureIds.filter((id) => !bookedSet.has(id));
        if (deletable.length > 0) await db.from("trips").delete().in("id", deletable);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE: Remove assignment and auto-delete its future unbooked trips
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id: boatId, assignmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: assignment } = await supabase
    .from("vessel_route_assignments").select("route_id")
    .eq("id", assignmentId).eq("boat_id", boatId).single();
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: futureTrips } = await supabase.from("trips").select("id")
    .eq("boat_id", boatId).eq("route_id", assignment.route_id as string)
    .gte("departure_date", today);

  if (futureTrips && futureTrips.length > 0) {
    const tripIds = futureTrips.map((t) => t.id);

    // Block if confirmed bookings exist
    const { count } = await supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .in("trip_id", tripIds)
      .in("status", ["confirmed", "checked_in", "boarded"]);
    if ((count ?? 0) > 0) {
      return NextResponse.json({
        error: `Cannot remove: ${count} confirmed booking(s) on future trips. Cancel or reassign them first.`
      }, { status: 400 });
    }

    // Delete future unbooked trips
    const db = createAdminClient();
    if (db) {
      const { data: bookedTrips } = await db.from("bookings").select("trip_id")
        .in("trip_id", tripIds)
        .in("status", ["confirmed", "checked_in", "boarded", "completed", "pending_payment"]);
      const bookedSet = new Set((bookedTrips ?? []).map((b) => b.trip_id));
      const deletable = tripIds.filter((id) => !bookedSet.has(id));
      if (deletable.length > 0) await db.from("trips").delete().in("id", deletable);
    }
  }

  const { error } = await supabase.from("vessel_route_assignments").delete()
    .eq("id", assignmentId).eq("boat_id", boatId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
