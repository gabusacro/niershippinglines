"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAGE_SIZE = 10;

function peso(cents: number) {
  const abs = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `-₱${abs}` : `₱${abs}`;
}
function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function formatDate(d: string, short = false) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH",
      short ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}
function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

type BookingLine = {
  id: string; tripId: string; reference: string; isOnline: boolean;
  paymentMethod: string | null; passengerCount: number;
  totalAmountCents: number; netFareCents: number;
  platformFeeCents: number; processingFeeCents: number;
  customerName: string; createdByName: string; createdByRole: string;
  createdAt: string; status: string;
};

type TripRow = {
  id: string; boat_id: string; boatName: string; routeName: string;
  departureDate: string; departureTime: string; isToday: boolean;
  onlinePax: number; walkInPax: number;
  onlineNetFareCents: number; walkInFareCents: number; totalGrossCents: number;
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod: string | null; paymentReference: string | null; paidAt: string | null;
  bookings: BookingLine[];
};

type OwedTrip = {
  tripId: string; boatName: string; routeName: string;
  departureDate: string; departureTime: string;
  onlinePax: number; netFareCents: number;
  paymentStatus: "pending" | "paid" | "failed";
  paidAt: string | null;
};

type Vessel = { boatId: string; boatName: string; patronagePct: number; bonusCents: number };
type MonthTotals = { onlinePax: number; walkInPax: number; onlineNetFareCents: number; walkInFareCents: number };
type NextMonthPreview = {
  month: number; year: number; monthName: string;
  onlinePax: number; walkInPax: number; tripCount: number; onlineNetFareCents: number;
} | null;

interface Props {
  ownerName: string; vessels: Vessel[]; tripRows: TripRow[];
  todayTripIds: string[];
  completedTripCount: number; todayTripCount: number;
  upcomingTripCount: number; totalTripCount: number;
  selectedYear: number; selectedMonth: number;
  currentYear: number; currentMonth: number; monthTotals: MonthTotals;
  totalPatronageBonusCents: number; nextMonthPreview: NextMonthPreview;
  owedTrips: OwedTrip[]; totalOwedCents: number; totalPaidCents: number;
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    passenger:    { label: "Passenger", cls: "bg-blue-100 text-blue-800" },
    admin:        { label: "Admin",     cls: "bg-purple-100 text-purple-800" },
    vessel_owner: { label: "Owner",     cls: "bg-teal-100 text-teal-800" },
    crew:         { label: "Crew",      cls: "bg-orange-100 text-orange-800" },
    ticket_booth: { label: "Booth",     cls: "bg-pink-100 text-pink-800" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function SourceBadge({ isOnline }: { isOnline: boolean }) {
  return isOnline
    ? <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">Online</span>
    : <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Walk-in</span>;
}

function PaymentBadge({ status }: { status: "pending" | "paid" | "failed" }) {
  if (status === "paid")   return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Paid</span>;
  if (status === "failed") return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Failed</span>;
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pending</span>;
}

export function VesselOwnerClient({
  ownerName, vessels, tripRows, todayTripIds,
  completedTripCount, todayTripCount, upcomingTripCount, totalTripCount,
  selectedYear, selectedMonth, currentYear, currentMonth,
  monthTotals, totalPatronageBonusCents, nextMonthPreview,
  owedTrips, totalOwedCents, totalPaidCents,
}: Props) {
  const router = useRouter();
  const [activeVessel, setActiveVessel] = useState<string | null>(vessels[0]?.boatId ?? null);
  const [page, setPage] = useState(1);
  const [auditTripId, setAuditTripId] = useState<string | null>(null);
  const [showOwedBreakdown, setShowOwedBreakdown] = useState(false);

  const filteredTrips = useMemo(() =>
    activeVessel ? tripRows.filter((t) => t.boat_id === activeVessel) : tripRows,
    [tripRows, activeVessel]
  );

  const todayTrips = filteredTrips.filter((t) => todayTripIds.includes(t.id));
  const allTrips   = filteredTrips;
  const totalPages = Math.ceil(allTrips.length / PAGE_SIZE);
  const pagedTrips = allTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToMonth = (year: number, month: number) => { setPage(1); router.push(`/vessel-owner?year=${year}&month=${month}`); };
  const prevMonth = () => selectedMonth === 1 ? goToMonth(selectedYear - 1, 12) : goToMonth(selectedYear, selectedMonth - 1);

  const maxAllowedYear  = currentMonth === 12 ? currentYear + 1 : currentYear;
  const maxAllowedMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const isAtMax = selectedYear > maxAllowedYear || (selectedYear === maxAllowedYear && selectedMonth >= maxAllowedMonth);
  const nextMonth = () => {
    if (isAtMax) return;
    selectedMonth === 12 ? goToMonth(selectedYear + 1, 1) : goToMonth(selectedYear, selectedMonth + 1);
  };
  const isViewingNextMonth = selectedYear === maxAllowedYear && selectedMonth === maxAllowedMonth;

  const totalRemittable = monthTotals.onlineNetFareCents;
  const totalWalkIn     = monthTotals.walkInFareCents;
  const totalCombined   = totalRemittable + totalWalkIn;

  // Progress bar percentage for trips
  const tripProgressPct = totalTripCount > 0 ? Math.round((completedTripCount / totalTripCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

      {/* ── Header — iOS Safari safe: solid bg, no gradient/opacity text ── */}
      <div className="rounded-2xl px-5 py-6 shadow-lg" style={{ backgroundColor: "#0c7b93" }}>
        <p style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Vessel Owner Dashboard
        </p>
        <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2, lineHeight: 1.2 }}>
          {ownerName}
        </h1>
        <p style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>
          {vessels.map((v) => v.boatName).join(" · ")}
        </p>

        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "14px 0" }} />

        {/* Month nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={prevMonth}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none" }}>
            ← Prev
          </button>
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 700 }}>
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          {isViewingNextMonth && (
            <span style={{ backgroundColor: "rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
              Next Month
            </span>
          )}
          <button onClick={nextMonth} disabled={isAtMax}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: isAtMax ? "rgba(255,255,255,0.35)" : "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none", cursor: isAtMax ? "not-allowed" : "pointer" }}>
            Next →
          </button>
          {(isViewingNextMonth || (selectedYear === currentYear && selectedMonth !== currentMonth)) && (
            <button onClick={() => goToMonth(currentYear, currentMonth)}
              style={{ marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none" }}>
              This month
            </button>
          )}
        </div>

        {/* Quick stats inside header */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Total Trips", value: String(totalTripCount) },
            { label: "Online Pax", value: String(monthTotals.onlinePax) },
            { label: "Walk-in Pax", value: String(monthTotals.walkInPax), yellow: true },
            { label: "Total Fare", value: peso(totalCombined) },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trip Progress Card ── */}
      {!isViewingNextMonth && (
        <div className="rounded-xl border-2 border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-[#134e4a]">
                Trip Progress — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <p className="text-xs text-[#0f766e] mt-0.5">
                {completedTripCount} completed · {todayTripCount} today · {upcomingTripCount} upcoming
              </p>
            </div>
            <span className="text-2xl font-black text-[#0c7b93]">
              {completedTripCount} <span className="text-base font-normal text-[#0f766e]">/ {totalTripCount} trips</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 rounded-full bg-teal-100 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${tripProgressPct}%`, backgroundColor: "#0c7b93" }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[#0f766e]">{tripProgressPct}% of this month&apos;s trips completed</p>

          {/* 3 stat pills */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
              <p className="text-xs text-[#0f766e] font-semibold">Completed</p>
              <p className="text-xl font-black text-[#0c7b93] mt-0.5">{completedTripCount}</p>
              <p className="text-xs text-[#0f766e]/60">past trips</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
              <p className="text-xs text-amber-700 font-semibold">Today</p>
              <p className="text-xl font-black text-amber-800 mt-0.5">{todayTripCount}</p>
              <p className="text-xs text-amber-600/60">happening now</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
              <p className="text-xs text-blue-700 font-semibold">Upcoming</p>
              <p className="text-xl font-black text-blue-800 mt-0.5">{upcomingTripCount}</p>
              <p className="text-xs text-blue-600/60">remaining</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Owes Me Card ── */}
      {!isViewingNextMonth && (
        <div className={`rounded-xl border-2 p-5 shadow-sm ${totalOwedCents > 0 ? "border-rose-300 bg-rose-50" : "border-green-300 bg-green-50"}`}>
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className={`text-sm font-bold ${totalOwedCents > 0 ? "text-rose-900" : "text-green-900"}`}>
                Admin Owes Me — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <p className={`text-xs mt-0.5 ${totalOwedCents > 0 ? "text-rose-700" : "text-green-700"}`}>
                Online fare collected by admin that hasn&apos;t been remitted yet
              </p>
            </div>
            <div className="text-right">
              {totalOwedCents > 0 ? (
                <p className="text-2xl font-black text-rose-700">{peso(totalOwedCents)}</p>
              ) : (
                <p className="text-lg font-bold text-green-700">All paid!</p>
              )}
              {totalPaidCents > 0 && (
                <p className="text-xs text-green-700 font-semibold mt-0.5">{peso(totalPaidCents)} already remitted</p>
              )}
            </div>
          </div>

          {/* Summary row */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white border border-rose-200 p-3 text-center">
              <p className="text-xs text-rose-700 font-semibold">Pending Remittance</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">{peso(totalOwedCents)}</p>
              <p className="text-xs text-rose-500 mt-0.5">
                {owedTrips.filter(t => t.paymentStatus === "pending").length} trips
              </p>
            </div>
            <div className="rounded-xl bg-white border border-green-200 p-3 text-center">
              <p className="text-xs text-green-700 font-semibold">Already Remitted</p>
              <p className="text-xl font-black text-green-700 mt-0.5">{peso(totalPaidCents)}</p>
              <p className="text-xs text-green-500 mt-0.5">
                {owedTrips.filter(t => t.paymentStatus === "paid").length} trips
              </p>
            </div>
            <div className="rounded-xl bg-white border border-teal-200 p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-[#0f766e] font-semibold">Total Online Fare</p>
              <p className="text-xl font-black text-[#0c7b93] mt-0.5">{peso(totalOwedCents + totalPaidCents)}</p>
              <p className="text-xs text-[#0f766e]/60 mt-0.5">{owedTrips.length} trips with online bookings</p>
            </div>
          </div>

          {/* Expandable per-trip breakdown */}
          {owedTrips.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowOwedBreakdown(!showOwedBreakdown)}
                className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  totalOwedCents > 0
                    ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                    : "bg-green-100 text-green-800 hover:bg-green-200"
                }`}
              >
                <span>Per-trip breakdown ({owedTrips.length} trips)</span>
                <span>{showOwedBreakdown ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {showOwedBreakdown && (
                <div className="mt-2 rounded-xl border border-rose-100 bg-white overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Date</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Route</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#0c7b93]">Online Pax</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#0c7b93]">Fare Owed</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Paid At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {owedTrips.map((t) => (
                        <tr key={t.tripId} className={t.paymentStatus === "paid" ? "bg-green-50/40" : "bg-white"}>
                          <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">
                            {formatDate(t.departureDate, true)}
                            <span className="ml-1 text-xs text-gray-400">{formatTime(t.departureTime)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[#134e4a] max-w-[140px] truncate text-xs">{t.routeName}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[#0c7b93]">{t.onlinePax}</td>
                          <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                            <span className={t.paymentStatus === "paid" ? "text-green-700" : "text-rose-700"}>
                              {peso(t.netFareCents)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <PaymentBadge status={t.paymentStatus} />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                            {t.paidAt ? formatDateTime(t.paidAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td colSpan={3} className="px-3 py-2.5 text-gray-600 text-sm">Total</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-rose-700 text-sm">{peso(totalOwedCents)} pending</span>
                          {totalPaidCents > 0 && <span className="ml-2 text-green-700 text-xs">+ {peso(totalPaidCents)} paid</span>}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {owedTrips.length === 0 && (
            <p className="mt-4 text-sm text-[#0f766e]">No trips with online bookings this month yet.</p>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Only online bookings are included — walk-in cash is collected directly by the vessel and does not go through admin.
          </p>
        </div>
      )}

      {/* ── Next Month Early Booking Alert ── */}
      {nextMonthPreview && !isViewingNextMonth && (
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-blue-900">Early Bookings — {nextMonthPreview.monthName} {nextMonthPreview.year}</p>
              <p className="mt-1 text-xs text-blue-700">Passengers have already booked for next month.</p>
            </div>
            <button onClick={() => goToMonth(nextMonthPreview.year, nextMonthPreview.month)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
              View {nextMonthPreview.monthName} →
            </button>
          </div>
          {nextMonthPreview.tripCount === 0 ? (
            <p className="mt-3 text-sm text-blue-600">No trips scheduled yet for {nextMonthPreview.monthName}.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Trips", value: nextMonthPreview.tripCount, cls: "text-blue-900" },
                { label: "Online Pax", value: nextMonthPreview.onlinePax, cls: "text-teal-800" },
                { label: "Walk-in Pax", value: nextMonthPreview.walkInPax, cls: "text-amber-800" },
                { label: "Est. Online Fare", value: peso(nextMonthPreview.onlineNetFareCents), cls: "text-blue-900" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">{s.label}</p>
                  <p className={`mt-0.5 text-lg font-bold ${s.cls}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Vessel tabs ── */}
      {vessels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {vessels.map((v) => (
            <button key={v.boatId} onClick={() => { setActiveVessel(v.boatId); setPage(1); }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors border-2 ${activeVessel === v.boatId ? "border-[#0c7b93] bg-[#0c7b93] text-white" : "border-teal-200 bg-white text-[#134e4a] hover:bg-teal-50"}`}>
              {v.boatName}
            </button>
          ))}
          <button onClick={() => { setActiveVessel(null); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors border-2 ${activeVessel === null ? "border-[#0c7b93] bg-[#0c7b93] text-white" : "border-teal-200 bg-white text-[#134e4a] hover:bg-teal-50"}`}>
            All vessels
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Trips This Month</p>
          <p className="mt-2 text-2xl font-bold text-[#134e4a]">{allTrips.length}</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0c7b93]">Online Fare</p>
          <p className="mt-2 text-2xl font-bold text-[#0c7b93]">{peso(totalRemittable)}</p>
          <p className="mt-0.5 text-xs text-[#0c7b93]">{monthTotals.onlinePax} pax · after fees</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Walk-in Cash</p>
          <p className="mt-2 text-2xl font-bold text-amber-800">{peso(totalWalkIn)}</p>
          <p className="mt-0.5 text-xs text-amber-700">{monthTotals.walkInPax} pax · direct</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-[#134e4a]">{peso(totalCombined)}</p>
          <p className="mt-0.5 text-xs text-[#0f766e]">{monthTotals.onlinePax + monthTotals.walkInPax} total pax</p>
        </div>
      </div>

      {/* ── Revenue explanation ── */}
      <div className="rounded-xl border border-teal-100 bg-white p-4 space-y-2">
        <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">How it works</p>
        <p className="text-xs text-[#0f766e]">
          <span className="font-semibold text-[#0c7b93]">Online fare</span> — paid via GCash through Travela Siargao. Platform and processing fees are deducted. Remaining fare is remitted to you.
        </p>
        <p className="text-xs text-[#0f766e]">
          <span className="font-semibold text-amber-700">Walk-in cash</span> — collected at counter or manually. Full amount goes directly to the vessel.
        </p>
      </div>

      {/* ── Operator Loyalty Bonus ── */}
      {!isViewingNextMonth && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-amber-900">Operator Loyalty Bonus — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              <p className="mt-0.5 text-xs text-amber-700">Our monthly thank-you for trusting Travela Siargao.</p>
            </div>
            <span className="text-2xl font-bold text-amber-900">{peso(totalPatronageBonusCents)}</span>
          </div>
          <div className="mt-3 divide-y divide-amber-100">
            {vessels.filter((v) => !activeVessel || v.boatId === activeVessel).map((v) => (
              <div key={v.boatId} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-amber-800">{v.boatName} ({v.patronagePct}%)</span>
                <span className="font-bold text-amber-900">{peso(v.bonusCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Today's Trips ── */}
      {todayTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e] mb-2">Today&apos;s Trips</h2>
          <div className="rounded-xl border border-teal-200 bg-white overflow-x-auto shadow-sm">
            <TripTable trips={todayTrips} auditTripId={auditTripId} setAuditTripId={setAuditTripId} highlight />
          </div>
        </div>
      )}

      {/* ── All Trips ── */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">
            {isViewingNextMonth ? "Upcoming" : "All Trips"} — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            <span className="ml-2 text-xs font-normal normal-case text-[#0f766e]/60">({allTrips.length})</span>
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-teal-200 px-3 py-1 text-sm text-[#134e4a] hover:bg-teal-50 disabled:opacity-40">←</button>
              <span className="text-xs text-[#0f766e]">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-teal-200 px-3 py-1 text-sm text-[#134e4a] hover:bg-teal-50 disabled:opacity-40">→</button>
            </div>
          )}
        </div>

        {allTrips.length === 0 ? (
          <div className="rounded-xl border border-teal-100 bg-white p-8 text-center text-sm text-[#0f766e]/60">
            No trips {isViewingNextMonth ? "scheduled" : "recorded"} for {MONTH_NAMES[selectedMonth - 1]} yet.
          </div>
        ) : (
          <div className="rounded-xl border border-teal-200 bg-white overflow-x-auto shadow-sm">
            <TripTable trips={pagedTrips} auditTripId={auditTripId} setAuditTripId={setAuditTripId} />
            <div className="border-t-2 border-teal-200 bg-teal-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div><p className="text-xs text-[#0f766e]">Total Trips</p><p className="font-bold text-[#134e4a]">{allTrips.length}</p></div>
              <div><p className="text-xs text-[#0c7b93]">Online Pax</p><p className="font-bold text-[#0c7b93]">{monthTotals.onlinePax}</p></div>
              <div><p className="text-xs text-amber-700">Walk-in Pax</p><p className="font-bold text-amber-700">{monthTotals.walkInPax}</p></div>
              <div><p className="text-xs text-[#0c7b93]">Online Fare</p><p className="font-bold text-[#0c7b93]">{peso(totalRemittable)}</p></div>
              <div><p className="text-xs text-amber-700">Walk-in Cash</p><p className="font-bold text-amber-700">{peso(totalWalkIn)}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TripTable({ trips, auditTripId, setAuditTripId, highlight = false }: {
  trips: TripRow[]; auditTripId: string | null;
  setAuditTripId: (id: string | null) => void; highlight?: boolean;
}) {
  return (
    <table className="min-w-full divide-y divide-teal-100 text-sm">
      <thead>
        <tr className="bg-teal-50">
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Date</th>
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Time</th>
          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Route</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0c7b93]">Online Pax</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#0c7b93]">Online Fare</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-amber-700">Walk-in</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-amber-700">Cash</th>
          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Remit</th>
          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Audit</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-teal-50">
        {trips.map((t) => {
          const isAudit = auditTripId === t.id;
          return (
            <React.Fragment key={t.id}>
              <tr className={`transition-colors ${highlight || t.isToday ? "bg-teal-50/60" : "hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">
                  {formatDate(t.departureDate, true)}
                  {t.isToday && <span className="ml-1 rounded-full bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700 font-semibold">today</span>}
                </td>
                <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">{formatTime(t.departureTime)}</td>
                <td className="px-3 py-2.5 text-[#134e4a] max-w-[120px] truncate">{t.routeName}</td>
                <td className="px-3 py-2.5 text-right">
                  {t.onlinePax > 0 ? <span className="font-semibold text-[#0c7b93]">{t.onlinePax}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {t.onlineNetFareCents > 0 ? <span className="font-medium text-[#0c7b93]">{peso(t.onlineNetFareCents)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {t.walkInPax > 0 ? <span className="text-amber-700">{t.walkInPax}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {t.walkInFareCents > 0 ? <span className="text-amber-700">{peso(t.walkInFareCents)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center"><PaymentBadge status={t.paymentStatus} /></td>
                <td className="px-3 py-2.5 text-center">
                  {t.bookings.length > 0 && (
                    <button onClick={() => setAuditTripId(isAudit ? null : t.id)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${isAudit ? "bg-[#0c7b93] text-white" : "bg-teal-50 text-[#0c7b93] border border-teal-200 hover:bg-teal-100"}`}>
                      {isAudit ? "Hide" : `Log (${t.bookings.length})`}
                    </button>
                  )}
                </td>
              </tr>

              {isAudit && t.bookings.length > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={9} className="px-4 py-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0f766e]">
                      Booking Audit Log — {t.bookings.length} transaction{t.bookings.length !== 1 ? "s" : ""}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Reference</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Customer</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-600">Source</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Created By</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-600">Pax</th>
                            <th className="px-3 py-2 text-right font-semibold text-[#0c7b93]">Online Fare</th>
                            <th className="px-3 py-2 text-right font-semibold text-amber-700">Walk-in</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Booked At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {t.bookings.map((bl) => (
                            <tr key={bl.id} className={bl.isOnline ? "bg-white" : "bg-amber-50"}>
                              <td className="px-3 py-2 font-mono font-semibold text-[#0c7b93]">{bl.reference}</td>
                              <td className="px-3 py-2 text-slate-700">{bl.customerName}</td>
                              <td className="px-3 py-2 text-center"><SourceBadge isOnline={bl.isOnline} /></td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <RoleBadge role={bl.createdByRole} />
                                  <span className="text-slate-500">{bl.createdByName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700">{bl.passengerCount}</td>
                              <td className="px-3 py-2 text-right">
                                {bl.isOnline ? <span className="font-semibold text-[#0c7b93]">{peso(bl.netFareCents)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {!bl.isOnline ? <span className="font-semibold text-amber-700">{peso(bl.netFareCents)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDateTime(bl.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-semibold">
                            <td colSpan={4} className="px-3 py-2 text-slate-600">Trip Total</td>
                            <td className="px-3 py-2 text-right text-slate-700">{t.bookings.reduce((s, b) => s + b.passengerCount, 0)}</td>
                            <td className="px-3 py-2 text-right text-[#0c7b93]">{t.onlineNetFareCents > 0 ? peso(t.onlineNetFareCents) : "—"}</td>
                            <td className="px-3 py-2 text-right text-amber-700">{t.walkInFareCents > 0 ? peso(t.walkInFareCents) : "—"}</td>
                            <td className="px-3 py-2" />
                          </tr>
                        </tfoot>
                      </table>
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
