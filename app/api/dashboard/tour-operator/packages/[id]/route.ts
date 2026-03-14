import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

// PATCH — update own package (resets approval to pending)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!body.cancellation_policy?.trim()) return NextResponse.json({ error: "Cancellation policy required" }, { status: 400 });

  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("tour_packages")
    .select("id, owner_id, owner_type")
    .eq("id", id)
    .single();

  if (!existing || existing.owner_type !== "operator" || existing.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("tour_packages")
    .update({
      title: body.title.trim(),
      short_description: body.short_description?.trim() ?? null,
      description: body.description?.trim() ?? null,
      accepts_joiners: body.accepts_joiners ?? true,
      accepts_private: body.accepts_private ?? false,
      joiner_price_cents: body.joiner_price_cents > 0 ? body.joiner_price_cents : null,
      private_price_cents: body.private_price_cents > 0 ? body.private_price_cents : null,
      private_is_negotiable: body.private_is_negotiable ?? false,
      pickup_time_label: body.pickup_time_label?.trim() ?? null,
      end_time_label: body.end_time_label?.trim() ?? null,
      duration_label: body.duration_label?.trim() ?? null,
      meeting_point: body.meeting_point?.trim() ?? null,
      cancellation_policy: body.cancellation_policy.trim(),
      is_active: body.is_active ?? true,
      // Reset to pending on every edit
      approval_status: "pending",
      approval_note: null,
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE — delete own package only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("tour_packages")
    .select("id, owner_id, owner_type")
    .eq("id", id)
    .single();

  if (!existing || existing.owner_type !== "operator" || existing.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("tour_packages")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
