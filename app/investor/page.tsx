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

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAYMENT_STATUSES = ["confirmed","checked_in","boarded","completed"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

async function getMonthRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
  month: number
) {
  const monthStr  = String(month).padStart(2, "0");
  const monthStart = `${year}-${monthStr}-01`;
  const lastDay   = new Date(year, month, 0).getDate();
  const monthEnd  = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // All online trips this month
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);

  const tripIds = (trips ?? []).map((t) => t.id);
  const activeBoatIds = [...new Set((trips ?? []).map((t) => t.boat_id).filter(Boolean))];

  let platformFeeCents = 0, processingFeeCents = 0, totalPassengers = 0, totalTrips = tripIds.length;

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, admin_fee_cents, gcash_fee_cents, passenger_count")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);
    for (const b of bookings ?? []) {
      platformFeeCents   += b.admin_fee_cents ?? 0;
      processingFeeCents += b.gcash_fee_cents ?? 0;
      totalPassengers    += b.passenger_count ?? 0;
    }
  }

  const grossCents = platformFeeCents + processingFeeCents;

  // Vessel owner bonus deductions
  const { data: assignments } = await supabase
    .from("vessel_assignments")
    .select("boat_id, patronage_bonus_percent");

  let vesselBonusCents = 0;
  if ((assignments ?? []).length > 0 && tripIds.length > 0) {
    // Per-vessel fee breakdown
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    const tripToBoat = new Map<string, string>();
    for (const t of trips ?? []) { if (t.boat_id) tripToBoat.set(t.id, t.boat_id); }

    const feesByBoat = new Map<string, number>();
    for (const b of bookings ?? []) {
      const boatId = tripToBoat.get(b.trip_id);
      if (boatId) {
        feesByBoat.set(boatId, (feesByBoat.get(boatId) ?? 0) + (b.admin_fee_cents ?? 0) + (b.gcash_fee_cents ?? 0));
      }
    }

    for (const a of assignments ?? []) {
      const fees = feesByBoat.get(a.boat_id) ?? 0;
      vesselBonusCents += Math.round(fees * (Number(a.patronage_bonus_percent) / 100));
    }
  }

  // Expense deduction
  const expenses = await getMonthlyExpenses(supabase, year, month);
  const expenseCents = expenses.totalCents;

  const netPoolCents = Math.max(0, grossCents - vesselBonusCents - expenseCents);

  return {
    totalTrips, totalPassengers, activeBoatIds: activeBoatIds.length,
    platformFeeCents, processingFeeCents, grossCents,
    vesselBonusCents, expenseCents, netPoolCents,
    expenses: expenses.items,
  };
}

export default async function InvestorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "investor") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear  = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);

  const selectedYear  = parseInt(params.year  ?? String(currentYear),  10);
  const selectedMonth = parseInt(params.month ?? String(currentMonth), 10);

  // Investor share
  const { data: shareRow } = await supabase
    .from("investor_shares")
    .select("share_percent, notes")
    .eq("investor_id", user.id)
    .maybeSingle();
  const sharePercent = Number(shareRow?.share_percent ?? 0);
  const shareNotes   = shareRow?.notes ?? "Silent Investor";

  // Current selected month revenue
  const rev = await getMonthRevenue(supabase, selectedYear, selectedMonth);
  const myShareCents = Math.round(rev.netPoolCents * (sharePercent / 100));

  // Payout record for this month
  const { data: payoutRow } = await supabase
    .from("investor_payouts")
    .select("*")
    .eq("investor_id", user.id)
    .eq("year", selectedYear)
    .eq("month", selectedMonth)
    .maybeSingle();

  // Payout history (all months)
  const { data: allPayouts } = await supabase
    .from("investor_payouts")
    .select("*")
    .eq("investor_id", user.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isFutureMonth  = selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth);

  // Navigation
  const prevY = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const prevM = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const nextY = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const nextM = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const canGoNext = nextY < currentYear || (nextY === currentYear && nextM <= currentMonth);

  // Running totals
  const totalEarnedCents = (allPayouts ?? []).reduce((s, p) => s + (p.share_cents ?? 0), 0);
  const totalPaidCents   = (allPayouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + (p.share_cents ?? 0), 0);
  const totalPendingCents = totalEarnedCents - totalPaidCents;

  const displayName = user.fullName?.trim() ?? user.email ?? "Investor";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Investor Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{displayName}</h1>
        <p className="mt-0.5 text-sm text-white/75">{sharePercent}% share · {shareNotes}</p>

        {/* Month nav */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Link href={`/investor?year=${prevY}&month=${prevM}`}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 transition-colors">
            ← Prev
          </Link>
          <span className="text-base font-bold">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            {isCurrentMonth && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">Current</span>}
          </span>
          {canGoNext ? (
            <Link href={`/investor?year=${nextY}&month=${nextM}`}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 transition-colors">
              Next →
            </Link>
          ) : (
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold opacity-30 cursor-not-allowed">Next →</span>
          )}
        </div>

        {/* This month's share */}
        {!isFutureMonth && (
          <div className="mt-4 flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-xs text-white/60">Your share — {MONTH_NAMES[selectedMonth - 1]}</p>
              <p className="text-3xl font-bold">{peso(myShareCents)}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2">
              {payoutRow?.status === "paid"
                ? <span className="text-sm font-semibold text-green-300">✓ Paid — {payoutRow.payment_reference ?? ""}</span>
                : <span className="text-sm font-semibold text-amber-200">⏳ {isCurrentMonth ? "Month in progress" : "Pending payout"}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Running totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Total Earned (All Time)</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-900">{peso(totalEarnedCents)}</p>
          <p className="mt-0.5 text-xs text-amber-600">{(allPayouts ?? []).length} months recorded</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Total Paid Out</p>
          <p className="mt-1.5 text-2xl font-bold text-green-800">{peso(totalPaidCents)}</p>
          <p className="mt-0.5 text-xs text-green-600">{(allPayouts ?? []).filter(p => p.status === "paid").length} months paid</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Pending Payout</p>
          <p className="mt-1.5 text-2xl font-bold text-orange-800">{peso(totalPendingCents)}</p>
          <p className="mt-0.5 text-xs text-orange-600">Awaiting monthly transfer</p>
        </div>
      </div>

      {/* Selected month waterfall */}
      {!isFutureMonth && (
        <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-4">
            📊 Revenue Breakdown — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Trips</p>
              <p className="text-lg font-bold text-[#134e4a]">{rev.totalTrips}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Passengers</p>
              <p className="text-lg font-bold text-[#134e4a]">{rev.totalPassengers}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Active Vessels</p>
              <p className="text-lg font-bold text-[#134e4a]">{rev.activeBoatIds}</p>
            </div>
          </div>

          {/* Waterfall */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-teal-100 pb-2">
              <span className="text-[#134e4a]">Platform Service Fees</span>
              <span className="font-semibold text-emerald-700">{peso(rev.platformFeeCents)}</span>
            </div>
            <div className="flex justify-between border-b-2 border-teal-200 pb-2">
              <span className="text-[#134e4a]">Payment Processing Fees</span>
              <span className="font-semibold text-blue-700">{peso(rev.processingFeeCents)}</span>
            </div>
            <div className="flex justify-between border-b-2 border-teal-300 pb-2 font-bold">
              <span className="text-[#134e4a]">Gross Platform Revenue</span>
              <span className="text-[#134e4a]">{peso(rev.grossCents)}</span>
            </div>

            {/* Vessel bonus deduction */}
            <div className="flex justify-between text-rose-600 text-xs pl-2">
              <span>− Vessel Owner Loyalty Bonuses{rev.vesselBonusCents === 0 ? " (none this month)" : ""}</span>
              <span>{peso(-rev.vesselBonusCents)}</span>
            </div>

            {/* Expense deductions */}
            {rev.expenses.map((e) => (
              <div key={e.id} className="flex justify-between text-rose-600 text-xs pl-2">
                <span>− {e.name}{e.is_recurring ? " (recurring)" : " (one-time)"}</span>
                <span>{peso(-e.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-b-2 border-rose-200 pb-2 font-semibold text-rose-600">
              <span>Total Deductions</span>
              <span>{peso(-(rev.vesselBonusCents + rev.expenseCents))}</span>
            </div>

            <div className="flex justify-between border-b border-teal-100 pb-2 font-bold text-base pt-1">
              <span className="text-[#134e4a]">Net Profit Pool</span>
              <span className="text-emerald-700">{peso(rev.netPoolCents)}</span>
            </div>

            {/* Investor's cut */}
            <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-amber-900">💼 Your Share — {sharePercent}%</p>
                  <p className="text-xs text-amber-600 mt-0.5">{shareNotes} · Calculation: {peso(rev.netPoolCents)} × {sharePercent}%</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-900">{peso(myShareCents)}</p>
                  {payoutRow?.status === "paid"
                    ? <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ Paid</span>
                    : <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">⏳ {isCurrentMonth ? "In Progress" : "Pending"}</span>}
                </div>
              </div>
              {payoutRow?.status === "paid" && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-amber-800 border-t border-amber-200 pt-3">
                  <div><p className="text-amber-600">Reference</p><p className="font-mono font-semibold">{payoutRow.payment_reference ?? "—"}</p></div>
                  <div><p className="text-amber-600">Paid At</p><p>{payoutRow.paid_at ? new Date(payoutRow.paid_at).toLocaleDateString("en-PH") : "—"}</p></div>
                  {payoutRow.payment_notes && <div className="col-span-2"><p className="text-amber-600">Notes</p><p>{payoutRow.payment_notes}</p></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payout History */}
      {(allPayouts ?? []).length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-4">📋 Payout History</p>
          <div className="overflow-x-auto rounded-lg border border-teal-100">
            <table className="min-w-full text-sm divide-y divide-teal-100">
              <thead>
                <tr className="bg-teal-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Net Pool</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Your Share</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-[#0f766e]">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Reference</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {(allPayouts ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/30">
                    <td className="px-4 py-2.5 font-medium text-[#134e4a]">
                      <Link href={`/investor?year=${p.year}&month=${p.month}`}
                        className="hover:text-amber-700 hover:underline">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#134e4a]">{peso(p.net_pool_cents ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-800">{peso(p.share_cents ?? 0)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status === "paid"
                        ? <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ Paid</span>
                        : <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">⏳ Pending</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#0c7b93]">{p.payment_reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-PH") : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 font-semibold">
                  <td className="px-4 py-2.5 text-[#134e4a]">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-amber-900">{peso(totalEarnedCents)}</td>
                  <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-500">{peso(totalPaidCents)} paid · {peso(totalPendingCents)} pending</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {(allPayouts ?? []).length === 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 text-center text-sm text-amber-700">
          No payout records yet. Your first payout will appear here at the end of the month.
        </div>
      )}

      {/* Nav links */}
      <div className="flex gap-3 flex-wrap">
        <Link href={ROUTES.dashboard} className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          🏠 Main Dashboard
        </Link>
        <Link href={ROUTES.myBookings} className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          🎫 My Bookings
        </Link>
        <Link href={ROUTES.account} className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          👤 Account
        </Link>
      </div>
    </div>
  );
}
