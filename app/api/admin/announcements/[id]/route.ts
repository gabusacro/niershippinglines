import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE: Remove an announcement.
 * Allowed: admin (any), or captain (only their own, i.e. created_by = self).
 */
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

  const role = profile?.role;
  const isAdmin = role === "admin";
  const isCaptain = role === "captain";
  if (!isAdmin && !isCaptain) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("vessel_announcements")
    .select("id, created_by")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  if (!isAdmin && (row as { created_by: string }).created_by !== user.id) {
    return NextResponse.json({ error: "You can only delete your own announcements" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("vessel_announcements")
    .delete()
    .eq("id", id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
