import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["admin", "captain", "crew", "ticket_booth", "passenger", "vessel_owner", "investor"];

// PATCH /api/admin/users/[userId]/role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { role: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent removing the last admin
  if (body.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const { data: targetProfile } = await supabase
      .from("profiles").select("role").eq("id", userId).single();

    if (targetProfile?.role === "admin" && (count ?? 0) <= 1) {
      return NextResponse.json({
        error: "Cannot remove the last admin. Promote another user to admin first."
      }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
