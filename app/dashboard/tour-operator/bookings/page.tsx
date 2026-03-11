import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Bookings — Tour Operator" };

export default async function OperatorBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const { status } = await searchParams;
  const activeFilter = status ?? "all";

  const supabase = await createClient();

  let query = supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .order("created_at", { ascending: false });

  if (activeFilter === "pending")   query = query.eq("payment_status", "pending");
  if (activeFilter === "confirmed") query = query.eq("status", "confirmed").eq("payment_status", "verified");
  if (activeFilter === "completed") query = query.eq("status", "completed");
  if (activeFilter === "cancelled") query = query.eq("status", "cancelled");

  const { data: bookings } = await query;

  const filters = [
    { key: "all",       label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "pending",   label: "Pending Payment" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const statusColor: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-gray-100 text-gray-500",
    completed: "bg-blue-100 text-blue-700",
    no_show:   "bg-red-100 text-red-700",
  };

  const paymentColor: Record<string, string> = {
    pending:  "bg-amber-100 text-amber-700",
    verified: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/dashboard/tour-operator" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold">My Bookings</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">📋 My Bookings</h1>
        <Link href="/dashboard/tour-operator/walk-in"
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
          + Walk-in
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {filters.map((f) => (
          <Link key={f.key} href={`/dashboard/tour-operator/bookings?status=${f.key}`}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
              activeFilter === f.key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
            }`}>
            {f.label}
          </Link>
        ))}
      </div>

      {/* Bookings list */}
      {!bookings || bookings.length === 0 ? (
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 font-medium">No bookings found</p>
          <p className="text-sm text-gray-400 mt-1">
            {activeFilter === "all" ? "No bookings have been assigned to you yet." : `No ${activeFilter} bookings.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const schedDate = (b.schedule as { available_date?: string } | null)?.available_date;
            const tourTitle = (b.tour as { title?: string } | null)?.title ?? "—";
            return (
              <Link key={b.id} href={`/dashboard/tour-operator/bookings/${b.id}`}
                className="block rounded-2xl border-2 border-gray-100 bg-white p-5 hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-sm text-[#0c7b93]">{b.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {b.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentColor[b.payment_status] ?? "bg-gray-100 text-gray-500"}`}>
                        {b.payment_status === "verified" ? "✅ Paid" : "⏳ Unpaid"}
                      </span>
                      {b.is_walk_in && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                          Walk-in
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[#134e4a] text-sm truncate">{tourTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                      {schedDate
                        ? " · " + new Date(schedDate + "T00:00:00").toLocaleDateString("en-PH", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-700">
                      ₱{(b.total_amount_cents / 100).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(b.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link href="/dashboard/tour-operator" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}