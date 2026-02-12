import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getReportsTodayPerTrip, getMonthlySummary, getFuelSettings, getAnnualMonthlyStatsWithVessels } from "@/lib/admin/reports-stats";
import { getNowManilaString } from "@/lib/admin/ph-time";
import { formatTime } from "@/lib/dashboard/format";
import { ROUTES } from "@/lib/constants";
import { FuelSettingsForm } from "./FuelSettingsForm";

export const metadata = {
  title: "Reports",
  description: "Per-trip today & monthly summary — Nier Shipping Lines",
};

export default async function AdminReportsPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const currentYear = parseInt(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const [tripRows, monthly, fuelSettings, annualData] = await Promise.all([
    getReportsTodayPerTrip(),
    getMonthlySummary(),
    getFuelSettings(supabase),
    getAnnualMonthlyStatsWithVessels(supabase, currentYear),
  ]);

  const { monthly: annualMonthly, byMonthVessel } = annualData;
  const nowManila = getNowManilaString();
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
      <p className="mt-1 text-sm text-[#0f766e]">
        Per-trip for today (Philippines time). Available seats shown per departure time.
      </p>
      <p className="mt-1 text-sm font-medium text-[#0c7b93]">
        Current time (Philippines): {nowManila}
      </p>
      <p className="mt-2 text-sm text-[#0f766e]">
        The table below shows <strong>today’s trips</strong> (one row per departure); the Vessel column appears when there are trips. To view or manage all vessels:{" "}
        <Link href={ROUTES.adminVessels} className="font-semibold text-[#0c7b93] hover:underline">
          List of vessels →
        </Link>
      </p>

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
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#0f766e]">
                  <p>No trips scheduled for today (Philippines date). When there are trips, every departure is listed here—one row per trip. Data from Supabase.</p>
                  <p className="mt-2 font-medium text-[#134e4a]">Why no trips today?</p>
                  <p className="mt-1">Trips are created in the schedule. Add trips for today&apos;s date in{" "}
                    <Link href={ROUTES.adminSchedule} className="text-[#0c7b93] underline hover:no-underline">Admin → Schedule</Link>
                    {" "}or{" "}
                    <Link href={ROUTES.adminVessels} className="text-[#0c7b93] underline hover:no-underline">Vessels</Link>
                    {" "}to see them here.
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

      {/* Annual analytics — peak travel by month + line graph + vessel breakdown */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#134e4a]">Annual analytics — Peak travel by month</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">
          {currentYear} (Philippines). See which months have the most passengers (peak tourist travel) and which vessel in each month.
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

        {/* Year record per vessel */}
        {yearRecordPerVessel.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-[#134e4a]">Year record per vessel ({currentYear})</p>
            <p className="mt-0.5 text-xs text-[#0f766e]/80">Total passengers and revenue per vessel for the full year.</p>
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
          </div>
        )}

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
          <div className="mt-6">
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
                      ? `/admin/reports/trips?year=${currentYear}&month=${row.month}&boatId=${encodeURIComponent(row.boatId)}&vessel=${encodeURIComponent(row.vesselName)}`
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

      {/* Monthly summary cards (same style as Live today - passengers by vessel) */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#134e4a]">Monthly summary</h2>
        <p className="mt-0.5 text-sm text-[#0f766e]/80">Current month (Philippines). From Supabase.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Passengers catered (month)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{monthly.totalPassengers.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Revenue (month)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.totalRevenueCents / 100).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel (L, month)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">{monthly.totalFuelLiters} L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Fuel cost (month)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.totalFuelCostCents / 100).toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-[#0f766e]/80">{fuelPriceLabel} ₱/L × {monthly.totalFuelLiters} L</p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#0f766e]">Net revenue (month)</p>
            <p className="mt-2 text-2xl font-bold text-[#134e4a]">₱{(monthly.netRevenueCents / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

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
