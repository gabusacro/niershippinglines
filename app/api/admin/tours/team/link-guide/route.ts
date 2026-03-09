import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tour_operator_id, tour_guide_id, assigned_by } = await request.json();

  if (!tour_operator_id || !tour_guide_id) {
    return NextResponse.json({ error: "Missing operator or guide id" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if already linked
  const { data: existing } = await supabase
    .from("tour_guide_assignments")
    .select("id, is_active")
    .eq("tour_operator_id", tour_operator_id)
    .eq("tour_guide_id", tour_guide_id)
    .single();

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json({ error: "Guide is already linked to this operator" }, { status: 400 });
    }
    // Reactivate
    const { data, error } = await supabase
      .from("tour_guide_assignments")
      .update({ is_active: true, assigned_by, assigned_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*, operator:tour_operator_id(full_name, email), guide:tour_guide_id(full_name, email)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ assignment: data });
  }

  const { data, error } = await supabase
    .from("tour_guide_assignments")
    .insert({ tour_operator_id, tour_guide_id, assigned_by, is_active: true })
    .select("*, operator:tour_operator_id(full_name, email), guide:tour_guide_id(full_name, email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
