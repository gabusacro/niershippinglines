import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/** GET: fetch all announcements (admin/ticket_booth) */
export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vessel_announcements")
    .select("id, message, vessel_id, created_by, created_at, active_until")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creatorIds = [...new Set((data ?? []).map((a) => a.created_by).filter(Boolean) as string[])];
  const creatorNames = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    for (const p of profiles ?? []) creatorNames.set(p.id, p.full_name ?? "Unknown");
  }

  const vesselIds = [...new Set((data ?? []).map((a) => a.vessel_id).filter(Boolean) as string[])];
  const vesselNames = new Map<string, string>();
  if (vesselIds.length > 0) {
    const { data: boats } = await supabase.from("boats").select("id, name").in("id", vesselIds);
    for (const b of boats ?? []) vesselNames.set(b.id, b.name);
  }

  return NextResponse.json(
    (data ?? []).map((a) => ({
      id: a.id,
      message: a.message,
      vessel_id: a.vessel_id ?? null,
      vessel_name: a.vessel_id ? (vesselNames.get(a.vessel_id) ?? null) : null,
      created_by: a.created_by ?? null,
      created_by_name: a.created_by ? (creatorNames.get(a.created_by) ?? "Unknown") : "Unknown",
      created_at: a.created_at,
      active_until: a.active_until ?? null,
    }))
  );
}

/** POST: create new announcement */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const vessel_id = typeof b.vessel_id === "string" ? b.vessel_id : null;
  const active_until = typeof b.active_until === "string" ? b.active_until : null;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("vessel_announcements")
    .insert({
      message,
      vessel_id,
      active_until,
      created_by: authUser?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, message: "Announcement posted." });
}
