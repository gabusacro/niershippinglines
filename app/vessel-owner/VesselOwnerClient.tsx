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

type Vessel = { boatId: string; boatName: string; patronagePct: number; bonusCents: number };
type MonthTotals = { onlinePax: number; walkInPax: number; onlineNetFareCents: number; walkInFareCents: number };
type NextMonthPreview = {
  month: number; year: number; monthName: string;
  onlinePax: number; walkInPax: number; tripCount: number; onlineNetFareCents: number;
} | null;

interface Props {
  ownerName: string; vessels: Vessel[]; tripRows: TripRow[];
  todayTripIds: string[]; selectedYear: number; selectedMonth: number;
  currentYear: number; currentMonth: number; monthTotals: MonthTotals;
  totalPatronageBonusCents: number; nextMonthPreview: NextMonthPreview;
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
  selectedYear, selectedMonth, currentYear, currentMonth,
  monthTotals, totalPatronageBonusCents, nextMonthPreview,
}: Props) {
  const router = useRouter();
  const [activeVessel, setActiveVessel] = useState<string | null>(vessels[0]?.boatId ?? null);
  const [page, setPage] = useState(1);
  const [auditTripId, setAuditTripId] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

      {/* ── Header — iOS Safari safe: no gradient opacity on text, all solid colors ── */}
      <div
        className="rounded-2xl px-5 py-6 shadow-lg"
        style={{ backgroundColor: "#0c7b93" }}
      >
        {/* Top row: label + vessel name */}
        <div className="mb-1">
          <p style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Vessel Owner Dashboard
          </p>
          <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2, lineHeight: 1.2 }}>
            {ownerName}
          </h1>
          <p style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>
            {vessels.map((v) => v.boatName).join(" · ")}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "14px 0" }} />

        {/* Month navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={prevMonth}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none" }}
          >
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
          <button
            onClick={nextMonth}
            disabled={isAtMax}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: isAtMax ? "rgba(255,255,255,0.35)" : "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none", cursor: isAtMax ? "not-allowed" : "pointer" }}
          >
            Next →
          </button>
          {(isViewingNextMonth || (selectedYear === currentYear && selectedMonth !== currentMonth)) && (
            <button
              onClick={() => goToMonth(currentYear, currentMonth)}
              style={{ marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none" }}
            >
              This month
            </button>
          )}
        </div>

        {/* Quick stats row inside header — visible on mobile without scrolling */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Trips", value: String(allTrips.length), color: "#d0f0f7" },
            { label: "Online Pax", value: String(monthTotals.onlinePax), color: "#d0f0f7" },
            { label: "Walk-in Pax", value: String(monthTotals.walkInPax), color: "#fde68a" },
            { label: "Total Fare", value: peso(totalCombined), color: "#d0f0f7" },
          ].map((s) => (
            <div
              key={s.label}
              style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}
            >
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Next Month Early Booking Alert ── */}
      {nextMonthPreview && !isViewingNextMonth && (
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-blue-900">
                Early Bookings — {nextMonthPreview.monthName} {nextMonthPreview.year}
              </p>
              <p className="mt-1 text-xs text-blue-700">Passengers have already booked for next month.</p>
            </div>
            <button
              onClick={() => goToMonth(nextMonthPreview.year, nextMonthPreview.month)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
              View {nextMonthPreview.monthName} →
            </button>
          </div>
          {nextMonthPreview.tripCount === 0 ? (
            <p className="mt-3 text-sm text-blue-600">No trips scheduled yet for {nextMonthPreview.monthName}.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Trips", value: nextMonthPreview.tripCount, color: "text-blue-900" },
                { label: "Online Pax", value: nextMonthPreview.onlinePax, color: "text-teal-800" },
                { label: "Walk-in Pax", value: nextMonthPreview.walkInPax, color: "text-amber-800" },
                { label: "Est. Online Fare", value: peso(nextMonthPreview.onlineNetFareCents), color: "text-blue-900" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">{s.label}</p>
                  <p className={`mt-0.5 text-lg font-bold ${s.color}`}>{s.value}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
            {isViewingNextMonth ? "Scheduled Trips" : "Trips This Month"}
          </p>
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
          <p className="mt-0.5 text-xs text-amber-700">{monthTotals.walkInPax} pax · direct collect</p>
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
          <span className="font-semibold text-amber-700">Walk-in cash</span> — collected at counter or manually by crew. Full amount goes directly to the vessel. Travela does not handle this money.
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
          <p className="mt-3 text-xs text-amber-600">Paid monthly as a thank-you for your continued partnership.</p>
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
  trips: TripRow[];
  auditTripId: string | null;
  setAuditTripId: (id: string | null) => void;
  highlight?: boolean;
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
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-amber-700">Walk-in Pax</th>
          <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-amber-700">Walk-in Cash</th>
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
                <td className="px-3 py-2.5 text-[#134e4a] max-w-[130px] truncate">{t.routeName}</td>
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
                    <button
                      onClick={() => setAuditTripId(isAudit ? null : t.id)}
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
                            <th className="px-3 py-2 text-right font-semibold text-amber-700">Walk-in Cash</th>
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
                            <td className="px-3 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Online fare = total paid minus platform fees · Walk-in cash = collected directly by vessel
                    </p>
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
