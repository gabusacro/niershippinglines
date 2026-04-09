import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "vessel_owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trip_id } = await req.json();
  if (!trip_id) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  const supabase = await createClient();

  // Verify this trip belongs to this vessel owner
  const { data: payment } = await supabase
    .from("trip_fare_payments")
    .select("id, status, vessel_owner_id")
    .eq("trip_id", trip_id)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
  if (payment.vessel_owner_id !== user.id) return NextResponse.json({ error: "Not your vessel" }, { status: 403 });
  if (payment.status !== "paid") return NextResponse.json({ error: "Not yet marked paid by admin" }, { status: 400 });

  const { error } = await supabase
    .from("trip_fare_payments")
    .update({
      owner_acknowledged: true,
      owner_acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}