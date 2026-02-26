import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: refunds, error } = await supabase
    .from("refunds")
    .select(`
      id, booking_id, amount_cents, reason, status, refund_type,
      policy_basis, requested_by, requested_at, approved_by, approved_at,
      processed_at, processed_by, gcash_reference, rejection_reason,
      affected_ticket_numbers, admin_notes
    `)
    .order("requested_at", { ascending: false, nullsFirst: false })
    .order("processed_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookingIds = [...new Set((refunds ?? []).map((r) => r.booking_id).filter(Boolean))];
  const bookingMap = new Map<string, Record<string, unknown>>();
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, reference, customer_full_name, customer_email, passenger_count, total_amount_cents, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date")
      .in("id", bookingIds);
    for (const b of bookings ?? []) bookingMap.set(b.id, b);
  }

  const profileIds = [...new Set([
    ...(refunds ?? []).map((r) => r.requested_by),
    ...(refunds ?? []).map((r) => r.approved_by),
    ...(refunds ?? []).map((r) => r.processed_by),
  ].filter(Boolean) as string[])];

  const profileMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p.full_name ?? "Unknown");
  }

  return NextResponse.json(
    (refunds ?? []).map((r) => {
      const booking = bookingMap.get(r.booking_id) as Record<string, unknown> | undefined;
      return {
        id: r.id,
        booking_id: r.booking_id,
        booking_reference: booking?.reference ?? "—",
        customer_name: booking?.customer_full_name ?? "—",
        customer_email: booking?.customer_email ?? "—",
        passenger_count: booking?.passenger_count ?? 0,
        booking_total_cents: booking?.total_amount_cents ?? 0,
        vessel_name: booking?.trip_snapshot_vessel_name ?? null,
        route_name: booking?.trip_snapshot_route_name ?? null,
        departure_date: booking?.trip_snapshot_departure_date ?? null,
        amount_cents: r.amount_cents,
        reason: r.reason ?? "",
        status: r.status,
        refund_type: r.refund_type,
        policy_basis: r.policy_basis ?? null,
        requested_by_name: r.requested_by ? (profileMap.get(r.requested_by) ?? "Unknown") : "System",
        requested_at: r.requested_at ?? null,
        approved_by_name: r.approved_by ? (profileMap.get(r.approved_by) ?? "Unknown") : null,
        approved_at: r.approved_at ?? null,
        processed_at: r.processed_at ?? null,
        processed_by_name: r.processed_by ? (profileMap.get(r.processed_by) ?? "Unknown") : null,
        gcash_reference: r.gcash_reference ?? null,
        rejection_reason: r.rejection_reason ?? null,
        affected_ticket_numbers: r.affected_ticket_numbers ?? null,
        admin_notes: r.admin_notes ?? null,
      };
    })
  );
}
