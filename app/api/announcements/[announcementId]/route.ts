import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { announcementId } = await params;
  if (!announcementId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const supabase = await createClient();

  // Non-admins can only delete their own
  const query = supabase.from("vessel_announcements").delete().eq("id", announcementId);
  if (user.role !== "admin") {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    query.eq("created_by", authUser?.id ?? "");
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Deleted." });
}
