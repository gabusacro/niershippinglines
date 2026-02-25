import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/vessels/[id]/crew — list crew for this vessel
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boatId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("boat_assignments")
    .select("id, profile_id, assignment_role, profiles:profile_id (full_name, role)")
    .eq("boat_id", boatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/admin/vessels/[id]/crew — assign crew member
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

  let body: { profile_id: string; assignment_role: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.profile_id || !body.assignment_role) {
    return NextResponse.json({ error: "profile_id and assignment_role are required" }, { status: 400 });
  }

  const validRoles = ["captain", "deck_crew", "ticket_booth"];
  if (!validRoles.includes(body.assignment_role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check not already assigned in same role
  const { data: existing } = await supabase
    .from("boat_assignments")
    .select("id")
    .eq("boat_id", boatId)
    .eq("profile_id", body.profile_id)
    .eq("assignment_role", body.assignment_role)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already assigned in that role." }, { status: 400 });
  }

  const { error } = await supabase
    .from("boat_assignments")
    .insert({ boat_id: boatId, profile_id: body.profile_id, assignment_role: body.assignment_role });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}