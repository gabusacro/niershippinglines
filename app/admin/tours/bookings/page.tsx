import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tour Bookings — Admin" };

export default async function AdminTourBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "pending";
  const confirmed = typeof sp.confirmed === "string" ? sp.confirmed : null;

  const supabase = await createClient();

  const query = supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .order("created_at", { ascending: false });

  if (filter !== "all") query.eq("status", filter);

  const { data: bookings, error } = await query;

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  const statusColor: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-gray-100 text-gray-500",
    completed: "bg-blue-100 text-blue-700",
    no_show:   "bg-red-100 text-red-700",
  };

  const tabs = [
    { key: "pending",   label: "⏳ Pending" },
    { key: "confirmed", label: "✅ Confirmed" },
    { key: "completed", label: "🏁 Completed" },
    { key: "cancelled", label: "❌ Cancelled" },
    { key: "all",       label: "All" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <span className="font-semibold">Bookings</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">🎫 Tour Bookings</h1>
      </div>

      {/* Success toast */}
      {confirmed && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          ✅ Booking {confirmed} confirmed successfully.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load bookings: {error.message}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <Link key={tab.key} href={`/admin/tours/bookings?status=${tab.key}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              filter === tab.key
                ? "bg-emerald-600 text-white"
                : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Bookings list */}
      {(bookings ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🎫</div>
          <p className="font-semibold text-gray-600">No {filter} bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(bookings ?? []).map(b => (
            <div key={b.id}
              className="rounded-2xl border-2 border-gray-100 bg-white p-5 flex flex-wrap items-center gap-4 hover:border-emerald-200 transition-all">

              {/* Reference */}
              <div className="min-w-[160px]">
                <div className="font-mono font-bold text-emerald-700">{b.reference}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(b.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Tour + date */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#134e4a] truncate">
                  {(b.tour as { title?: string } | null)?.title ?? "—"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  📅 {(b.schedule as { available_date?: string } | null)?.available_date
                    ? formatDate((b.schedule as { available_date: string }).available_date)
                    : "—"}
                  {" · "}
                  {b.booking_type === "joiner" ? "👥" : "🔒"} {b.booking_type}
                  {" · "}
                  {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {b.customer_name} · {b.customer_email}
                </div>
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-emerald-700">
                  {b.total_amount_cents > 0
                    ? `₱${(b.total_amount_cents / 100).toLocaleString()}`
                    : "Negotiable"}
                </div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {b.status.toUpperCase()}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/admin/tours/bookings/${b.id}`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link href="/admin/tours" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Tours
        </Link>
      </div>
    </div>
  );
}