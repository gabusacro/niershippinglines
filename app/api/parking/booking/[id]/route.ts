import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, payment_status, payment_proof_path, gcash_transaction_reference, park_date_start, park_date_end, total_days, vehicle_count, vehicles, parking_fee_cents, platform_fee_cents, processing_fee_cents, total_amount_cents, rate_cents_per_vehicle_per_day, lot_snapshot_name, lot_snapshot_address, lot_snapshot_distance, rate_snapshot_label, overstay_days, overstay_fee_cents, overstay_payment_status, admin_notes, checked_in_at, checked_out_at, created_at")
    .eq("id", id)
    .eq("customer_profile_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to load booking." }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Booking not found." },      { status: 404 });

  return NextResponse.json(data);
}

