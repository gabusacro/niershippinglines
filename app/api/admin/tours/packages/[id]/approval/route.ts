import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action, note } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "reject" && !note?.trim()) {
    return NextResponse.json({ error: "Rejection note required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tour_packages")
    .update({
      approval_status: action === "approve" ? "approved" : "rejected",
      approval_note: action === "reject" ? note.trim() : null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      // Auto-activate on approval
      is_active: action === "approve" ? true : false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_type", "operator"); // safety: only operator packages

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
