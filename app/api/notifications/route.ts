import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET: Fetch unread notifications for the logged-in user */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, read_at, action_url, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    notifications: data ?? [],
    unread_count: (data ?? []).filter(n => !n.read_at).length,
  });
}

/** PATCH: Mark notification(s) as read */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; mark_all?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const now = new Date().toISOString();

  if (body.mark_all) {
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("profile_id", user.id)
      .is("read_at", null);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("profile_id", user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing id or mark_all" }, { status: 400 });
}
