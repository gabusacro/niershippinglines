import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const batch_id = body.batch_id;
  const payment_ref = body.payment_ref ?? null;

  if (!batch_id) {
    return NextResponse.json({ error: "Missing batch_id" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify this batch belongs to this operator
  const { data: batch } = await supabase
    .from("tour_batches")
    .select("id, tour_operator_id")
    .eq("id", batch_id)
    .single();

  if (!batch || batch.tour_operator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized for this batch" }, { status: 403 });
  }

  const { error } = await supabase
    .from("tour_batches")
    .update({
      guide_payment_status: "paid",
      guide_payment_ref: payment_ref,
      guide_paid_at: new Date().toISOString(),
      guide_paid_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
