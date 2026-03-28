import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// Allows parking_owner (and admin) to approve or reject extension payments
// for extensions belonging to their lot
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.role as string;
  if (!["admin", "parking_owner"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { extension_id: string; action: "approve" | "reject" };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { extension_id, action } = body;
  if (!extension_id || !["approve", "reject"].includes(action))
    return NextResponse.json({ error: "extension_id and action required." }, { status: 400 });

  const supabase = await createClient();

  // Get the extension and its reservation
  const { data: ext } = await supabase
    .from("parking_extensions")
    .select("id, reservation_id, new_end_date, additional_days, reservation:parking_reservations(lot_id)")
    .eq("id", extension_id)
    .maybeSingle();

  if (!ext) return NextResponse.json({ error: "Extension not found." }, { status: 404 });

  // Verify owner owns the lot this extension belongs to
  if (role === "parking_owner") {
    const res = Array.isArray(ext.reservation) ? ext.reservation[0] : ext.reservation;
    const lotId = (res as { lot_id?: string })?.lot_id;
    if (!lotId) return NextResponse.json({ error: "Could not verify lot ownership." }, { status: 403 });
    const { data: lot } = await supabase
      .from("parking_lots")
      .select("owner_id")
      .eq("id", lotId)
      .maybeSingle();
    if (lot?.owner_id !== user.id)
      return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    await supabase.from("parking_extensions").update({
      payment_status:       "paid",
      payment_verified_by:  user.id,
      payment_verified_at:  now,
      paid_at:              now,
    }).eq("id", extension_id);

    await supabase.from("parking_reservation_logs").insert({
      reservation_id: ext.reservation_id,
      event_type:     "extension_approved",
      performed_by:   user.id,
      notes:          `Extension approved by ${role}. +${ext.additional_days} days, new end: ${ext.new_end_date}.`,
    });
  } else {
    await supabase.from("parking_extensions").update({
      payment_status: "rejected",
    }).eq("id", extension_id);

    await supabase.from("parking_reservation_logs").insert({
      reservation_id: ext.reservation_id,
      event_type:     "extension_rejected",
      performed_by:   user.id,
      notes:          `Extension payment rejected by ${role}.`,
    });
  }

  return NextResponse.json({ ok: true });
}
