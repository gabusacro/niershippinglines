import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { RefundsClient } from "./RefundsClient";

export const metadata = {
  title: "Refunds",
  description: "Manage refund requests — Travela Siargao Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminRefundsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();

  const { data: refunds } = await supabase
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

  // Get booking details
  const bookingIds = [...new Set((refunds ?? []).map((r) => r.booking_id).filter(Boolean))];
  const bookingMap = new Map<string, {
    reference: string;
    customer_full_name: string;
    customer_email: string;
    passenger_count: number;
    total_amount_cents: number;
    trip_snapshot_vessel_name: string | null;
    trip_snapshot_route_name: string | null;
    trip_snapshot_departure_date: string | null;
  }>();

  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, reference, customer_full_name, customer_email, passenger_count, total_amount_cents, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date")
      .in("id", bookingIds);
    for (const b of bookings ?? []) bookingMap.set(b.id, b);
  }

  // Get profile names for requested_by, approved_by, processed_by
  const profileIds = [...new Set([
    ...(refunds ?? []).map((r) => r.requested_by),
    ...(refunds ?? []).map((r) => r.approved_by),
    ...(refunds ?? []).map((r) => r.processed_by),
  ].filter(Boolean) as string[])];

  const profileMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p.full_name ?? "Unknown");
  }

  const items = (refunds ?? []).map((r) => {
    const booking = bookingMap.get(r.booking_id);
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
      status: r.status as "requested" | "under_review" | "approved" | "rejected" | "processed",
      refund_type: r.refund_type as "full" | "partial" | "voucher",
      policy_basis: r.policy_basis as string | null,
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
  });

  const pending = items.filter((i) => ["requested", "under_review"].includes(i.status)).length;
  const approved = items.filter((i) => i.status === "approved").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">💸 Refunds</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Review, approve, reject and process refund requests. Approved refunds need GCash reference after payment.
          </p>
        </div>
        <div className="flex gap-2">
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {pending} pending
            </span>
          )}
          {approved > 0 && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {approved} to process
            </span>
          )}
        </div>
      </div>

      <RefundsClient initialItems={items} currentUserId={user.id} />
    </div>
  );
}
