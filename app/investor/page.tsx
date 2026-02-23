import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";

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

  // Get this investor's share
  const { data: shareRow } = await supabase
    .from("investor_shares")
    .select("share_percent, notes")
    .eq("investor_id", user.id)
    .maybeSingle();

  const sharePercent = Number(shareRow?.share_percent ?? 0);

  // Month date range
  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Get all trips this month
  const { data: allTrips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, departure_time, status, boat:boats(id, name), route:routes(display_name)")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd)
    .order("departure_date", { ascending: false });

  const allTripIds = (allTrips ?? []).map((t) => t.id);

  // Active vessels today
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const { data: todayTrips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_time, status, boat:boats(id, name), route:routes(display_name)")
    .eq("departure_date", todayStr)
    .in("status", ["scheduled", "boarding", "departed"])
    .order("departure_time");

  // Platform revenue
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

  // ✅ FIXED: use NET revenue (gross MINUS expenses) for share calculation
  const netPlatformRevenue = grossPlatformRevenue - monthlyExpenses.totalCents;
  const positiveNet = Math.max(0, netPlatformRevenue);
  const myShareCents = Math.round(positiveNet * (sharePercent / 100));

  const salutation = user.salutation?.trim();
  const displayName = user.fullName?.trim();
  const welcomeName = displayName ? (salutation ? `${salutation}. ${displayName}` : displayName) : (user.email ?? "Investor");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header — orange */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Investor Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{welcomeName}</h1>
        <p className="mt-1 text-sm text-white/80">
          {sharePercent}% share · {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>
        <div className="mt-2 text-2xl font-bold">
          {myShareCents > 0 ? peso(myShareCents) : "₱0.00"}
          <span className="ml-2 text-sm font-normal text-white/70">your share this month</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link
          href="/investor/breakdown"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-5 text-center transition-colors hover:bg-amber-100"
        >
          <span className="text-2xl">📊</span>
          <span className="mt-1 text-sm font-bold text-amber-900">Investment Breakdown</span>
          <span className="mt-0.5 text-xs text-amber-700">Revenue, expenses & your share</span>
        </Link>
        <Link
          href={ROUTES.book}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-[#0c7b93] bg-[#0c7b93] px-4 py-5 text-center text-white transition-colors hover:bg-[#0f766e]"
        >
          <span className="text-2xl">🚢</span>
          <span className="mt-1 text-sm font-bold">Book a Trip</span>
          <span className="mt-0.5 text-xs text-white/80">Siargao ↔ Surigao</span>
        </Link>
        <Link
          href={ROUTES.account}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-4 py-5 text-center transition-colors hover:bg-teal-50"
        >
          <span className="text-2xl">👤</span>
          <span className="mt-1 text-sm font-bold text-[#134e4a]">Account</span>
          <span className="mt-0.5 text-xs text-[#0f766e]">Profile & password</span>
        </Link>
      </div>

      {/* Quick share summary */}
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-700">Your Share — {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
            <p className="mt-1 text-xs text-amber-600">
              Net Platform Revenue ({peso(positiveNet)}) × {sharePercent}%
            </p>
            {shareRow?.notes && <p className="mt-0.5 text-xs text-amber-500 italic">{shareRow.notes}</p>}
          </div>
          <p className={`text-3xl font-bold ${myShareCents <= 0 ? "text-gray-400" : "text-amber-800"}`}>
            {peso(myShareCents)}
          </p>
        </div>
        {netPlatformRevenue < 0 && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠ Expenses (−{peso(monthlyExpenses.totalCents)}) exceed fees collected ({peso(grossPlatformRevenue)}) this month — share is ₱0.00 until revenue recovers.
          </p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-white/70 p-2">
            <p className="text-amber-600">Gross Revenue</p>
            <p className="font-bold text-amber-800">{peso(grossPlatformRevenue)}</p>
          </div>
          <div className="rounded-lg bg-white/70 p-2">
            <p className="text-rose-500">Expenses</p>
            <p className="font-bold text-rose-600">−{peso(monthlyExpenses.totalCents)}</p>
          </div>
          <div className="rounded-lg bg-white/70 p-2">
            <p className="text-emerald-600">Net Revenue</p>
            <p className={`font-bold ${netPlatformRevenue < 0 ? "text-red-600" : "text-emerald-700"}`}>{peso(netPlatformRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Today's active vessels */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[#134e4a]">Today&apos;s Active Vessels — {todayStr}</h2>
        {!todayTrips || todayTrips.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No active trips today yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {todayTrips.map((trip) => {
              const boat = (trip as { boat?: { name?: string } | null }).boat;
              const route = (trip as { route?: { display_name?: string } | null }).route;
              const statusColor = trip.status === "boarding" ? "bg-amber-100 text-amber-700" :
                trip.status === "departed" ? "bg-blue-100 text-blue-700" :
                "bg-teal-100 text-teal-700";
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

      {/* This month's stats */}
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
