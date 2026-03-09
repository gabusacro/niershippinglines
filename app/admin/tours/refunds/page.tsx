import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Refunds — Tours Admin",
  description: "Manage tour refund requests",
};

interface Refund {
  id: string;
  booking_id: string | null;
  tour_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  amount_cents: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "processed";
  admin_note: string | null;
  reviewed_at: string | null;
  processed_at: string | null;
  gcash_number: string | null;
  gcash_name: string | null;
  gcash_reference: string | null;
  created_at: string;
  tour: { title: string } | null;
  booking: { reference: string } | null;
}

export default async function ToursRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const filterStatus = params.status ?? "pending";

  const supabase = await createClient();

  // Fetch refunds
  let query = supabase
    .from("tour_refunds")
    .select("*, tour:tour_packages(title), booking:tour_bookings(reference)")
    .order("created_at", { ascending: false });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: refunds } = await query;

  // Counts
  const { count: pendingCount } = await supabase
    .from("tour_refunds")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: approvedCount } = await supabase
    .from("tour_refunds")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const { count: processedCount } = await supabase
    .from("tour_refunds")
    .select("*", { count: "exact", head: true })
    .eq("status", "processed");

  const { count: rejectedCount } = await supabase
    .from("tour_refunds")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected");

  // Total pending amount
  const { data: pendingAmounts } = await supabase
    .from("tour_refunds")
    .select("amount_cents")
    .eq("status", "pending");

  const totalPendingCents = (pendingAmounts ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0), 0
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const statusTab = (label: string, value: string, count: number | null) => {
    const active = filterStatus === value;
    return (
      <Link
        href={"/admin/tours/refunds?status=" + value}
        className={
          "px-4 py-2 rounded-xl text-sm font-semibold transition-colors " +
          (active
            ? "bg-emerald-600 text-white shadow"
            : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700")
        }
      >
        {label}
        <span className={"ml-1.5 text-xs px-1.5 py-0.5 rounded-full " +
          (active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
          {count ?? 0}
        </span>
      </Link>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:   "bg-amber-100 text-amber-700",
      approved:  "bg-blue-100 text-blue-700",
      processed: "bg-emerald-100 text-emerald-700",
      rejected:  "bg-red-100 text-red-600",
    };
    return (
      <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (map[status] ?? "bg-gray-100 text-gray-500")}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Refunds Queue</h1>
        <p className="mt-2 text-sm text-white/90">
          Review and process customer refund requests.
        </p>
      </div>

      {/* Back link */}
      <div className="mt-4">
        <Link href="/admin/tours" className="text-sm text-emerald-600 hover:underline">
          Back to Tour Management
        </Link>
      </div>

      {/* Summary card */}
      {(pendingCount ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-amber-800">{pendingCount} pending refund{(pendingCount ?? 0) > 1 ? "s" : ""}</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Total amount to process: <span className="font-bold">P{(totalPendingCents / 100).toLocaleString()}</span>
            </p>
          </div>
          <span className="text-3xl">💸</span>
        </div>
      )}

      {/* Status tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {statusTab("Pending", "pending", pendingCount)}
        {statusTab("Approved", "approved", approvedCount)}
        {statusTab("Processed", "processed", processedCount)}
        {statusTab("Rejected", "rejected", rejectedCount)}
        {statusTab("All", "all", (pendingCount ?? 0) + (approvedCount ?? 0) + (processedCount ?? 0) + (rejectedCount ?? 0))}
      </div>

      {/* Refunds list */}
      <div className="mt-6 space-y-4">
        {!refunds || refunds.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-4xl mb-3">💸</p>
            <p className="font-semibold text-gray-500">No {filterStatus !== "all" ? filterStatus : ""} refund requests</p>
            <p className="text-sm text-gray-400 mt-1">
              Refund requests from customers will appear here.
            </p>
          </div>
        ) : (
          (refunds as Refund[]).map((refund) => (
            <div key={refund.id}
              className="rounded-2xl border-2 border-gray-100 bg-white p-6 hover:border-emerald-200 transition-all">

              {/* Top row */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-[#134e4a]">{refund.customer_name}</p>
                    {statusBadge(refund.status)}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                    {refund.customer_email && <span>{refund.customer_email}</span>}
                    {refund.customer_phone && <span>· {refund.customer_phone}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    P{(refund.amount_cents / 100).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(refund.created_at)}</p>
                </div>
              </div>

              {/* Tour + booking */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {refund.tour && (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-100">
                    {refund.tour.title}
                  </span>
                )}
                {refund.booking && (
                  <Link href={"/admin/tours/bookings/" + refund.booking_id}
                    className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono hover:bg-gray-200 transition-colors">
                    {refund.booking.reference}
                  </Link>
                )}
              </div>

              {/* Reason */}
              <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reason</p>
                <p className="text-sm text-gray-700">{refund.reason}</p>
              </div>

              {/* GCash details if available */}
              {(refund.gcash_number || refund.gcash_name) && (
                <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">GCash Refund Details</p>
                  <div className="flex flex-wrap gap-4 text-sm text-blue-800">
                    {refund.gcash_name && <span><span className="text-blue-500">Name:</span> {refund.gcash_name}</span>}
                    {refund.gcash_number && <span><span className="text-blue-500">Number:</span> {refund.gcash_number}</span>}
                    {refund.gcash_reference && <span><span className="text-blue-500">Ref:</span> {refund.gcash_reference}</span>}
                  </div>
                </div>
              )}

              {/* Admin note */}
              {refund.admin_note && (
                <p className="mt-2 text-xs text-gray-500 italic">
                  Admin note: {refund.admin_note}
                </p>
              )}

              {/* Timestamps */}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                {refund.reviewed_at && (
                  <span>Reviewed: {formatDate(refund.reviewed_at)}</span>
                )}
                {refund.processed_at && (
                  <span>Processed: {formatDate(refund.processed_at)}</span>
                )}
              </div>

              {/* Action buttons */}
              {refund.status === "pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action="/api/admin/tours/refunds/approve" method="POST">
                    <input type="hidden" name="refund_id" value={refund.id} />
                    <button type="submit"
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                      Approve
                    </button>
                  </form>
                  <form action="/api/admin/tours/refunds/reject" method="POST">
                    <input type="hidden" name="refund_id" value={refund.id} />
                    <button type="submit"
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors">
                      Reject
                    </button>
                  </form>
                </div>
              )}

              {/* Mark as processed button for approved refunds */}
              {refund.status === "approved" && (
                <div className="mt-4">
                  <form action="/api/admin/tours/refunds/process" method="POST">
                    <input type="hidden" name="refund_id" value={refund.id} />
                    <button type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                      Mark as Processed
                    </button>
                  </form>
                </div>
              )}

            </div>
          ))
        )}
      </div>

    </div>
  );
}