import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Investment Breakdown",
  description: "Monthly revenue and profit share detail",
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

export default async function InvestorBreakdownPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "investor") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);

  const { data: shareRow } = await supabase
    .from("investor_shares")
    .select("share_percent, notes")
    .eq("investor_id", user.id)
    .maybeSingle();
  const sharePercent = Number(shareRow?.share_percent ?? 0);

  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/investor" className="text-sm font-semibold text-amber-600 hover:underline">
        ← Investor Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[#134e4a]">Investment Breakdown</h1>
        <p className="mt-1 text-sm text-[#0f766e]">{MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
      </div>

      {/* Revenue waterfall */}
      <div className="mt-6 rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Platform Revenue</p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Trips</p>
              <p className="text-xl font-bold text-[#134e4a]">{allTripIds.length}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Passengers</p>
              <p className="text-xl font-bold text-[#134e4a]">{totalPassengers}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Avg pax/trip</p>
              <p className="text-xl font-bold text-[#134e4a]">{allTripIds.length > 0 ? (totalPassengers / allTripIds.length).toFixed(1) : "—"}</p>
            </div>
          </div>

          <div className="flex justify-between border-b border-teal-100 pb-2">
            <span className="text-[#134e4a]">Platform Service Fees ({totalPassengers} pax × ₱20)</span>
            <span className="font-semibold text-emerald-700">{peso(totalAdminFeeCents)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-teal-200 pb-2">
            <span className="text-[#134e4a]">Payment Processing Fees ({totalPassengers} pax × ₱15)</span>
            <span className="font-semibold text-blue-700">{peso(totalGcashFeeCents)}</span>
          </div>
          <div className="flex justify-between font-semibold pb-2 border-b border-teal-100">
            <span className="text-[#134e4a]">Gross Platform Revenue</span>
            <span className="text-[#134e4a]">{peso(grossPlatformRevenue)}</span>
          </div>

          <div className="pt-1">
            <p className="text-xs font-semibold uppercase text-rose-500 mb-1">Monthly Expenses</p>
            {monthlyExpenses.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-rose-600 pl-2 py-0.5">
                <span>− {item.name}{!item.is_recurring ? " (one-time)" : ""}</span>
                <span>{peso(-item.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-rose-600 border-t border-rose-100 pt-1 mt-1">
              <span>Total Expenses</span>
              <span>{peso(-monthlyExpenses.totalCents)}</span>
            </div>
          </div>

          <div className="flex justify-between border-t-2 border-teal-300 pt-3 mt-1">
            <span className="font-bold text-base text-[#134e4a]">Net Platform Revenue</span>
            <span className={`font-bold text-xl ${netPlatformRevenue < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {peso(netPlatformRevenue)}
            </span>
          </div>
          {netPlatformRevenue < 0 && (
            <p className="text-xs text-red-500">⚠ Expenses exceed fees this month. Share is ₱0.00 until revenue recovers.</p>
          )}
        </div>
      </div>

      {/* Your share */}
      <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">💼 Your Share — {sharePercent}%</p>
        {shareRow?.notes && <p className="mt-0.5 text-xs text-amber-600 italic">{shareRow.notes}</p>}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-700">Calculation</p>
            <p className="text-sm text-amber-800">{peso(positiveNet)} × {sharePercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-700">Your profit share</p>
            <p className={`text-3xl font-bold ${myShareCents <= 0 ? "text-gray-400" : "text-amber-900"}`}>
              {peso(myShareCents)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/investor" className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
