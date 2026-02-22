import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();

  const { data: investors } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "investor")
    .order("full_name");

  const { data: shares } = await supabase
    .from("investor_shares")
    .select("id, investor_id, share_percent, notes, created_at")
    .order("created_at");

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .neq("role", "admin")
    .order("full_name");

  return NextResponse.json({
    investors: investors ?? [],
    shares: shares ?? [],
    allProfiles: allProfiles ?? [],
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { investor_id, share_percent, notes } = await req.json();
  if (!investor_id) return NextResponse.json({ error: "Investor required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investor_shares")
    .upsert({ investor_id, share_percent: share_percent ?? 0, notes: notes ?? null }, { onConflict: "investor_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, share_percent, notes } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investor_shares")
    .update({ share_percent, notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("investor_shares").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Promote user to investor role
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
    .update({ role: role ?? "investor" })
    .eq("id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
