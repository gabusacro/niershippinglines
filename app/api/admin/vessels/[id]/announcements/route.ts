import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET: List announcements for this vessel + all-vessel announcements (for manage page).
 * Returns created_by so UI can show delete for own/admin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vesselId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "captain") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role === "captain") {
    let assignments: { boat_id: string }[] = [];
    try {
      const res = await supabase
        .from("boat_assignments")
        .select("boat_id")
        .eq("profile_id", user.id)
        .eq("boat_id", vesselId);
      assignments = res.data ?? [];
    } catch {
      // boat_assignments table may not exist yet
    }
    if (!assignments.length) {
      return NextResponse.json({ error: "You can only view announcements for vessels you are assigned to" }, { status: 403 });
    }
  }

  const { data: rows, error } = await supabase
    .from("vessel_announcements")
    .select("id, message, vessel_id, created_at, created_by")
    .or(`vessel_id.eq.${vesselId},vessel_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const vesselIds = [...new Set((rows ?? []).map((r) => r.vessel_id).filter(Boolean) as string[])];
  const vesselNames = new Map<string, string>();
  if (vesselIds.length > 0) {
    const { data: boats } = await supabase.from("boats").select("id, name").in("id", vesselIds);
    for (const b of boats ?? []) vesselNames.set(b.id, b.name);
  }

  const list = (rows ?? []).map((r) => ({
    id: r.id,
    message: r.message,
    vesselId: r.vessel_id,
    vesselName: r.vessel_id ? vesselNames.get(r.vessel_id) ?? null : null,
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));

  return NextResponse.json(list);
}

/**
 * POST: Create announcement for this vessel (or all vessels if admin and scope=all).
 * Allowed: admin (any scope), captain (only this vessel; must be assigned via boat_assignments).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vesselId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isAdmin = role === "admin";
  const isCaptain = role === "captain";
  if (!isAdmin && !isCaptain) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { message?: string; scope?: "vessel" | "all" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const scope = body.scope === "all" ? "all" : "vessel";
  let insertVesselId: string | null = vesselId;
  if (scope === "all") {
    if (!isAdmin) return NextResponse.json({ error: "Only admin can post for all vessels" }, { status: 403 });
    insertVesselId = null;
  } else {
    if (isCaptain) {
      let assignments: { boat_id: string }[] = [];
      try {
        const res = await supabase
          .from("boat_assignments")
          .select("boat_id")
          .eq("profile_id", user.id)
          .eq("boat_id", vesselId);
        assignments = res.data ?? [];
      } catch {
        // boat_assignments table may not exist yet
      }
      if (!assignments.length) {
        return NextResponse.json({ error: "You can only post for vessels you are assigned to" }, { status: 403 });
      }
    }
  }

  const { data, error } = await supabase
    .from("vessel_announcements")
    .insert({
      vessel_id: insertVesselId,
      created_by: user.id,
      message,
    })
    .select("id, message, vessel_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
