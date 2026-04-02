import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "parking_owner"].includes(user.role as string))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = await createClient();

  // Get the owner's lot
  const { data: lots } = await supabase
    .from("parking_lots")
    .select("id, name")
    .eq("owner_id", user.id);

  if (!lots || lots.length === 0)
    return NextResponse.json({ payouts: [], pending_cents: 0, paid_cents: 0 });

  const lotIds = lots.map(l => l.id);

  // Get all paid reservations for owner's lots
  const { data: reservations } = await supabase
    .from("parking_reservations")
    .select("id, reference, customer_full_name, park_date_start, total_days, owner_receivable_cents, parking_fee_cents, commission_cents, platform_fee_cents, processing_fee_cents, total_amount_cents, paid_at")
    .in("lot_id", lotIds)
    .in("status", ["confirmed", "checked_in", "overstay", "completed"])
    .not("payment_method", "eq", "cash");

  // Get all paid extensions for owner's lots
  const { data: extensions } = await supabase
    .from("parking_extensions")
    .select("id, reference, additional_days, owner_receivable_cents, parking_fee_cents, platform_fee_cents, processing_fee_cents, total_amount_cents, paid_at, reservation:parking_reservations(customer_full_name, new_end_date:park_date_end)")
    .eq("payment_status", "paid")
    .in("reservation_id",
      (await supabase.from("parking_reservations").select("id").in("lot_id", lotIds)).data?.map(r => r.id) ?? []
    );

  // Get payout records
  const { data: payouts } = await supabase
    .from("parking_payouts")
    .select("reservation_id, extension_id, payout_status, payment_reference, paid_at")
    .eq("owner_id", user.id);

  const paidResIds = new Set((payouts ?? []).filter(p => p.reservation_id && p.payout_status === "paid").map(p => p.reservation_id));
  const paidExtIds = new Set((payouts ?? []).filter(p => p.extension_id   && p.payout_status === "paid").map(p => p.extension_id));

  const items = [
    ...(reservations ?? []).map(r => ({
      id: r.id, type: "reservation" as const,
      reference: r.reference,
      customer_full_name: r.customer_full_name,
      date: r.park_date_start,
      days: r.total_days,
      parking_fee_cents: r.parking_fee_cents,
      platform_fee_cents: r.platform_fee_cents,
      processing_fee_cents: r.processing_fee_cents,
      total_amount_cents: r.total_amount_cents,
      commission_cents: r.commission_cents,
      owner_receivable_cents: r.owner_receivable_cents,
      payout_status: paidResIds.has(r.id) ? "paid" : "pending",
      payment_reference: payouts?.find(p => p.reservation_id === r.id)?.payment_reference ?? null,
      paid_at: payouts?.find(p => p.reservation_id === r.id)?.paid_at ?? null,
    })),
    ...(extensions ?? []).map(e => {
      const res = Array.isArray(e.reservation) ? e.reservation[0] : e.reservation;
      return {
        id: e.id, type: "extension" as const,
        reference: e.reference,
        customer_full_name: (res as { customer_full_name?: string })?.customer_full_name ?? "",
        date: (res as { new_end_date?: string })?.new_end_date ?? "",
        days: e.additional_days,
        parking_fee_cents: e.parking_fee_cents,
        platform_fee_cents: e.platform_fee_cents,
        processing_fee_cents: e.processing_fee_cents,
        total_amount_cents: e.total_amount_cents,
        owner_receivable_cents: e.owner_receivable_cents,
        payout_status: paidExtIds.has(e.id) ? "paid" : "pending",
        payment_reference: payouts?.find(p => p.extension_id === e.id)?.payment_reference ?? null,
        paid_at: payouts?.find(p => p.extension_id === e.id)?.paid_at ?? null,
      };
    }),
  ];

  const pending_cents = items.filter(i => i.payout_status === "pending").reduce((s, i) => s + (i.owner_receivable_cents ?? 0), 0);
  const paid_cents    = items.filter(i => i.payout_status === "paid").reduce((s, i) => s + (i.owner_receivable_cents ?? 0), 0);

  return NextResponse.json({ payouts: items, pending_cents, paid_cents });
}
