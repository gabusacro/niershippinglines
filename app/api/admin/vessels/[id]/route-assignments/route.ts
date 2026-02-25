import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/vessels/[id]/route-assignments
// Returns all route assignments for this vessel with their schedule slots
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boatId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "captain") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: assignments, error } = await supabase
    .from("vessel_route_assignments")
    .select(`
      id,
      boat_id,
      route_id,
      available_from,
      available_until,
      is_active,
      created_at,
      routes:route_id (id, origin, destination, display_name),
      schedule_slots (id, departure_time, slot_label, estimated_travel_minutes, is_active)
    `)
    .eq("boat_id", boatId)
    .order("available_from", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(assignments ?? []);
}

// POST /api/admin/vessels/[id]/route-assignments
// Create a new route assignment for this vessel with departure times
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boatId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    route_id: string;
    available_from: string;
    available_until: string;
    trips: Array<{
      departure_time: string;
      slot_label: string;
      estimated_travel_minutes: number;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { route_id, available_from, available_until, trips } = body;

  if (!route_id || !available_from || !available_until) {
    return NextResponse.json({ error: "route_id, available_from, available_until are required" }, { status: 400 });
  }
  if (!trips || trips.length === 0) {
    return NextResponse.json({ error: "At least one departure time is required" }, { status: 400 });
  }
  if (new Date(available_from) > new Date(available_until)) {
    return NextResponse.json({ error: "available_from must be before available_until" }, { status: 400 });
  }

  // Check for overlapping assignments on same route for this vessel
  const { data: existing } = await supabase
    .from("vessel_route_assignments")
    .select("id, available_from, available_until")
    .eq("boat_id", boatId)
    .eq("route_id", route_id)
    .eq("is_active", true);

  for (const ex of existing ?? []) {
    const exFrom = new Date(ex.available_from);
    const exUntil = new Date(ex.available_until);
    const newFrom = new Date(available_from);
    const newUntil = new Date(available_until);
    if (newFrom <= exUntil && newUntil >= exFrom) {
      return NextResponse.json({
        error: `Overlapping date range with existing assignment (${ex.available_from} to ${ex.available_until}). Deactivate the existing one first.`
      }, { status: 400 });
    }
  }

  // Create the assignment
  const { data: assignment, error: assignError } = await supabase
    .from("vessel_route_assignments")
    .insert({
      boat_id: boatId,
      route_id,
      available_from,
      available_until,
      is_active: true,
    })
    .select("id")
    .single();

  if (assignError || !assignment) {
    return NextResponse.json({ error: assignError?.message ?? "Failed to create assignment" }, { status: 500 });
  }

  // Create schedule slots for each trip
  const slotsToInsert = trips.map((t) => ({
    boat_id: boatId,
    route_id,
    vessel_route_assignment_id: assignment.id,
    departure_time: t.departure_time,
    slot_label: t.slot_label || null,
    estimated_travel_minutes: t.estimated_travel_minutes || 120,
    is_active: true,
  }));

  const { error: slotsError } = await supabase
    .from("schedule_slots")
    .insert(slotsToInsert);

  if (slotsError) {
    // Rollback the assignment
    await supabase.from("vessel_route_assignments").delete().eq("id", assignment.id);
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  // Now generate trips for each date in the range
  const start = new Date(available_from);
  const end = new Date(available_until);
  const tripsToCreate: Array<{
    boat_id: string;
    route_id: string;
    departure_date: string;
    departure_time: string;
    estimated_arrival_time: string;
    online_quota: number;
    walk_in_quota: number;
    status: string;
    trip_label: string | null;
  }> = [];

  // Get boat quotas
  const { data: boat } = await supabase
    .from("boats")
    .select("capacity, online_quota")
    .eq("id", boatId)
    .single();

  const onlineQuota = boat?.online_quota ?? 50;
  const walkInQuota = (boat?.capacity ?? 150) - onlineQuota;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    for (const trip of trips) {
      // Calculate arrival time
      const [h, m] = trip.departure_time.split(":").map(Number);
      const depMinutes = (h ?? 0) * 60 + (m ?? 0);
      const arrMinutes = depMinutes + (trip.estimated_travel_minutes || 120);
      const arrH = Math.floor(arrMinutes / 60) % 24;
      const arrM = arrMinutes % 60;
      const arrivalTime = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}:00`;

      tripsToCreate.push({
        boat_id: boatId,
        route_id,
        departure_date: dateStr,
        departure_time: trip.departure_time,
        estimated_arrival_time: arrivalTime,
        online_quota: onlineQuota,
        walk_in_quota: walkInQuota,
        status: "scheduled",
        trip_label: trip.slot_label || null,
      });
    }
  }

  // Insert trips (skip duplicates)
  if (tripsToCreate.length > 0) {
    const { error: tripsError } = await supabase
      .from("trips")
      .upsert(tripsToCreate, {
        onConflict: "boat_id,route_id,departure_date,departure_time",
        ignoreDuplicates: true,
      });

    if (tripsError) {
      console.error("Trips creation error:", tripsError);
      // Don't rollback — assignment and slots are fine, trips can be added manually
    }
  }

  return NextResponse.json({
    ok: true,
    assignment_id: assignment.id,
    trips_created: tripsToCreate.length,
  });
}
