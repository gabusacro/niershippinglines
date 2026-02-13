import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getReportsTodayPerTrip, getMonthlySummary, getWeeklySummary, getWeeklySummaryByVessel, getMonthlySummaryByVessel, getFuelSettings, getAnnualMonthlyStatsWithVessels } from "@/lib/admin/reports-stats";
import { getWeekStartEndInManila } from "@/lib/admin/ph-time";
import { formatTime } from "@/lib/dashboard/format";
import { ROUTES } from "@/lib/constants";
import { FuelSettingsForm } from "./FuelSettingsForm";

export const metadata = {
  title: "Reports",
  description: "Per-trip today & monthly summary — Nier Shipping Lines",
};

type Period = "daily" | "weekly" | "monthly" | "yearly";

const YEAR_MIN = 2020;
const YEAR_MAX_OFFSET = 1;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const period: Period =
    params?.period === "weekly" || params?.period === "monthly" || params?.period === "yearly"
      ? params.period
      : "daily";

  const supabase = await createClient();
  const currentYear = parseInt(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const yearMax = currentYear + YEAR_MAX_OFFSET;
  const yearParam = params?.year != null ? parseInt(params.year, 10) : NaN;
  const selectedYear =
    period === "yearly" && Number.isInteger(yearParam) && yearParam >= YEAR_MIN && yearParam <= yearMax
      ? yearParam
      : currentYear;

  const todayManila = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const weekRange = getWeekStartEndInManila();

  const annualDataPromise =
    period === "yearly"
      ? getAnnualMonthlyStatsWithVessels(supabase, selectedYear)
        : Promise.resolve({
          monthly: [
            { month: 1, monthName: "January", passengers: 0, revenueCents: 0 },
            { month: 2, monthName: "February", passengers: 0, revenueCents: 0 },
            { month: 3, monthName: "March", passengers: 0, revenueCents: 0 },
            { month: 4, monthName: "April", passengers: 0, revenueCents: 0 },
            { month: 5, monthName: "May", passengers: 0, revenueCents: 0 },
            { month: 6, monthName: "June", passengers: 0, revenueCents: 0 },
            { month: 7, monthName: "July", passengers: 0, revenueCents: 0 },
            { month: 8, monthName: "August", passengers: 0, revenueCents: 0 },
            { month: 9, monthName: "September", passengers: 0, revenueCents: 0 },
            { month: 10, monthName: "October", passengers: 0, revenueCents: 0 },
            { month: 11, monthName: "November", passengers: 0, revenueCents: 0 },
            { month: 12, monthName: "December", passengers: 0, revenueCents: 0 },
          ],
          byMonthVessel: [],
        });

  const [tripRows, monthly, weekly, weeklyByVessel, monthlyByVessel, fuelSettings, annualData] = await Promise.all([
    getReportsTodayPerTrip(),
    getMonthlySummary(),
    getWeeklySummary(),
    getWeeklySummaryByVessel(),
    getMonthlySummaryByVessel(),
    getFuelSettings(supabase),
    annualDataPromise,
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

  const chartPoints = annualMonthly.map((row, i) => {
    const x = (i + 0.5) * (innerW / 12);
    const y = maxPassengers > 0 ? innerH - (row.passengers / maxPassengers) * innerH : innerH;
    return { x, y };
  });
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

  const vesselTotals = new Map<string, { passengers: number; revenueCents: number }>();
  for (const row of byMonthVessel) {
    const cur = vesselTotals.get(row.vesselName) ?? { passengers: 0, revenueCents: 0 };
    cur.passengers += row.passengers;
    cur.revenueCents += row.revenueCents;
    vesselTotals.set(row.vesselName, cur);
  }
  const yearRecordPerVessel = [...vesselTotals.entries()]
    .map(([vesselName, v]) => ({ vesselName, passengers: v.passengers, revenueCents: v.revenueCents }))
    .sort((a, b) => a.vesselName.localeCompare(b.vesselName));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Reports</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        View daily departures, monthly and annual summaries, passengers and revenue per vessel, fuel and net revenue, and trip manifests for operations and planning.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={ROUTES.adminSchedule} className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]">
          Schedule
        </Link>
        <Link href={ROUTES.adminVessels} className="rounded-lg border-2 border-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5">
          Vessels
        </Link>
        <Link href={`${ROUTES.adminReports}?period=yearly`} className="rounded-lg border-2 border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Passengers per vessel & manifests
        </Link>
      </div>

      {/* Period: Daily | Weekly | Monthly | Yearly — clickable, data from Supabase */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`${ROUTES.adminReports}?period=daily`}
          className={period === "daily" ? "rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]" : "rounded-lg border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5"}
        >
          Daily
        </Link>
        <Link
          href={`${ROUTES.adminReports}?period=weekly`}
          className={period === "weekly" ? "rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]" : "rounded-lg border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5"}
        >
          Weekly
        </Link>
        <Link
          href={`${ROUTES.adminReports}?period=monthly`}
          className={period === "monthly" ? "rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]" : "rounded-lg border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5"}
        >
          Monthly
        </Link>
        <Link
          href={`${ROUTES.adminReports}?period=yearly${period === "yearly" ? `&year=${selectedYear}` : ""}`}
          className={period === "yearly" ? "rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]" : "rounded-lg border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5"}
        >
          Yearly
        </Link>
      </div>

      {/* Daily: Today's departures */}
      {period === "daily" && (
        <>
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#134e4a]">Today&apos;s departures</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">
          Per-trip view for today (Philippines date). One row per departure. Shows available seats, boarded passengers, revenue, fuel, net. Click a vessel to open the manifest.
        </p>
        <p className="mt-1 text-xs text-[#0f766e]/90">
          <strong>Schedule vs Trips:</strong> Schedule defines <em>when</em> boats can leave (e.g. 5:30 AM, 11:30 AM). <strong>Trips</strong> are the actual dated sailings—created in <strong>Vessels → Add trips</strong> for a date range. This table shows trips with departure_date = <strong>{todayManila}</strong>.
        </p>
      </div>

      {isAdmin && (
        <div className="mt-6 rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
          <FuelSettingsForm />
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-teal-100">
          <thead>
            <tr className="bg-[#0c7b93]/10">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Departure time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Available seats</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Passenger board</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel (L)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel cost</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Net revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-100">
            {tripRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-[#0f766e]">
                  <p>No trips found for <strong>{todayManila}</strong>.</p>
                  <p className="mt-2">
                    Trips are created in{" "}
                    <Link href={ROUTES.adminVessels} className="font-semibold text-[#0c7b93] hover:underline">Vessels</Link>
                    {" "}→ pick a vessel → <strong>Add trips</strong> → choose route and a date range that includes today. Schedule only defines times; Vessels creates the actual dated sailings.
                  </p>
                  <p className="mt-2 text-[#0f766e]/90">
                    Scroll down for monthly & annual analytics, passengers per vessel, and manifest links.
                  </p>
                </td>
              </tr>
            ) : (
              tripRows.map((r) => (
                <tr key={r.tripId} className="hover:bg-teal-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-[#134e4a]">
                    <Link href={`/admin/reports/trip/${r.tripId}`} className="text-[#0c7b93] hover:underline font-semibold">
                      {r.vesselName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#134e4a]">
                    <Link href={`/admin/reports/trip/${r.tripId}`} className="text-[#0c7b93] hover:underline">
                      {formatTime(r.departureTime)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#134e4a]">{r.routeName}</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.availableSeats}</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.passengerBoard}</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">₱{(r.revenueCents / 100).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">{r.fuelLiters} L</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">₱{(r.fuelCostCents / 100).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-[#134e4a]">₱{(r.netRevenueCents / 100).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Weekly: This week summary + per vessel */}
      {period === "weekly" && (
        <>
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#134e4a]">This week</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">Week of {weekRange.start} to {weekRange.end} (Philippines, Mon–Sun).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Passengers</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{weekly.totalPassengers.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Revenue</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(weekly.totalRevenueCents / 100).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel (L)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{weekly.totalFuelLiters} L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel cost</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(weekly.totalFuelCostCents / 100).toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-[#0f766e]/80">{fuelPriceLabel} ₱/L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Net revenue</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(weekly.netRevenueCents / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>
      {weeklyByVessel.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-[#134e4a]">Week record per vessel</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/80">Total passengers and revenue per vessel for this week.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers (week)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue (week)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {weeklyByVessel.map((v) => (
                  <tr key={v.vesselName} className="hover:bg-teal-50/50">
                    <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                    <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-[#134e4a]">₱{(v.revenueCents / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Monthly: This month summary + per vessel */}
      {period === "monthly" && (
        <>
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#134e4a]">This month</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">Current month totals (Philippines).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Passengers</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{monthly.totalPassengers.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Revenue</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.totalRevenueCents / 100).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel (L)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{monthly.totalFuelLiters} L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel cost</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.totalFuelCostCents / 100).toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-[#0f766e]/80">{fuelPriceLabel} ₱/L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Net revenue</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.netRevenueCents / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>
      {monthlyByVessel.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-[#134e4a]">Month record per vessel</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/80">Total passengers and revenue per vessel for this month.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers (month)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue (month)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {monthlyByVessel.map((v) => (
                  <tr key={v.vesselName} className="hover:bg-teal-50/50">
                    <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                    <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-[#134e4a]">₱{(v.revenueCents / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Yearly: Annual analytics — peak travel by month + line graph + vessel breakdown */}
      {period === "yearly" && (
      <div id="annual-analytics" className="mt-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-[#134e4a]">Annual analytics — Peak travel by month</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {selectedYear > YEAR_MIN && (
            <Link
              href={`${ROUTES.adminReports}?period=yearly&year=${selectedYear - 1}`}
              className="rounded-lg border-2 border-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
            >
              ← {selectedYear - 1}
            </Link>
          )}
          <span className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white">
            {selectedYear}
          </span>
          {selectedYear < yearMax && (
            <Link
              href={`${ROUTES.adminReports}?period=yearly&year=${selectedYear + 1}`}
              className="rounded-lg border-2 border-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
            >
              {selectedYear + 1} →
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-[#0f766e]/80">
          {selectedYear} (Philippines). See which months have the most passengers (peak tourist travel) and which vessel in each month. Future months show 0 until trips are recorded.
        </p>
        {peakMonth && peakMonth.passengers > 0 && (
          <p className="mt-2 rounded-lg bg-[#0c7b93]/10 px-3 py-2 text-sm font-medium text-[#134e4a]">
            Peak month: <strong>{peakMonth.monthName}</strong> ({peakMonth.passengers.toLocaleString()} passengers
            {peakMonth.revenueCents > 0 ? `, ₱${(peakMonth.revenueCents / 100).toLocaleString()} revenue` : ""})
          </p>
        )}

        {/* Curve chart: passengers per month (smooth curve for day-by-day style monitoring) */}
        <div className="mt-4 rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-[#134e4a]">Passengers per month (curve)</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/80">Smooth curve from monthly totals. Use the tables below for per-vessel and per-month detail.</p>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-full" style={{ height: chartHeight }}>
            <g transform={`translate(${pad.left},${pad.top})`}>
              {/* Y axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = innerH - pct * innerH;
                const val = Math.round(pct * maxPassengers);
                return (
                  <g key={pct}>
                    <line x1={0} y1={y} x2={innerW} y2={y} stroke="#e5e7eb" strokeDasharray="2" />
                    <text x={-4} y={y + 4} textAnchor="end" className="fill-[#134e4a] text-[10px]">{val}</text>
                  </g>
                );
              })}
              {/* X axis: month labels */}
              {annualMonthly.map((row, i) => {
                const x = (i + 0.5) * (innerW / 12);
                return (
                  <text key={row.month} x={x} y={innerH + 20} textAnchor="middle" className="fill-[#134e4a] text-[10px]">
                    {row.monthName.slice(0, 3)}
                  </text>
                );
              })}
              {/* Smooth curve: cubic bezier through points */}
              {chartPathD ? (
                <path
                  d={chartPathD}
                  fill="none"
                  stroke="#0c7b93"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {/* Dots at each point */}
              {chartPoints.map((pt, i) => (
                <circle key={annualMonthly[i].month} cx={pt.x} cy={pt.y} r={4} className="fill-[#0c7b93]" />
              ))}
            </g>
          </svg>
        </div>

        {/* Year record per vessel — always show for selected year (empty state for future/past with no data) */}
        <div className="mt-6">
          <p className="text-sm font-medium text-[#134e4a]">Year record per vessel ({selectedYear})</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/80">Total passengers and revenue per vessel for the full year.</p>
          {yearRecordPerVessel.length > 0 ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-teal-100 text-sm">
                <thead>
                  <tr className="bg-[#0c7b93]/10">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers (year)</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue (year)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-100">
                  {yearRecordPerVessel.map((v) => (
                    <tr key={v.vesselName} className="hover:bg-teal-50/50">
                      <td className="px-4 py-2 font-medium text-[#134e4a]">{v.vesselName}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{v.passengers.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">₱{(v.revenueCents / 100).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-[#0f766e]/80">No trips recorded for {selectedYear} yet.</p>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              {annualMonthly.map((row) => (
                <tr
                  key={row.month}
                  className={peakMonth && row.month === peakMonth.month && row.passengers > 0 ? "bg-[#0c7b93]/5 font-medium" : ""}
                >
                  <td className="px-4 py-2 text-[#134e4a]">{row.monthName}</td>
                  <td className="px-4 py-2 text-right text-[#134e4a]">{row.passengers.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-[#134e4a]">₱{(row.revenueCents / 100).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Which vessel in each month (e.g. February) */}
        {byMonthVessel.length > 0 && (
          <div id="by-month-vessel" className="mt-6 scroll-mt-24">
            <p className="text-sm font-medium text-[#134e4a]">By month & vessel</p>
            <p className="mt-0.5 text-xs text-[#0f766e]/80">Which vessel had trips and passengers in each month (e.g. February). Click a vessel or &quot;View manifests&quot; to see trips and open the passenger manifest.</p>
            <div className="mt-2 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-teal-100 text-sm">
                <thead>
                  <tr className="bg-[#0c7b93]/10">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Month</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Revenue</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-100">
                  {byMonthVessel.map((row, i) => {
                    const tripsUrl = row.boatId
                      ? `/admin/reports/trips?year=${selectedYear}&month=${row.month}&boatId=${encodeURIComponent(row.boatId)}&vessel=${encodeURIComponent(row.vesselName)}`
                      : null;
                    return (
                      <tr key={`${row.month}-${row.vesselName}-${i}`} className="hover:bg-teal-50/50">
                        <td className="px-4 py-2 text-[#134e4a]">{row.monthName}</td>
                        <td className="px-4 py-2 font-medium text-[#134e4a]">
                          {tripsUrl ? (
                            <Link href={tripsUrl} className="text-[#0c7b93] hover:underline">
                              {row.vesselName}
                            </Link>
                          ) : (
                            row.vesselName
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">{row.passengers.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-[#134e4a]">₱{(row.revenueCents / 100).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          {tripsUrl ? (
                            <Link href={tripsUrl} className="font-semibold text-[#0c7b93] hover:underline">
                              View manifests
                            </Link>
                          ) : (
                            <span className="text-[#0f766e]/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href={ROUTES.admin} className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10">
          ← Admin dashboard
        </Link>
        <Link href={ROUTES.adminVessels} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Vessels
        </Link>
        <Link href={ROUTES.adminSchedule} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Schedule
        </Link>
      </div>
    </div>
  );
}
