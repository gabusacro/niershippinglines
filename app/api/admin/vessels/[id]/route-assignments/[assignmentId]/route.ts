import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/vessels/[id]/route-assignments/[assignmentId]
// Toggle active status or update date range
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id: boatId, assignmentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { is_active?: boolean; available_from?: string; available_until?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/vessels/[id]/route-assignments/[assignmentId]
// Removes assignment + its schedule slots (trips remain for history)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id: boatId, assignmentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check for future confirmed bookings before deleting
  const { data: assignment } = await supabase
    .from("vessel_route_assignments")
    .select("route_id, available_from, available_until")
    .eq("id", assignmentId)
    .eq("boat_id", boatId)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: futureTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("boat_id", boatId)
    .eq("route_id", assignment.route_id)
    .gte("departure_date", today);

  if (futureTrips && futureTrips.length > 0) {
    const tripIds = futureTrips.map((t) => t.id);
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("trip_id", tripIds)
      .in("status", ["confirmed", "checked_in", "boarded"]);

    if ((count ?? 0) > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${count} confirmed booking(s) on future trips. Cancel or reassign them first.`
      }, { status: 400 });
    }
  }

  // Delete slots (cascade from assignment)
  const { error } = await supabase
    .from("vessel_route_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("boat_id", boatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
