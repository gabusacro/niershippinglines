import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** PATCH: Update route origin, destination, display_name. Admin only. */
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

  let body: { origin?: string; destination?: string; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (typeof body.origin === "string" && body.origin.trim()) updates.origin = body.origin.trim();
  if (typeof body.destination === "string" && body.destination.trim()) updates.destination = body.destination.trim();
  if (typeof body.display_name === "string" && body.display_name.trim()) updates.display_name = body.display_name.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("routes")
    .update(updates)
    .eq("id", id)
    .select("id, origin, destination, display_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE: Remove a route. Fails if it has trips. Deletes schedule_slots for this route. Admin only. */
export async function DELETE(
  _request: NextRequest,
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

  const { count } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("route_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this route has ${count} trip(s). Remove or reassign trips first (Admin → Vessels → Manage vessel).` },
      { status: 400 }
    );
  }

  const { error: slotsErr } = await supabase
    .from("schedule_slots")
    .delete()
    .eq("route_id", id);
  if (slotsErr) return NextResponse.json({ error: `schedule_slots: ${slotsErr.message}` }, { status: 500 });

  const { error: routeErr } = await supabase
    .from("routes")
    .delete()
    .eq("id", id);
  if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
