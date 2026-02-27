"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAGE_SIZE = 10;

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string, short = false) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", short
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

type TripRow = {
  id: string;
  boat_id: string;
  boatName: string;
  routeName: string;
  departureDate: string;
  departureTime: string;
  passengers: number;
  grossFareCents: number;
  platformFeeCents: number;
  paymentProcessingCents: number;
  fuelCostCents: number;
  netRevCents: number;
  isToday: boolean;
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
};

type Vessel = {
  boatId: string;
  boatName: string;
  patronagePct: number;
  bonusCents: number;
};

type MonthTotals = {
  passengers: number;
  grossFareCents: number;
  platformFeeCents: number;
  paymentProcessingCents: number;
  fuelCostCents: number;
  netCents: number;
};

interface Props {
  ownerName: string;
  vessels: Vessel[];
  tripRows: TripRow[];
  todayTripIds: string[];
  selectedYear: number;
  selectedMonth: number;
  currentYear: number;
  currentMonth: number;
  todayManila: string;
  monthTotals: MonthTotals;
  totalPatronageBonusCents: number;
}

export function VesselOwnerClient({
  ownerName,
  vessels,
  tripRows,
  todayTripIds,
  selectedYear,
  selectedMonth,
  currentYear,
  currentMonth,
  monthTotals,
  totalPatronageBonusCents,
}: Props) {
  const router = useRouter();
  const [activeVessel, setActiveVessel] = useState<string | null>(vessels[0]?.boatId ?? null);
  const [page, setPage] = useState(1);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const filteredTrips = useMemo(() =>
    activeVessel ? tripRows.filter((t) => t.boat_id === activeVessel) : tripRows,
    [tripRows, activeVessel]
  );

  const todayTrips = filteredTrips.filter((t) => todayTripIds.includes(t.id));
  const allTrips = filteredTrips;
  const totalPages = Math.ceil(allTrips.length / PAGE_SIZE);
  const pagedTrips = allTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToMonth = (year: number, month: number) => {
    setPage(1);
    router.push(`/vessel-owner?year=${year}&month=${month}`);
  };

  const prevMonth = () => {
    if (selectedMonth === 1) goToMonth(selectedYear - 1, 12);
    else goToMonth(selectedYear, selectedMonth - 1);
  };

  const nextMonth = () => {
    const isCurrentOrFuture = selectedYear > currentYear ||
      (selectedYear === currentYear && selectedMonth >= currentMonth);
    if (isCurrentOrFuture) return;
    if (selectedMonth === 12) goToMonth(selectedYear + 1, 1);
    else goToMonth(selectedYear, selectedMonth + 1);
  };

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const canGoNext = !isCurrentMonth;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#134e4a] px-6 py-7 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Vessel Owner Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{ownerName}</h1>
        <p className="mt-1 text-sm text-white/75">{vessels.map((v) => v.boatName).join(" · ")}</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 transition-colors">← Prev</button>
          <span className="text-base font-bold">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
          <button onClick={nextMonth} disabled={!canGoNext} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
          {!isCurrentMonth && (
            <button onClick={() => goToMonth(currentYear, currentMonth)} className="ml-auto rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors">This month</button>
          )}
        </div>
      </div>

      {/* Vessel tabs */}
      {vessels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {vessels.map((v) => (
            <button key={v.boatId} onClick={() => { setActiveVessel(v.boatId); setPage(1); }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors border-2 ${activeVessel === v.boatId ? "border-[#0c7b93] bg-[#0c7b93] text-white" : "border-teal-200 bg-white text-[#134e4a] hover:bg-teal-50"}`}>
              🚢 {v.boatName}
            </button>
          ))}
          <button onClick={() => { setActiveVessel(null); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors border-2 ${activeVessel === null ? "border-[#0c7b93] bg-[#0c7b93] text-white" : "border-teal-200 bg-white text-[#134e4a] hover:bg-teal-50"}`}>
            All vessels
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Trips This Month", value: allTrips.length.toLocaleString() },
          { label: "Passengers", value: monthTotals.passengers.toLocaleString() },
          { label: "Gross Fare", value: peso(monthTotals.grossFareCents) },
          { label: "Net (Fare−Fuel)", value: peso(monthTotals.netCents), sub: `Fuel: ${peso(monthTotals.fuelCostCents)}`, negative: monthTotals.netCents < 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">{c.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${c.negative ? "text-red-600" : "text-[#134e4a]"}`}>{c.value}</p>
            {c.sub && <p className="mt-0.5 text-xs text-[#0f766e]/70">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Operator Loyalty Bonus */}
      <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-bold text-amber-900">🎁 Operator Loyalty Bonus — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Thank you for trusting Travela Siargao! This is our way of rewarding vessel operators who bring passengers through our platform. 🚢✨
            </p>
          </div>
          <span className="text-2xl font-bold text-amber-900">{peso(totalPatronageBonusCents)}</span>
        </div>
        <div className="mt-4 divide-y divide-amber-100">
          {vessels.filter((v) => !activeVessel || v.boatId === activeVessel).map((v) => (
            <div key={v.boatId} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-amber-800">🚢 {v.boatName}</span>
              <span className="font-bold text-amber-900">{peso(v.bonusCents)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-amber-600/80">Paid monthly by Travela Siargao as a thank-you for your continued partnership. 🙏</p>
      </div>

      {/* Today's trips */}
      {todayTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">Today&apos;s Trips</h2>
          <div className="mt-2 rounded-xl border border-teal-200 bg-white overflow-x-auto shadow-sm">
            <TripTable trips={todayTrips} expandedTripId={expandedTripId} setExpandedTripId={setExpandedTripId} highlight />
          </div>
        </div>
      )}

      {/* All trips this month */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">
            All Trips — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            <span className="ml-2 text-xs font-normal normal-case text-[#0f766e]/60">({allTrips.length} trips)</span>
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-teal-200 px-3 py-1 text-[#134e4a] hover:bg-teal-50 disabled:opacity-40">←</button>
              <span className="text-xs text-[#0f766e]">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-teal-200 px-3 py-1 text-[#134e4a] hover:bg-teal-50 disabled:opacity-40">→</button>
            </div>
          )}
        </div>

        {allTrips.length === 0 ? (
          <div className="mt-4 rounded-xl border border-teal-100 bg-white p-8 text-center text-sm text-[#0f766e]/60">No trips this month yet.</div>
        ) : (
          <div className="mt-2 rounded-xl border border-teal-200 bg-white overflow-x-auto shadow-sm">
            <TripTable trips={pagedTrips} expandedTripId={expandedTripId} setExpandedTripId={setExpandedTripId} />
            <div className="border-t-2 border-teal-200 bg-teal-50/60 px-4 py-3 grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-[#0f766e]">Total Passengers</p><p className="font-bold text-[#134e4a]">{monthTotals.passengers}</p></div>
              <div><p className="text-xs text-[#0f766e]">Gross Fare</p><p className="font-bold text-[#134e4a]">{peso(monthTotals.grossFareCents)}</p></div>
              <div><p className="text-xs text-[#0f766e]">Net (Fare−Fuel)</p><p className={`font-bold ${monthTotals.netCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(monthTotals.netCents)}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TripTable({ trips, expandedTripId, setExpandedTripId, highlight = false }: {
  trips: TripRow[];
  expandedTripId: string | null;
  setExpandedTripId: (id: string | null) => void;
  highlight?: boolean;
}) {
  return (
    <table className="min-w-full divide-y divide-teal-100 text-sm">
      <thead>
        <tr className="bg-teal-50/80">
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Date</th>
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Time</th>
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Route</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Pax</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Gross Fare</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Net Rev</th>
          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Paid</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-teal-50">
        {trips.map((t) => {
          const isExpanded = expandedTripId === t.id;
          return (
            <React.Fragment key={t.id}>
              <tr onClick={() => setExpandedTripId(isExpanded ? null : t.id)}
                className={`cursor-pointer transition-colors ${highlight || t.isToday ? "bg-teal-50/60" : "hover:bg-teal-50/30"}`}>
                <td className="px-3 py-2.5 text-[#134e4a]">
                  {formatDate(t.departureDate, true)}
                  {t.isToday && <span className="ml-1 rounded-full bg-[#0c7b93]/10 px-1.5 py-0.5 text-xs text-[#0c7b93]">today</span>}
                </td>
                <td className="px-3 py-2.5 text-[#134e4a]">{formatTime(t.departureTime)}</td>
                <td className="px-3 py-2.5 text-[#134e4a] max-w-[160px] truncate">{t.routeName}</td>
                <td className="px-3 py-2.5 text-right text-[#134e4a]">{t.passengers}</td>
                <td className="px-3 py-2.5 text-right font-medium text-[#134e4a]">
                  {t.grossFareCents > 0 ? peso(t.grossFareCents) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${t.netRevCents < 0 ? "text-red-600" : "text-[#134e4a]"}`}>
                  {peso(t.netRevCents)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <PaymentBadge status={t.paymentStatus} />
                </td>
              </tr>
              {isExpanded && (
                <tr className="bg-teal-50/40">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-[#134e4a]">
                      <div><p className="text-[#0f766e] font-medium">Payment Status</p><p className="mt-0.5 capitalize font-semibold">{t.paymentStatus}</p></div>
                      <div><p className="text-[#0f766e] font-medium">Method</p><p className="mt-0.5">{t.paymentMethod ?? "—"}</p></div>
                      <div><p className="text-[#0f766e] font-medium">Reference</p><p className="mt-0.5 font-mono">{t.paymentReference ?? "—"}</p></div>
                      <div><p className="text-[#0f766e] font-medium">Paid At</p><p className="mt-0.5">{t.paidAt ? new Date(t.paidAt).toLocaleString("en-PH") : "—"}</p></div>
                      <div><p className="text-[#0f766e] font-medium">Gross Fare</p><p className="mt-0.5">{peso(t.grossFareCents)}</p></div>
                      <div><p className="text-[#0f766e] font-medium">Net Payout</p><p className="mt-0.5 font-semibold">{peso(t.grossFareCents - t.platformFeeCents - t.paymentProcessingCents)}</p></div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function PaymentBadge({ status }: { status: "pending" | "paid" | "failed" }) {
  if (status === "paid") return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ Paid</span>;
  if (status === "failed") return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">✗ Failed</span>;
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">⏳ Pending</span>;
}
