import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/** POST: Admin marks reschedule fee as paid. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { change_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const changeId = (body.change_id ?? "").trim();
  if (!changeId) return NextResponse.json({ error: "Missing change_id" }, { status: 400 });

  const adminClient = createAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Service unavailable" }, { status: 500 });

  const { error } = await adminClient
    .from("booking_changes")
    .update({ fee_paid: true, fee_paid_at: new Date().toISOString(), fee_confirmed_by: user.id })
    .eq("id", changeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
