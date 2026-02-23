import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { getPendingPaymentBookings } from "@/lib/dashboard/get-pending-payment-bookings";
import { getRecentlyConfirmedBookings } from "@/lib/dashboard/get-recently-confirmed-bookings";
import { PrintTicketsTrigger } from "@/components/tickets/PrintTicketsTrigger";
import { getSiteBranding } from "@/lib/site-branding";
import { ROUTES, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";

export const metadata = {
  title: "Investor Dashboard",
  description: "Your monthly profit share — Travela Siargao",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

export default async function InvestorDashboard() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "investor") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);

  // Investor share
  const { data: shareRow } = await supabase
    .from("investor_shares")
    .select("share_percent, notes")
    .eq("investor_id", user.id)
    .maybeSingle();
  const sharePercent = Number(shareRow?.share_percent ?? 0);

  // Month range
  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Trips & revenue
  const { data: allTrips } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);
  const allTripIds = (allTrips ?? []).map((t) => t.id);

  let totalAdminFeeCents = 0, totalGcashFeeCents = 0, totalPassengers = 0;
  if (allTripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("admin_fee_cents, gcash_fee_cents, passenger_count")
      .in("trip_id", allTripIds)
      .in("status", PAYMENT_STATUSES);
    for (const b of bookings ?? []) {
      totalAdminFeeCents += b.admin_fee_cents ?? 0;
      totalGcashFeeCents += b.gcash_fee_cents ?? 0;
      totalPassengers += b.passenger_count ?? 0;
    }
  }

  const grossPlatformRevenue = totalAdminFeeCents + totalGcashFeeCents;
  const monthlyExpenses = await getMonthlyExpenses(supabase, currentYear, currentMonth);
  const netPlatformRevenue = grossPlatformRevenue - monthlyExpenses.totalCents;
  const positiveNet = Math.max(0, netPlatformRevenue);
  const myShareCents = Math.round(positiveNet * (sharePercent / 100));

  // Today's active vessels
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const { data: todayTrips } = await supabase
    .from("trips")
    .select("id, departure_time, status, boat:boats(name), route:routes(display_name)")
    .eq("departure_date", todayStr)
    .in("status", ["scheduled", "boarding", "departed"])
    .order("departure_time");

  // Personal bookings
  const [allPending, recentlyConfirmed, branding] = await Promise.all([
    getPendingPaymentBookings(user.id),
    getRecentlyConfirmedBookings(user.id),
    getSiteBranding(),
  ]);
  const awaitingPayment = allPending.filter((b) => !b.payment_proof_path);
  const awaitingConfirmation = allPending.filter((b) => !!b.payment_proof_path);

  const salutation = user.salutation?.trim();
  const displayName = user.fullName?.trim();
  const welcomeName = displayName ? (salutation ? `${salutation}. ${displayName}` : displayName) : (user.email ?? "Investor");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Investor Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{welcomeName}</h1>
        <p className="mt-1 text-sm text-white/80">
          {sharePercent}% share · {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>
        <div className="mt-2 text-2xl font-bold">
          {peso(myShareCents)}
          <span className="ml-2 text-sm font-normal text-white/70">your share this month</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/investor/breakdown"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-5 text-center transition-colors hover:bg-amber-100">
          <span className="text-2xl">📊</span>
          <span className="mt-1 text-sm font-bold text-amber-900">Investment Breakdown</span>
          <span className="mt-0.5 text-xs text-amber-700">Revenue, expenses & your share</span>
        </Link>
        <Link href={ROUTES.book}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93] px-4 py-5 text-center text-white transition-colors hover:bg-[#0f766e]">
          <span className="text-2xl">🚢</span>
          <span className="mt-1 text-sm font-bold">Book a Trip</span>
          <span className="mt-0.5 text-xs text-white/80">Siargao ↔ Surigao</span>
        </Link>
        <Link href={ROUTES.account}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-5 text-center transition-colors hover:bg-teal-50">
          <span className="text-2xl">👤</span>
          <span className="mt-1 text-sm font-bold text-[#134e4a]">Account</span>
          <span className="mt-0.5 text-xs text-[#0f766e]">Profile & password</span>
        </Link>
      </div>

      {/* ── PERSONAL BOOKINGS ── */}

      {/* Awaiting payment */}
      {awaitingPayment.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-amber-900">Awaiting payment — needs your attention</h2>
          <p className="mt-1 text-sm text-amber-800">
            You have {awaitingPayment.length} booking{awaitingPayment.length !== 1 ? "s" : ""} that need payment. Pay via GCash or at the ticket booth, then upload proof.
          </p>
          <ul className="mt-4 space-y-3">
            {awaitingPayment.map((b) => {
              const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
              return (
                <li key={b.id}>
                  <Link href={`/dashboard/bookings/${b.reference}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 transition-colors hover:border-amber-400 hover:bg-amber-50/50">
                    <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                    <span className="text-sm text-[#134e4a]">{routeName}</span>
                    <span className="font-semibold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {GCASH_NUMBER && (
            <p className="mt-3 text-sm text-amber-800">
              <strong>GCash:</strong> Send to {GCASH_NUMBER} ({GCASH_ACCOUNT_NAME}). Put the reference in the message.
            </p>
          )}
          <Link href={ROUTES.myBookings}
            className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
            View all my bookings →
          </Link>
        </div>
      )}

      {/* Awaiting confirmation */}
      {awaitingConfirmation.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-teal-400 bg-teal-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-teal-900">Awaiting Confirmation</h2>
          <p className="mt-1 text-sm text-teal-800">
            You have {awaitingConfirmation.length} booking{awaitingConfirmation.length !== 1 ? "s" : ""} with payment proof submitted. We&apos;ll verify soon.
          </p>
          <ul className="mt-4 space-y-3">
            {awaitingConfirmation.map((b) => {
              const routeName = b.trip?.route?.display_name ?? [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ?? "—";
              return (
                <li key={b.id}>
                  <Link href={`/dashboard/bookings/${b.reference}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 transition-colors hover:border-teal-400">
                    <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                    <span className="text-sm text-[#134e4a]">{routeName}</span>
                    <span className="font-semibold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href={ROUTES.myBookings}
            className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
            View all my bookings →
          </Link>
        </div>
      )}

      {/* Recently confirmed — tickets ready */}
      {recentlyConfirmed.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-emerald-900">Payment confirmed — tickets ready</h2>
          <p className="mt-1 text-sm text-emerald-800">Your payment was confirmed. You can print or view your tickets now.</p>
          <ul className="mt-4 space-y-2">
            {recentlyConfirmed.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-[#0c7b93]">{b.reference}</span>
                <PrintTicketsTrigger reference={b.reference} siteName={branding.site_name} />
              </li>
            ))}
          </ul>
          <Link href={ROUTES.myBookings}
            className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
            View all my bookings →
          </Link>
        </div>
      )}

      {/* My Bookings link (always visible) */}
      <div className="mt-4">
        <Link href={ROUTES.myBookings}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
          🎫 My Booking History
        </Link>
      </div>

      {/* Today's active vessels */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-[#134e4a]">Today&apos;s Active Vessels — {todayStr}</h2>
        {!todayTrips || todayTrips.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No active trips today yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {todayTrips.map((trip) => {
              const boat = (trip as { boat?: { name?: string } | null }).boat;
              const route = (trip as { route?: { display_name?: string } | null }).route;
              const statusColor = trip.status === "boarding" ? "bg-amber-100 text-amber-700" :
                trip.status === "departed" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700";
              return (
                <div key={trip.id} className="flex items-center justify-between rounded-xl border border-teal-100 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="font-medium text-[#134e4a]">🚢 {boat?.name ?? "—"}</p>
                    <p className="text-xs text-[#0f766e]">{route?.display_name ?? "—"} · {trip.departure_time?.slice(0, 5)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
                    {trip.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Trips This Month</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{allTripIds.length}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Passengers This Month</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{totalPassengers.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Your Share</p>
          <p className={`mt-1.5 text-2xl font-bold ${myShareCents <= 0 ? "text-gray-400" : "text-amber-800"}`}>{peso(myShareCents)}</p>
        </div>
      </div>

    </div>
  );
}
