import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  getReportsTodayPerTrip,
  getMonthlySummary,
  getWeeklySummary,
  getWeeklySummaryByVessel,
  getMonthlySummaryByVessel,
  getFuelSettings,
  getAnnualMonthlyStatsWithVessels,
  getDailyReportForMonth,
} from "@/lib/admin/reports-stats";
import { getWeekStartEndInManila } from "@/lib/admin/ph-time";
import { formatTime } from "@/lib/dashboard/format";
import { ROUTES } from "@/lib/constants";
import { FuelSettingsForm } from "./FuelSettingsForm";

export const metadata = {
  title: "Reports",
  description: "Per-trip today & monthly summary – Travela Siargao",
};

type Period = "daily" | "weekly" | "monthly" | "yearly";

const YEAR_MIN = 2020;
const YEAR_MAX_OFFSET = 1;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#134e4a]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#0f766e]/70">{sub}</p>}
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string; month?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  // Only admin sees platform financial data (admin fee, gcash fee, platform revenue)
  const showFees = isAdmin;

  const params = await searchParams;
  const period: Period =
    params?.period === "weekly" || params?.period === "monthly" || params?.period === "yearly"
      ? params.period
      : "daily";

  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);
  const yearMax = currentYear + YEAR_MAX_OFFSET;
  const yearParam = params?.year != null ? parseInt(params.year, 10) : NaN;
  const selectedYear =
    period === "yearly" && Number.isInteger(yearParam) && yearParam >= YEAR_MIN && yearParam <= yearMax
      ? yearParam
      : currentYear;

  const monthParam = params?.month ?? `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const [calYear, calMonth] = monthParam.split("-").map(Number);

  const todayManila = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const weekRange = getWeekStartEndInManila();

  const annualDataPromise =
    period === "yearly"
      ? getAnnualMonthlyStatsWithVessels(supabase, selectedYear)
      : Promise.resolve({
          monthly: MONTH_NAMES.map((monthName, i) => ({ month: i + 1, monthName, passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 })),
          byMonthVessel: [],
        });

  const dailyCalendarPromise =
    period === "daily"
      ? getDailyReportForMonth(supabase, monthParam)
      : Promise.resolve([]);

  const [tripRows, monthly, weekly, weeklyByVessel, monthlyByVessel, fuelSettings, annualData, dailyCalendar] =
    await Promise.all([
      getReportsTodayPerTrip(),
      getMonthlySummary(),
      getWeeklySummary(),
      getWeeklySummaryByVessel(),
      getMonthlySummaryByVessel(),
      getFuelSettings(supabase),
      annualDataPromise,
      dailyCalendarPromise,
    ]);

  const { monthly: annualMonthly, byMonthVessel } = annualData;
  const fuelPriceLabel = fuelSettings.fuelPesosPerLiter;

  const peakMonth = annualMonthly.length
    ? annualMonthly.reduce((a, b) => (b.passengers > a.passengers ? b : a), annualMonthly[0])
    : null;
  const maxPassengers = Math.max(1, ...annualMonthly.map((r) => r.passengers));
  const chartHeight = 200;
  const chartWidth = 600;
  const pad = { top: 20, right: 20, bottom: 32, left: 40 };
  const innerW = chartWidth - pad.left - pad.right;
  const innerH = chartHeight - pad.top - pad.bottom;
  const chartPoints = annualMonthly.map((row, i) => ({
    x: (i + 0.5) * (innerW / 12),
    y: maxPassengers > 0 ? innerH - (row.passengers / maxPassengers) * innerH : innerH,
  }));
  const tension = 0.35;
  let chartPathD = "";
  if (chartPoints.length > 0) {
    chartPathD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i];
      const p1 = chartPoints[i + 1];
      const pPrev = chartPoints[i - 1] ?? p0;
      const pNext = chartPoints[i + 2] ?? p1;
      const cp1x = p0.x + (p1.x - pPrev.x) * tension;
      const cp1y = p0.y + (p1.y - pPrev.y) * tension;
      const cp2x = p1.x - (pNext.x - p0.x) * tension;
      const cp2y = p1.y - (pNext.y - p0.y) * tension;
      chartPathD += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
    }
  }

  const vesselTotals = new Map<string, { passengers: number; revenueCents: number; adminFeeCents: number; gcashFeeCents: number }>();
  for (const row of byMonthVessel) {
    const cur = vesselTotals.get(row.vesselName) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    cur.passengers += row.passengers;
    cur.revenueCents += row.revenueCents;
    cur.adminFeeCents += row.adminFeeCents ?? 0;
    cur.gcashFeeCents += row.gcashFeeCents ?? 0;
    vesselTotals.set(row.vesselName, cur);
  }
  const yearRecordPerVessel = [...vesselTotals.entries()]
    .map(([vesselName, v]) => ({ vesselName, ...v }))
    .sort((a, b) => a.vesselName.localeCompare(b.vesselName));

  const prevMonthDate = new Date(calYear, calMonth - 2, 1);
  const nextMonthDate = new Date(calYear, calMonth, 1);
  const prevMonthParam = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthParam = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const calMonthLabel = `${MONTH_NAMES[calMonth - 1]} ${calYear}`;

  const dailyTotals = dailyCalendar.reduce(
    (acc, d) => ({
      passengers: acc.passengers + d.totalPassengers,
      revenue: acc.revenue + d.totalRevenueCents,
      adminFee: acc.adminFee + d.totalAdminFeeCents,
      gcashFee: acc.gcashFee + d.totalGcashFeeCents,
      fuel: acc.fuel + d.totalFuelLiters,
      fuelCost: acc.fuelCost + d.totalFuelCostCents,
      net: acc.net + d.netRevenueCents,
    }),
    { passengers: 0, revenue: 0, adminFee: 0, gcashFee: 0, fuel: 0, fuelCost: 0, net: 0 }
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Reports</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        View daily departures, monthly and annual summaries, passengers and revenue per vessel, fuel and net revenue, and trip manifests.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={ROUTES.adminSchedule} className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]">Schedule</Link>
        <Link href={ROUTES.adminVessels} className="rounded-lg border-2 border-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5">Vessels</Link>
        <Link href={`${ROUTES.adminReports}/trips?year=${currentYear}&month=${currentMonth}`} className="rounded-lg border-2 border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Passengers per vessel &amp; manifests</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["daily", "weekly", "monthly", "yearly"] as Period[]).map((p) => (
          <Link key={p} href={`${ROUTES.adminReports}?period=${p}${p === "yearly" ? `&year=${selectedYear}` : ""}`}
            className={period === p ? "rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5"}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Link>
        ))}
      </div>

      {/* ── DAILY ── */}
      {period === "daily" && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#134e4a]">Daily — {calMonthLabel}</h2>
              <p className="mt-0.5 text-sm text-[#0f766e]/80">Click any date to see individual trips. Click a vessel name to open the manifest.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`${ROUTES.adminReports}?period=daily&month=${prevMonthParam}`} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">←</Link>
              <span className="text-sm font-medium text-[#134e4a]">{calMonthLabel}</span>
              <Link href={`${ROUTES.adminReports}?period=daily&month=${nextMonthParam}`} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">→</Link>
              {monthParam !== currentMonthParam && (
                <Link href={`${ROUTES.adminReports}?period=daily&month=${currentMonthParam}`} className="rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-100">Today</Link>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
              <FuelSettingsForm />
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Passengers" value={dailyTotals.passengers.toLocaleString()} />
            <SummaryCard label="Gross Fare" value={peso(dailyTotals.revenue)} />
            {showFees && <SummaryCard label="Admin Fees" value={peso(dailyTotals.adminFee)} />}
            {showFees && <SummaryCard label="GCash Fees" value={peso(dailyTotals.gcashFee)} />}
            {showFees && <SummaryCard label="Platform Rev" value={peso(dailyTotals.adminFee + dailyTotals.gcashFee)} sub="Admin + GCash" />}
            <SummaryCard label="Fuel Cost" value={peso(dailyTotals.fuelCost)} sub={`${fuelPriceLabel} ₱/L`} />
            <SummaryCard label="Net (Fare−Fuel)" value={peso(dailyTotals.net)} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[#134e4a]">Trips</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                  {showFees && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                  {showFees && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {dailyCalendar.map((day) => {
                  const isToday = day.date === todayManila;
                  const isFuture = day.date > todayManila;
                  return (
                    <tr key={day.date} className={`${isToday ? "bg-teal-50/70" : "hover:bg-gray-50/50"} ${isFuture ? "opacity-40" : ""}`}>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-semibold ${isToday ? "text-[#0c7b93]" : "text-[#134e4a]"}`}>{isToday ? "Today — " : ""}{day.label}</span>
                        <span className="ml-1.5 text-xs text-[#0f766e]/60">{day.dayOfWeek}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {day.tripCount > 0
                          ? <Link href={`${ROUTES.adminReports}/trips?year=${calYear}&month=${calMonth}&date=${day.date}`} className="inline-flex items-center rounded-full bg-[#0c7b93]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/20">{day.tripCount} trip{day.tripCount !== 1 ? "s" : ""}</Link>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{day.totalPassengers > 0 ? day.totalPassengers.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{day.totalRevenueCents > 0 ? peso(day.totalRevenueCents) : <span className="text-gray-300">—</span>}</td>
                      {showFees && <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700">{day.totalAdminFeeCents > 0 ? peso(day.totalAdminFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>}
                      {showFees && <td className="px-4 py-3 text-right text-sm font-medium text-blue-700">{day.totalGcashFeeCents > 0 ? peso(day.totalGcashFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>}
                      <td className="px-4 py-3 text-right text-sm text-red-600">{day.totalFuelCostCents > 0 ? peso(day.totalFuelCostCents) : <span className="text-gray-300">—</span>}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${day.netRevenueCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{day.totalRevenueCents > 0 ? peso(day.netRevenueCents) : <span className="text-gray-300 font-normal">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {day.tripCount > 0
                          ? <Link href={`${ROUTES.adminReports}/trips?year=${calYear}&month=${calMonth}&date=${day.date}`} className="text-xs font-semibold text-[#0c7b93] hover:underline">View →</Link>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {dailyTotals.passengers > 0 && (
                <tfoot>
                  <tr className="bg-[#134e4a]/5 font-semibold">
                    <td className="px-4 py-3 text-sm text-[#134e4a]">Month Total</td>
                    <td className="px-4 py-3 text-center text-sm text-[#134e4a]">{dailyCalendar.reduce((s, d) => s + d.tripCount, 0)} trips</td>
                    <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{dailyTotals.passengers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{peso(dailyTotals.revenue)}</td>
                    {showFees && <td className="px-4 py-3 text-right text-sm text-emerald-700">{peso(dailyTotals.adminFee)}</td>}
                    {showFees && <td className="px-4 py-3 text-right text-sm text-blue-700">{peso(dailyTotals.gcashFee)}</td>}
                    <td className="px-4 py-3 text-right text-sm text-red-600">{peso(dailyTotals.fuelCost)}</td>
                    <td className={`px-4 py-3 text-right text-sm ${dailyTotals.net < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(dailyTotals.net)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Today per-trip */}
          <div className="mt-10">
            <h3 className="text-base font-semibold text-[#134e4a]">Today&apos;s trips — per departure</h3>
            <p className="mt-0.5 text-sm text-[#0f766e]/80">{todayManila} · Click a vessel name to open the manifest.</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Seats</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Boarded</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                  {showFees && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                  {showFees && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel (L)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {tripRows.length === 0 ? (
                  <tr>
                    <td colSpan={showFees ? 11 : 9} className="px-4 py-6 text-center text-sm text-[#0f766e]">
                      <p>No trips found for <strong>{todayManila}</strong>.</p>
                      <p className="mt-2">Trips are created in <Link href={ROUTES.adminVessels} className="font-semibold text-[#0c7b93] hover:underline">Vessels</Link> → pick a vessel → <strong>Add trips</strong>.</p>
                    </td>
                  </tr>
                ) : (
                  tripRows.map((r) => (
                    <tr key={r.tripId} className="hover:bg-teal-50/50">
                      <td className="px-4 py-3 text-sm font-medium"><Link href={`/admin/reports/trip/${r.tripId}`} className="font-semibold text-[#0c7b93] hover:underline">{r.vesselName}</Link></td>
                      <td className="px-4 py-3 text-sm text-[#134e4a]"><Link href={`/admin/reports/trip/${r.tripId}`} className="text-[#0c7b93] hover:underline">{formatTime(r.departureTime)}</Link></td>
                      <td className="px-4 py-3 text-sm text-[#134e4a]">{r.routeName}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.availableSeats}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.passengerBoard}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{peso(r.revenueCents)}</td>
                      {showFees && <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700">{peso(r.adminFeeCents)}</td>}
                      {showFees && <td className="px-4 py-3 text-right text-sm font-medium text-blue-700">{peso(r.gcashFeeCents)}</td>}
                      <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.fuelLiters} L</td>
                      <td className="px-4 py-3 text-right text-sm text-red-600">{peso(r.fuelCostCents)}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${r.netRevenueCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(r.netRevenueCents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── WEEKLY ── */}
      {period === "weekly" && (
        <>
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#134e4a]">This week</h2>
            <p className="mt-0.5 text-sm text-[#0f766e]/80">{weekRange.start} to {weekRange.end} (Philippines, Mon–Sun)</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Passengers" value={weekly.totalPassengers.toLocaleString()} />
            <SummaryCard label="Gross Fare" value={peso(weekly.totalRevenueCents)} />
            {showFees && <SummaryCard label="Admin Fees" value={peso(weekly.totalAdminFeeCents)} />}
            {showFees && <SummaryCard label="GCash Fees" value={peso(weekly.totalGcashFeeCents)} />}
            {showFees && <SummaryCard label="Platform Rev" value={peso(weekly.totalAdminFeeCents + weekly.totalGcashFeeCents)} sub="Admin + GCash" />}
            <SummaryCard label="Fuel Cost" value={peso(weekly.totalFuelCostCents)} sub={`${fuelPriceLabel} ₱/L`} />
            <SummaryCard label="Net (Fare−Fuel)" value={peso(weekly.netRevenueCents)} />
          </div>
          {weeklyByVessel.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-[#134e4a]">Week breakdown per vessel</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-teal-100 text-sm">
                  <thead>
                    <tr className="bg-[#0c7b93]/10">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {weeklyByVessel.map((v) => (
                      <tr key={v.vesselName} className="hover:bg-teal-50/50">
                        <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{peso(v.revenueCents)}</td>
                        {showFees && <td className="px-4 py-2 text-right font-medium text-emerald-700">{peso(v.adminFeeCents)}</td>}
                        {showFees && <td className="px-4 py-2 text-right font-medium text-blue-700">{peso(v.gcashFeeCents)}</td>}
                        <td className="px-4 py-2 text-right text-red-600">{peso(v.fuelCostCents)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${v.netRevenueCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(v.netRevenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MONTHLY ── */}
      {period === "monthly" && (
        <>
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#134e4a]">This month</h2>
            <p className="mt-0.5 text-sm text-[#0f766e]/80">Current month totals (Philippines).</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Passengers" value={monthly.totalPassengers.toLocaleString()} />
            <SummaryCard label="Gross Fare" value={peso(monthly.totalRevenueCents)} />
            {showFees && <SummaryCard label="Admin Fees" value={peso(monthly.totalAdminFeeCents)} />}
            {showFees && <SummaryCard label="GCash Fees" value={peso(monthly.totalGcashFeeCents)} />}
            {showFees && <SummaryCard label="Platform Rev" value={peso(monthly.totalAdminFeeCents + monthly.totalGcashFeeCents)} sub="Admin + GCash" />}
            <SummaryCard label="Fuel Cost" value={peso(monthly.totalFuelCostCents)} sub={`${fuelPriceLabel} ₱/L`} />
            <SummaryCard label="Net (Fare−Fuel)" value={peso(monthly.netRevenueCents)} />
          </div>
          {showFees && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-800">💰 Platform Revenue (Your Earnings)</p>
              <p className="mt-1 text-xs text-emerald-700">Total Admin Fees + GCash Fees this month. Gross platform revenue before operational expenses.</p>
              <p className="mt-3 text-2xl font-bold text-emerald-800">{peso(monthly.totalAdminFeeCents + monthly.totalGcashFeeCents)}</p>
              <div className="mt-2 flex gap-4 text-xs text-emerald-700">
                <span>Admin fees: {peso(monthly.totalAdminFeeCents)}</span>
                <span>·</span>
                <span>GCash fees: {peso(monthly.totalGcashFeeCents)}</span>
              </div>
            </div>
          )}
          {monthlyByVessel.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-[#134e4a]">Month breakdown per vessel</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-teal-100 text-sm">
                  <thead>
                    <tr className="bg-[#0c7b93]/10">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {monthlyByVessel.map((v) => (
                      <tr key={v.vesselName} className="hover:bg-teal-50/50">
                        <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{peso(v.revenueCents)}</td>
                        {showFees && <td className="px-4 py-2 text-right font-medium text-emerald-700">{peso(v.adminFeeCents)}</td>}
                        {showFees && <td className="px-4 py-2 text-right font-medium text-blue-700">{peso(v.gcashFeeCents)}</td>}
                        <td className="px-4 py-2 text-right text-red-600">{peso(v.fuelCostCents)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${v.netRevenueCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(v.netRevenueCents)}</td>
                        <td className="px-4 py-2 text-center">
                          {v.boatId ? <Link href={`${ROUTES.adminReports}/trips?year=${currentYear}&month=${currentMonth}&boatId=${v.boatId}&vessel=${encodeURIComponent(v.vesselName)}`} className="text-xs font-semibold text-[#0c7b93] hover:underline">View →</Link> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── YEARLY ── */}
      {period === "yearly" && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-[#134e4a]">Annual analytics — {selectedYear}</h2>
            <div className="flex items-center gap-2">
              {selectedYear > YEAR_MIN && <Link href={`${ROUTES.adminReports}?period=yearly&year=${selectedYear - 1}`} className="rounded-lg border border-teal-200 px-3 py-1 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">← {selectedYear - 1}</Link>}
              {selectedYear < yearMax && <Link href={`${ROUTES.adminReports}?period=yearly&year=${selectedYear + 1}`} className="rounded-lg border border-teal-200 px-3 py-1 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">{selectedYear + 1} →</Link>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Total Passengers" value={annualMonthly.reduce((s, r) => s + r.passengers, 0).toLocaleString()} />
            <SummaryCard label="Gross Fare" value={peso(annualMonthly.reduce((s, r) => s + r.revenueCents, 0))} />
            {showFees && <SummaryCard label="Admin Fees" value={peso(annualMonthly.reduce((s, r) => s + r.adminFeeCents, 0))} />}
            {showFees && <SummaryCard label="GCash Fees" value={peso(annualMonthly.reduce((s, r) => s + r.gcashFeeCents, 0))} />}
            {showFees && <SummaryCard label="Platform Rev" value={peso(annualMonthly.reduce((s, r) => s + r.adminFeeCents + r.gcashFeeCents, 0))} sub="Admin + GCash" />}
            {peakMonth && peakMonth.passengers > 0 && <SummaryCard label="Peak Month" value={peakMonth.monthName} sub={`${peakMonth.passengers.toLocaleString()} passengers`} />}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Monthly passenger trend — {selectedYear}</p>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-2xl" style={{ minWidth: "360px" }}>
              <g transform={`translate(${pad.left},${pad.top})`}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => <line key={pct} x1={0} x2={innerW} y1={innerH * pct} y2={innerH * pct} stroke="#e2f2f1" strokeWidth={1} />)}
                {annualMonthly.map((row, i) => <text key={row.month} x={(i + 0.5) * (innerW / 12)} y={innerH + 20} textAnchor="middle" fontSize={9} fill="#5eada5">{row.monthName.slice(0, 3)}</text>)}
                <path d={chartPathD} fill="none" stroke="#0c7b93" strokeWidth={2} strokeLinecap="round" />
                {chartPoints.map((pt, i) => annualMonthly[i].passengers > 0 && <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill="#0c7b93" />)}
              </g>
            </svg>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Month</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                  {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                  {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                  {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Platform Rev</th>}
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Manifests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {annualMonthly.map((row) => {
                  const isPeak = peakMonth?.month === row.month && row.passengers > 0;
                  return (
                    <tr key={row.month} className={isPeak ? "bg-teal-50/60" : "hover:bg-gray-50/50"}>
                      <td className="px-4 py-2 font-medium text-[#134e4a]">{row.monthName} {isPeak && <span className="ml-1 rounded-full bg-[#0c7b93]/10 px-1.5 py-0.5 text-xs text-[#0c7b93]">peak</span>}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{row.passengers > 0 ? row.passengers.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{row.revenueCents > 0 ? peso(row.revenueCents) : <span className="text-gray-300">—</span>}</td>
                      {showFees && <td className="px-4 py-2 text-right font-medium text-emerald-700">{row.adminFeeCents > 0 ? peso(row.adminFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>}
                      {showFees && <td className="px-4 py-2 text-right font-medium text-blue-700">{row.gcashFeeCents > 0 ? peso(row.gcashFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>}
                      {showFees && <td className="px-4 py-2 text-right font-semibold text-[#134e4a]">{(row.adminFeeCents + row.gcashFeeCents) > 0 ? peso(row.adminFeeCents + row.gcashFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>}
                      <td className="px-4 py-2 text-center">{row.passengers > 0 ? <Link href={`${ROUTES.adminReports}/trips?year=${selectedYear}&month=${row.month}`} className="text-xs font-semibold text-[#0c7b93] hover:underline">View →</Link> : <span className="text-gray-300 text-xs">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {yearRecordPerVessel.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-[#134e4a]">Year record per vessel — {selectedYear}</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-teal-100 text-sm">
                  <thead>
                    <tr className="bg-[#0c7b93]/10">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>}
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>}
                      {showFees && <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Platform Rev</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {yearRecordPerVessel.map((v) => (
                      <tr key={v.vesselName} className="hover:bg-teal-50/50">
                        <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{peso(v.revenueCents)}</td>
                        {showFees && <td className="px-4 py-2 text-right font-medium text-emerald-700">{peso(v.adminFeeCents)}</td>}
                        {showFees && <td className="px-4 py-2 text-right font-medium text-blue-700">{peso(v.gcashFeeCents)}</td>}
                        {showFees && <td className="px-4 py-2 text-right font-semibold text-[#134e4a]">{peso(v.adminFeeCents + v.gcashFeeCents)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={ROUTES.admin} className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]">← Admin dashboard</Link>
            <Link href={ROUTES.adminVessels} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Vessels</Link>
            <Link href={ROUTES.adminSchedule} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Schedule</Link>
          </div>
        </div>
      )}
    </div>
  );
}
