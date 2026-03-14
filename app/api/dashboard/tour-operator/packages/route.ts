import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/dashboard/tour-operator/packages — create new package
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!body.cancellation_policy?.trim()) return NextResponse.json({ error: "Cancellation policy required" }, { status: 400 });

  const supabase = await createClient();

  // Generate slug from title
  const slug = body.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

  const { data, error } = await supabase
    .from("tour_packages")
    .insert({
      title: body.title.trim(),
      slug,
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
      owner_type: "operator",
      owner_id: user.id,
      approval_status: "pending",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
