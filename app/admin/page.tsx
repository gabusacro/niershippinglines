import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getDashboardStats } from "@/lib/admin/dashboard-stats";
import AdminSnapshotClient from "@/components/admin/AdminSnapshotClient";
import { DashboardAutoRefresh } from "@/components/dashboard/DashboardAutoRefresh";
import { getPendingPaymentsPreview } from "@/lib/admin/pending-payments-preview";
import { getTodayLiveOperations } from "@/lib/admin/today-live-operations";
import { LiveOperationsTable } from "@/components/admin/LiveOperationsTable";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayInManila } from "@/lib/admin/ph-time";
import { ROUTES } from "@/lib/constants";
import {
  MapPin, Compass, Car, Mail, Waves, Megaphone,
  Users, ReceiptText, CreditCard, BookOpen, Wallet,
  Ship, DollarSign, BadgeCheck, Palmtree,
} from "lucide-react";

export const metadata = {
  title: "Admin dashboard",
  description: "Manage Travela Siargao – reports, vessels, manual booking",
};

const PAID_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function AdminDashboardPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const today = getTodayInManila();

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

  async function getFeeLabels() {
    try {
      const { data } = await supabase
        .from("fee_settings")
        .select("admin_fee_label, gcash_fee_label")
        .eq("id", 1)
        .maybeSingle();
      return {
        adminFeeLabel: data?.admin_fee_label ?? "Platform Service Fee",
        gcashFeeLabel: data?.gcash_fee_label ?? "Payment Processing Fee",
      };
    } catch {
      return {
        adminFeeLabel: "Platform Service Fee",
        gcashFeeLabel: "Payment Processing Fee",
      };
    }
  }

  // ── Pending reschedule fees — count unique bookings with unpaid fees ──────
  async function getPendingRescheduleFeeCount() {
    if (!adminClient) return 0;
    try {
      const { data: changes } = await adminClient
        .from("booking_changes")
        .select("booking_id")
        .eq("fee_paid", false)
        .not("additional_fee_cents", "is", null)
        .gt("additional_fee_cents", 0);

      // Count unique bookings
      const uniqueBookings = new Set((changes ?? []).map((c: { booking_id: string }) => c.booking_id));
      return uniqueBookings.size;
    } catch {
      return 0;
    }
  }

  const [stats, pendingPreview, liveOps, unpaidTrips, pendingIdCount, feeLabels, pendingRescheduleCount] = await Promise.all([
    getDashboardStats("today"),
    getPendingPaymentsPreview(),
    getTodayLiveOperations(),
    getUnpaidVesselTrips(),
    getPendingIdCount(),
    getFeeLabels(),
    getPendingRescheduleFeeCount(),
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
          { href: ROUTES.adminBranding,        label: "Site branding"        },
          { href: "/admin/promo-popup",         label: "📢 Promo Popup"       },
          { href: ROUTES.account,              label: "My Profile"           },
          { href: "/admin/expenses",           label: "Expenses"             },
          { href: ROUTES.adminFees,            label: "Fees & charges"       },
          { href: "/admin/investor-shares",    label: "Investor Shares"      },
          { href: ROUTES.adminReports,         label: "Reports (per vessel)" },
          { href: ROUTES.adminVessels,         label: "Vessels & Fleet"      },
          { href: ROUTES.adminBookings,        label: "Booking history"      },
          { href: "/admin/investor-payouts",   label: "💼 Investor Payouts"  },
          { href: "/admin/vessel-owners",      label: "Vessel Owners"        },
          { href: ROUTES.adminFlagged,         label: "Flagged accounts"     },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] text-center transition-colors hover:border-[#0c7b93] hover:bg-teal-50">
            {label}
          </Link>
        ))}

        {/* Pending Payments — with reschedule badge */}
        <Link href={ROUTES.adminPendingPayments}
          className="relative flex min-h-[48px] items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] text-center transition-colors hover:border-[#0c7b93] hover:bg-teal-50">
          Pending payments
          {pendingRescheduleCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
              {pendingRescheduleCount > 9 ? "9+" : pendingRescheduleCount}
            </span>
          )}
        </Link>

        {/* ID Verifications */}
        <Link href="/admin/id-verifications"
          className="relative flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 text-center transition-colors hover:border-blue-400 hover:bg-blue-100">
          <BadgeCheck className="w-4 h-4 shrink-0" />
          ID Verifications
          {pendingIdCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {pendingIdCount > 9 ? "9+" : pendingIdCount}
            </span>
          )}
        </Link>

        <Link href={ROUTES.adminManualBooking}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]">
          <BookOpen className="w-4 h-4 shrink-0" />
          Manual Booking
        </Link>

        <Link href="/admin/profit-distribution"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100">
          <DollarSign className="w-4 h-4 shrink-0" />
          Profit Distribution
        </Link>

        <Link href="/admin/discover"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-teal-400 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100">
          <Waves className="w-4 h-4 shrink-0" />
          Discover Content
        </Link>

        <Link href="/admin/announcements"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100">
          <Megaphone className="w-4 h-4 shrink-0" />
          Announcements
        </Link>

        <Link href="/admin/accounts"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-800 transition-colors hover:bg-purple-100">
          <Users className="w-4 h-4 shrink-0" />
          Users
        </Link>

        <Link href="/admin/refunds"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100">
          <ReceiptText className="w-4 h-4 shrink-0" />
          Refunds
        </Link>

        <Link href="/admin/tours"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100">
          <Compass className="w-4 h-4 shrink-0" />
          Tours
        </Link>

        <Link href="/admin/attractions"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition-colors hover:border-teal-500 hover:bg-teal-100">
          <MapPin className="w-4 h-4 shrink-0" />
          Attractions & Ads
        </Link>

        <Link href="/admin/parking"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100">
          <Car className="w-4 h-4 shrink-0" />
          Pay Parking
        </Link>

        <Link href="/admin/inquiries"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100">
          <Mail className="w-4 h-4 shrink-0" />
          Customer Inquiries
        </Link>
      </div>

      {/* ── ALERT CARDS ── */}

      {pendingIdCount > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-blue-900">🪪 Pending ID Verifications ({pendingIdCount})</h2>
              <p className="mt-0.5 text-sm text-blue-800">Discount IDs uploaded by passengers waiting for your review.</p>
            </div>
            <Link href="/admin/id-verifications"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Review IDs →
            </Link>
          </div>
        </div>
      )}

      {/* ── Reschedule Fee Alert ── */}
      {pendingRescheduleCount > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-orange-300 bg-orange-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-orange-900">🔁 Pending Reschedule Fees ({pendingRescheduleCount})</h2>
              <p className="mt-0.5 text-sm text-orange-800">
                Passengers who changed their schedule and have not yet paid the reschedule fee. Collect before boarding.
              </p>
            </div>
            <Link href={ROUTES.adminPendingPayments}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
              Review fees →
            </Link>
          </div>
        </div>
      )}

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

      {/* ── SNAPSHOT ── */}
      <AdminSnapshotClient
        initialStats={stats}
        todayLabel={today}
        adminFeeLabel={feeLabels.adminFeeLabel}
        gcashFeeLabel={feeLabels.gcashFeeLabel}
      />

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
