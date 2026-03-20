import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("parking_extensions")
    .select("id, reference, reservation_id, additional_days, new_end_date, total_amount_cents, parking_fee_cents, platform_fee_cents, payment_status, payment_proof_path, created_at, reservation:parking_reservations(reference, customer_full_name, lot_snapshot_name, vehicles)")
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { extension_id: string; action: "approve" | "reject" };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { extension_id, action } = body;
  const supabase = await createClient();

  const { data: ext } = await supabase
    .from("parking_extensions")
    .select("id, reservation_id, new_end_date, additional_days")
    .eq("id", extension_id)
    .maybeSingle();

  if (!ext) return NextResponse.json({ error: "Extension not found." }, { status: 404 });

  if (action === "approve") {
    await supabase.from("parking_extensions").update({
      payment_status:       "paid",
      payment_verified_by:  user.id,
      payment_verified_at:  new Date().toISOString(),
      paid_at:              new Date().toISOString(),
    }).eq("id", extension_id);

    await supabase.from("parking_reservation_logs").insert({
      reservation_id: ext.reservation_id,
      event_type:     "extension_approved",
      performed_by:   user.id,
      notes:          `Extension approved by admin. +${ext.additional_days} days, new end: ${ext.new_end_date}.`,
    });

  } else {
    // Reject — revert the end date on the reservation
    await supabase.from("parking_extensions").update({ payment_status: "pending" }).eq("id", extension_id);
    // Note: revert logic would need the previous end date — for now just flag it
    await supabase.from("parking_reservation_logs").insert({
      reservation_id: ext.reservation_id,
      event_type:     "extension_rejected",
      performed_by:   user.id,
      notes:          `Extension payment rejected by admin.`,
    });
  }

  return NextResponse.json({ ok: true });
}
