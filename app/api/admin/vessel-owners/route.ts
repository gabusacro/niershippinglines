import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();

  // Get all vessel assignments with owner and boat info
  const { data: assignments, error } = await supabase
    .from("vessel_assignments")
    .select("id, patronage_bonus_percent, assigned_at, vessel_owner_id, boat_id, boat:boats(id, name), owner:profiles(id, full_name, email: id)")
    .order("assigned_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get all vessel_owner profiles
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "vessel_owner")
    .order("full_name");

  // Get all boats
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name")
    .order("name");

  return NextResponse.json({ assignments: assignments ?? [], owners: owners ?? [], boats: boats ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { vessel_owner_id, boat_id, patronage_bonus_percent } = await req.json();
  if (!vessel_owner_id || !boat_id) {
    return NextResponse.json({ error: "Owner and vessel required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vessel_assignments")
    .upsert({ vessel_owner_id, boat_id, patronage_bonus_percent: patronage_bonus_percent ?? 0 }, { onConflict: "boat_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, patronage_bonus_percent } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vessel_assignments")
    .update({ patronage_bonus_percent })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("vessel_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Promote a passenger to vessel_owner role
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user_id, role } = await req.json();
  if (!user_id) return NextResponse.json({ error: "User ID required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: role ?? "vessel_owner" })
    .eq("id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
