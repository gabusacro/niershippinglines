import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTodayDashboardStats } from "@/lib/admin/dashboard-stats";
import { DashboardAutoRefresh } from "@/components/dashboard/DashboardAutoRefresh";
import { getTodayPassengersByVessel } from "@/lib/admin/today-passengers-by-vessel";
import { getPendingPaymentsPreview } from "@/lib/admin/pending-payments-preview";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Admin dashboard",
  description: "Manage Nier Shipping Lines — reports, vessels, manual booking",
};

export default async function AdminDashboardPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  const [stats, vesselPassengers, pendingPreview] = await Promise.all([
    getTodayDashboardStats(),
    getTodayPassengersByVessel(),
    getPendingPaymentsPreview(),
  ]);

  const maxPassengers = Math.max(1, ...vesselPassengers.map((v) => v.passenger_count));

  const statCards = [
    { label: "Passengers boarded (today)", value: stats.totalPassengerBoard, unit: "", accent: "teal" },
    { label: "Vessels active", value: stats.vesselsActive, unit: "", accent: "blue" },
    { label: "Siargao–Surigao revenue", value: stats.revenueSiargaoSurigao, unit: "₱", cents: true, accent: "emerald" },
    { label: "Dinagat–Surigao revenue", value: stats.revenueSurigaoDinagat, unit: "₱", cents: true, accent: "emerald" },
    { label: "Fuel (L today)", value: stats.totalFuelLiters, unit: "", accent: "amber" },
    { label: "Total revenue (today)", value: stats.totalRevenue, unit: "₱", cents: true, accent: "teal" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <DashboardAutoRefresh intervalSeconds={90} />
      {/* Header with welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome, {user.fullName?.trim() || "Admin"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage reports, vessels, and crew. Add manual bookings when you collect payment in person.
        </p>
      </div>

      {/* Admin nav — reports, vessels, schedule, payments, bookings, branding, flagged, account */}
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Link
            href={ROUTES.adminReports}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Reports (per vessel)
          </Link>
          <Link
            href={ROUTES.adminVessels}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Vessels
          </Link>
          <Link
            href={ROUTES.adminSchedule}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Schedule (routes & times)
          </Link>
          <Link
            href={ROUTES.adminPendingPayments}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Pending payments
          </Link>
          <Link
            href={ROUTES.adminBookings}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Booking history
          </Link>
          <Link
            href={ROUTES.adminManualBooking}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]"
          >
            Manual Booking
          </Link>
          <Link
            href={ROUTES.adminBranding}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Site branding
          </Link>
       
          <Link
            href={ROUTES.adminFees}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Fees & charges
          </Link>
          <Link
            href="/admin/profit-distribution"
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            💰 Profit Distribution
          </Link>
          <Link
            href="/admin/expenses"
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Expenses
          </Link>
          <Link
            href="/admin/investor-shares"
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Investor Shares
          </Link>
          <Link
            href="/admin/vessel-owners"
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Vessel Owners
          </Link>

          <Link
            href={ROUTES.adminFlagged}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Flagged accounts
          </Link>
          <Link
            href={ROUTES.account}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] transition-colors hover:border-[#0c7b93] hover:bg-teal-50"
          >
            Account
          </Link>
        </div>
      </div>

      {/* Pending payments — confirm fast so passengers get tickets */}
      {pendingPreview.count > 0 && (
        <div className="mt-8 rounded-2xl border-2 border-amber-400 bg-amber-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-amber-900">Pending payments ({pendingPreview.count})</h2>
              <p className="mt-0.5 text-sm text-amber-800">Confirm payments so passengers receive tickets on time.</p>
            </div>
            <Link
              href={ROUTES.adminPendingPayments}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              View all →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pendingPreview.items.map((b) => (
              <li key={b.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
                <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                <span className="text-sm text-[#134e4a]">{b.customer_full_name} · ₱{(b.total_amount_cents / 100).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live analytics: passengers today per vessel (from Supabase) */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#134e4a]">Live today — Passengers by vessel</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">From Supabase: booked passengers (confirmed/boarded) on today&apos;s trips. Refresh to update.</p>
        {vesselPassengers.length === 0 ? (
          <p className="mt-4 rounded-xl border border-teal-100 bg-white p-5 text-sm text-[#0f766e]">No vessel activity today yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {vesselPassengers.map((v) => (
              <div key={v.vessel_id} className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#134e4a]">{v.vessel_name}</span>
                  <span className="text-lg font-bold text-[#0c7b93]">{v.passenger_count}</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-teal-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0c7b93] to-[#0f766e] transition-all"
                    style={{ width: `${Math.round((v.passenger_count / maxPassengers) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#0f766e]/80">{v.trip_count} trip{v.trip_count !== 1 ? "s" : ""} today</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's stats */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#134e4a]">Today&apos;s snapshot</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">Current day totals</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-medium text-[#0f766e]">{c.label}</p>
              <p className="mt-2 text-2xl font-bold text-[#134e4a]">
                {c.unit}
                {c.cents ? ((c.value as number) / 100).toLocaleString() : (c.value as number).toLocaleString()}
                {c.unit === "₱" ? "" : c.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
