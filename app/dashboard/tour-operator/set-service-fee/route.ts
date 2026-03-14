import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id, service_fee_cents } = await request.json();
  if (!batch_id || service_fee_cents == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify batch belongs to this operator
  const { data: batch } = await supabase
    .from("tour_batches")
    .select("id, tour_operator_id")
    .eq("id", batch_id)
    .single();

  if (!batch || batch.tour_operator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("tour_batches")
    .update({
      service_fee_cents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
