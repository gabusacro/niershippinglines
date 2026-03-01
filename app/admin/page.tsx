import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTodayDashboardStats } from "@/lib/admin/dashboard-stats";
import { DashboardAutoRefresh } from "@/components/dashboard/DashboardAutoRefresh";
import { getPendingPaymentsPreview } from "@/lib/admin/pending-payments-preview";
import { getTodayLiveOperations } from "@/lib/admin/today-live-operations";
import { LiveOperationsTable } from "@/components/admin/LiveOperationsTable";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Admin dashboard",
  description: "Manage Travela Siargao – reports, vessels, manual booking",
};

function fmtPeso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

const PAID_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function AdminDashboardPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  async function getUnpaidVesselTrips() {
    try {
      const { data: paidTrips } = await supabase
        .from("trip_fare_payments").select("trip_id").eq("status", "paid");
      const paidTripIds = (paidTrips ?? []).map(p => p.trip_id);

      const { data: vesselAssignments } = await supabase
        .from("vessel_assignments")
        .select("boat_id, patronage_bonus_percent, profiles!vessel_owner_id(full_name), boat:boats(name)");
      const assignedBoatIds = (vesselAssignments ?? []).map(a => a.boat_id);
      if (assignedBoatIds.length === 0) return { count: 0, items: [] };

      let tripsQuery = supabase
        .from("trips")
        .select("id, boat_id, departure_date, boat:boats(name)")
        .in("boat_id", assignedBoatIds)
        .lt("departure_date", today)
        .order("departure_date", { ascending: false })
        .limit(200);

      if (paidTripIds.length > 0) {
        tripsQuery = tripsQuery.not("id", "in", `(${paidTripIds.map(id => `'${id}'`).join(",")})`);
      }

      const { data: pastTrips } = await tripsQuery;
      if (!pastTrips?.length) return { count: 0, items: [] };

      const pastTripIds = pastTrips.map(t => t.id);
      const { data: bookings } = await supabase
        .from("bookings").select("trip_id, passenger_count")
        .in("trip_id", pastTripIds).in("status", PAID_STATUSES);

      const passengersByTrip = new Map<string, number>();
      for (const b of bookings ?? []) {
        passengersByTrip.set(b.trip_id, (passengersByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
      }

      const tripsWithPassengers = pastTrips.filter(t => (passengersByTrip.get(t.id) ?? 0) > 0);
      return {
        count: tripsWithPassengers.length,
        items: tripsWithPassengers.slice(0, 6).map(t => ({
          id: t.id,
          boatId: t.boat_id,
          boatName: (t as { boat?: { name?: string } | null }).boat?.name ?? "—",
          departureDate: t.departure_date,
          passengers: passengersByTrip.get(t.id) ?? 0,
        })),
      };
    } catch {
      return { count: 0, items: [] };
    }
  }

  // Count pending ID verifications for badge
  async function getPendingIdCount() {
    try {
      const { count } = await supabase
        .from("passenger_id_verifications")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending");
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const [stats, pendingPreview, liveOps, unpaidTrips, pendingIdCount] = await Promise.all([
    getTodayDashboardStats(),
    getPendingPaymentsPreview(),
    getTodayLiveOperations(),
    getUnpaidVesselTrips(),
    getPendingIdCount(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <DashboardAutoRefresh intervalSeconds={90} />

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome, {user.fullName?.trim() || "Admin"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage reports, vessels, and crew. Add manual bookings when you collect payment in person.
        </p>
      </div>

      {/* Admin nav */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: ROUTES.adminReports,         label: "Reports (per vessel)"      },
          { href: ROUTES.adminVessels,          label: "Vessels & Fleet"           },
          { href: ROUTES.adminSchedule,         label: "Schedule (routes & times)" },
          { href: ROUTES.adminPendingPayments,  label: "Pending payments"          },
          { href: ROUTES.adminBookings,         label: "Booking history"           },
          { href: ROUTES.adminBranding,         label: "Site branding"             },
          { href: ROUTES.adminFees,             label: "Fees & charges"            },
          { href: "/admin/expenses",            label: "Expenses"                  },
          { href: "/admin/investor-shares",     label: "Investor Shares"           },
          { href: "/admin/investor-payouts",    label: "💼 Investor Payouts"       },
          { href: "/admin/vessel-owners",       label: "Vessel Owners"             },
          { href: ROUTES.adminFlagged,          label: "Flagged accounts"          },
          { href: ROUTES.account,               label: "My Profile"                },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] text-center transition-colors hover:border-[#0c7b93] hover:bg-teal-50">
            {label}
          </Link>
        ))}

        {/* ID Verifications — with pending badge */}
        <Link href="/admin/id-verifications"
          className="relative flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 text-center transition-colors hover:border-blue-400 hover:bg-blue-100">
          🪪 ID Verifications
          {pendingIdCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {pendingIdCount > 9 ? "9+" : pendingIdCount}
            </span>
          )}
        </Link>

        <Link href={ROUTES.adminManualBooking}
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]">
          Manual Booking
        </Link>
        <Link href="/admin/profit-distribution"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100">
          💰 Profit Distribution
        </Link>
        <Link href="/admin/discover"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-400 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100">
          🌊 Discover Content
        </Link>
        <Link href="/admin/announcements"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100">
          📢 Announcements
        </Link>
        <Link href="/admin/accounts"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-800 transition-colors hover:bg-purple-100">
          👥 Users
        </Link>
        <Link href="/admin/refunds"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100">
          💸 Refunds
        </Link>
      </div>

      {/* ── ALERT CARDS ── */}

      {/* Pending ID verifications alert */}
      {pendingIdCount > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-blue-900">🪪 Pending ID Verifications ({pendingIdCount})</h2>
              <p className="mt-0.5 text-sm text-blue-800">
                Discount IDs uploaded by passengers waiting for your review.
              </p>
            </div>
            <Link href="/admin/id-verifications"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Review IDs →
            </Link>
          </div>
        </div>
      )}

      {/* Pending passenger payments */}
      {pendingPreview.count > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-amber-900">⏳ Pending Passenger Payments ({pendingPreview.count})</h2>
              <p className="mt-0.5 text-sm text-amber-800">Confirm payments so passengers receive their tickets on time.</p>
            </div>
            <Link href={ROUTES.adminPendingPayments}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
              View all →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pendingPreview.items.map(b => (
              <li key={b.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
                <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                <span className="text-sm text-[#134e4a]">{b.customer_full_name} · ₱{(b.total_amount_cents / 100).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unpaid vessel trip payouts */}
      {unpaidTrips.count > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-orange-300 bg-orange-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-orange-900">💸 Unpaid Vessel Trip Payouts ({unpaidTrips.count})</h2>
              <p className="mt-0.5 text-sm text-orange-800">
                Past trips with confirmed passengers that haven&apos;t been paid out to vessel owners yet.
              </p>
            </div>
            <Link href={ROUTES.adminVessels}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
              Go to Vessels →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {unpaidTrips.items.map(t => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm">
                <span className="font-semibold text-orange-900">🚢 {t.boatName}</span>
                <span className="text-orange-700">{t.departureDate}</span>
                <span className="text-orange-600">{t.passengers} pax</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">⏳ Unpaid</span>
              </li>
            ))}
            {unpaidTrips.count > 6 && (
              <li className="pt-1 text-center text-xs text-orange-600">
                +{unpaidTrips.count - 6} more unpaid trips – open each vessel to mark as paid.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── TODAY'S SNAPSHOT ── */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#134e4a]">📊 Today&apos;s snapshot</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">
          Live totals for {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-white/80">Total revenue today</p>
            <p className="mt-1 text-3xl font-bold">{fmtPeso(stats.totalRevenue)}</p>
            <div className="mt-3 flex gap-4 text-xs text-white/70">
              <span>Siargao–Surigao: <strong className="text-white">{fmtPeso(stats.revenueSiargaoSurigao)}</strong></span>
              <span>Dinagat–Surigao: <strong className="text-white">{fmtPeso(stats.revenueSurigaoDinagat)}</strong></span>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-medium text-emerald-700">Boarded</p>
            <p className="mt-1 text-3xl font-bold text-emerald-800">{stats.totalPassengerBoard}</p>
            <p className="mt-1 text-xs text-emerald-600">+{stats.totalPassengerConfirmed} confirmed</p>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
            <p className="text-xs font-medium text-[#0f766e]">Vessels active</p>
            <p className="mt-1 text-3xl font-bold text-[#134e4a]">{stats.vesselsActive}</p>
            <p className="mt-1 text-xs text-[#0f766e]">{stats.totalTripsToday} trip{stats.totalTripsToday !== 1 ? "s" : ""} today</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href={ROUTES.adminPendingPayments}
            className={`rounded-2xl border p-4 transition-colors hover:shadow-md ${stats.pendingPayments > 0 ? "border-amber-300 bg-amber-50 hover:bg-amber-100" : "border-teal-100 bg-white"}`}>
            <p className="text-xs font-medium text-[#0f766e]">Pending Payments</p>
            <p className={`mt-1 text-2xl font-bold ${stats.pendingPayments > 0 ? "text-amber-700" : "text-gray-400"}`}>{stats.pendingPayments}</p>
            <p className="mt-1 text-xs text-[#0f766e]/60">{stats.pendingPayments > 0 ? "Needs verification →" : "All clear ✓"}</p>
          </Link>
          <div className={`rounded-2xl border p-4 ${stats.refundRequests > 0 ? "border-red-200 bg-red-50" : "border-teal-100 bg-white"}`}>
            <p className="text-xs font-medium text-[#0f766e]">Refund Requests</p>
            <p className={`mt-1 text-2xl font-bold ${stats.refundRequests > 0 ? "text-red-700" : "text-gray-400"}`}>{stats.refundRequests}</p>
            <p className="mt-1 text-xs text-[#0f766e]/60">{stats.refundRequests > 0 ? "Action needed" : "None pending ✓"}</p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-4">
            <p className="text-xs font-medium text-[#0f766e]">Online Bookings</p>
            <p className="mt-1 text-2xl font-bold text-[#134e4a]">{stats.onlineBookingsToday}</p>
            <p className="mt-1 text-xs text-[#0f766e]/60">GCash / Online</p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-4">
            <p className="text-xs font-medium text-[#0f766e]">Walk-in Bookings</p>
            <p className="mt-1 text-2xl font-bold text-[#134e4a]">{stats.walkinBookingsToday}</p>
            <p className="mt-1 text-xs text-[#0f766e]/60">Cash / Ticket Booth</p>
          </div>
        </div>
      </div>

      {/* ── LIVE OPERATIONS TABLE ── */}
      <div className="mt-10">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#134e4a]">🛳️ Live Operations — Today</h2>
            <p className="mt-0.5 text-sm text-[#0f766e]/80">
              All trips today with live passenger counts. Click a row for details · Click passengers to see who · Click vessel name to manage.
            </p>
          </div>
        </div>
        <LiveOperationsTable trips={liveOps} />
      </div>
    </div>
  );
}
