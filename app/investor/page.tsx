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
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    .select("id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);

  const allTripIds = (allTrips ?? []).map((t) => t.id);

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
  const netPlatformRevenue = grossPlatformRevenue - monthlyExpenses.totalCents;
  const myShareCents = Math.round(Math.max(0, netPlatformRevenue) * (sharePercent / 100));

  // Last 6 months for history (simplified — just show current month for now)
  const months = [];
  for (let i = 0; i < 6; i++) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m <= 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${y}` });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 px-6 py-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Investor Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{user.fullName ?? "Investor"}</h1>
        <p className="mt-1 text-sm text-white/80">
          {sharePercent}% share · {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>
      </div>

      {sharePercent === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          ⚠ Your share percentage has not been set yet. Please contact the admin.
        </div>
      )}

      {/* Platform Revenue Breakdown */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">💰 Platform Revenue — {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
        <p className="mt-1 text-xs text-amber-700">Monthly platform earnings after expenses — your share comes from this pool.</p>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-amber-700">Total Trips</span>
            <span className="font-semibold text-amber-800">{allTripIds.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-700">Total Passengers</span>
            <span className="font-semibold text-amber-800">{totalPassengers.toLocaleString()}</span>
          </div>
          <div className="border-t border-amber-200 pt-2">
            <div className="flex justify-between">
              <span className="text-amber-700">Gross Platform Revenue</span>
              <span className="font-semibold text-amber-800">{peso(grossPlatformRevenue)}</span>
            </div>
            <div className="ml-4 flex justify-between text-xs text-amber-600 mt-1">
              <span>Admin fees</span><span>{peso(totalAdminFeeCents)}</span>
            </div>
            <div className="ml-4 flex justify-between text-xs text-amber-600 mt-0.5">
              <span>GCash fees</span><span>{peso(totalGcashFeeCents)}</span>
            </div>
          </div>
          <div className="flex justify-between text-rose-600">
            <span>Monthly Expenses</span>
            <span className="font-semibold">−{peso(monthlyExpenses.totalCents)}</span>
          </div>
          {monthlyExpenses.items.map((item) => (
            <div key={item.id} className="ml-4 flex justify-between text-xs text-rose-500">
              <span>{item.name}</span><span>−{peso(item.amount_cents)}</span>
            </div>
          ))}
          <div className="border-t-2 border-amber-300 pt-2 flex justify-between">
            <span className="font-semibold text-amber-800">Net Platform Revenue</span>
            <span className={`font-bold text-lg ${netPlatformRevenue < 0 ? "text-red-600" : "text-amber-800"}`}>{peso(netPlatformRevenue)}</span>
          </div>
        </div>
      </div>

      {/* My share */}
      <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-100 p-5">
        <p className="text-sm font-semibold text-amber-900">💼 Your Share — {sharePercent}% of Net Platform Revenue</p>
        {shareRow?.notes && <p className="mt-1 text-xs text-amber-700">{shareRow.notes}</p>}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-700">Calculation</p>
            <p className="text-sm text-amber-800">{peso(Math.max(0, netPlatformRevenue))} × {sharePercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-700">Your profit share</p>
            <p className={`text-3xl font-bold ${myShareCents <= 0 ? "text-red-600" : "text-amber-900"}`}>{peso(myShareCents)}</p>
          </div>
        </div>
        {netPlatformRevenue < 0 && (
          <p className="mt-3 text-xs text-amber-700">⚠ Net platform revenue is negative this month (expenses exceed fees). Share is ₱0 until revenue recovers.</p>
        )}
      </div>

      {/* Summary cards */}
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
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Your Share This Month</p>
          <p className={`mt-1.5 text-2xl font-bold ${myShareCents <= 0 ? "text-red-600" : "text-amber-800"}`}>{peso(myShareCents)}</p>
        </div>
      </div>

      <div className="mt-8">
        <Link href={ROUTES.dashboard} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
