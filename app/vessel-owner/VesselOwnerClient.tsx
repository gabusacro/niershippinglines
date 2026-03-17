"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Ship, User, Ticket } from "lucide-react";
import { CashHandoverSummary } from "@/components/dashboard/CashHandoverSummary";

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
function calcAge(birthdate: string): number {
  const bday = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - bday.getFullYear();
  const m = now.getMonth() - bday.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bday.getDate())) age--;
  return age;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PassengerDetail = {
  fare_type: string;
  full_name: string;
  gender?: string | null;
  address?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  ticket_number?: string | null;
};

type BookingLine = {
  id: string; tripId: string; reference: string; isOnline: boolean;
  paymentMethod: string | null; passengerCount: number;
  totalAmountCents: number; netFareCents: number;
  platformFeeCents: number; processingFeeCents: number;
  customerName: string; createdByName: string; createdByRole: string;
  bookingSource: string | null;
  createdAt: string; status: string;
  passengerDetails: PassengerDetail[] | null;
  fareType: string;
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

// ── Badges ────────────────────────────────────────────────────────────────────
const ROLE_MAP: Record<string, { label: string; cls: string }> = {
  passenger:    { label: "Passenger",    cls: "bg-blue-100 text-blue-800"   },
  admin:        { label: "Admin",        cls: "bg-purple-100 text-purple-800" },
  vessel_owner: { label: "Owner",        cls: "bg-teal-100 text-teal-800"   },
  crew:         { label: "Crew",         cls: "bg-orange-100 text-orange-800" },
  ticket_booth: { label: "Ticket Booth", cls: "bg-pink-100 text-pink-800"   },
  captain:      { label: "Captain",      cls: "bg-sky-100 text-sky-800"     },
};

const FARE_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  adult:   { label: "Adult",   cls: "bg-teal-100 text-teal-800"     },
  senior:  { label: "Senior",  cls: "bg-amber-100 text-amber-800"   },
  pwd:     { label: "PWD",     cls: "bg-blue-100 text-blue-800"     },
  student: { label: "Student", cls: "bg-indigo-100 text-indigo-800" },
  child:   { label: "Child",   cls: "bg-green-100 text-green-800"   },
  infant:  { label: "Infant",  cls: "bg-rose-100 text-rose-800"     },
};

const SOURCE_MAP: Record<string, { label: string; cls: string }> = {
  online:                  { label: "Online (GCash)",    cls: "bg-teal-100 text-teal-800"   },
  ticket_booth_walk_in:    { label: "Ticket Booth",      cls: "bg-pink-100 text-pink-800"   },
  admin_walk_in:           { label: "Admin Walk-in",     cls: "bg-purple-100 text-purple-800" },
  captain_walk_in:         { label: "Captain Walk-in",   cls: "bg-sky-100 text-sky-800"     },
  deck_crew_walk_in:       { label: "Crew Walk-in",      cls: "bg-orange-100 text-orange-800" },
  walk_in:                 { label: "Walk-in",           cls: "bg-amber-100 text-amber-800" },
};

function RoleBadge({ role }: { role: string }) {
  const { label, cls } = ROLE_MAP[role] ?? { label: role, cls: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
function SourceBadge({ source, isOnline }: { source: string | null; isOnline: boolean }) {
  const key = source ?? (isOnline ? "online" : "walk_in");
  const { label, cls } = SOURCE_MAP[key] ?? { label: key, cls: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
function FareTypeBadge({ fareType }: { fareType: string }) {
  const { label, cls } = FARE_TYPE_LABELS[fareType] ?? { label: fareType, cls: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

/**
 * RemitBadge — only shows a remittance status when there are online bookings
 * that require the admin to collect and remit GCash payments to the vessel owner.
 *
 * Walk-in / cash bookings go directly to the vessel owner — no admin remittance
 * needed, so we show "Cash Direct" instead of "Pending" to avoid confusion.
 */
function RemitBadge({ status, hasOnlineBookings }: {
  status: "pending" | "paid" | "failed";
  hasOnlineBookings: boolean;
}) {
  // No online bookings = all cash, goes directly to vessel owner
  if (!hasOnlineBookings) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-400">
        Cash Direct
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        Admin Paid ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
      Admin Owes You
    </span>
  );
}

// Keep PaymentBadge for the owed-trips breakdown table (which only shows online trips)
function PaymentBadge({ status }: { status: "pending" | "paid" | "failed" }) {
  if (status === "paid")   return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Paid</span>;
  if (status === "failed") return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Failed</span>;
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pending</span>;
}

// ── Passenger Breakdown Row ───────────────────────────────────────────────────
function PassengerBreakdown({ booking }: { booking: BookingLine }) {
  const [open, setOpen] = useState(false);
  const details = booking.passengerDetails;

  if (!details || details.length === 0) {
    return (
      <div className="mt-1.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <FareTypeBadge fareType={booking.fareType} />
          <span>{booking.passengerCount} passenger{booking.passengerCount !== 1 ? "s" : ""}</span>
          <span className="ml-auto font-semibold text-[#134e4a]">{peso(booking.netFareCents)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-teal-100 overflow-hidden">
      <button type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-teal-50/60 hover:bg-teal-50 transition-colors text-xs font-semibold text-[#134e4a]">
        <div className="flex items-center gap-2">
          <Ticket size={12} className="text-[#0c7b93]" />
          <span>{details.length} passengers — click to see breakdown</span>
          <div className="flex gap-1 flex-wrap">
            {[...new Set(details.map(d => d.fare_type))].map(ft => (
              <FareTypeBadge key={ft} fareType={ft} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#0c7b93]">{peso(booking.netFareCents)}</span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {open && (
        <table className="min-w-full text-xs bg-white">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Fare Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Gender</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Age</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Nationality</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Ticket #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {details.map((p, i) => (
              <tr key={i} className={p.fare_type !== "adult" ? "bg-amber-50/40" : ""}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-[#134e4a]">
                  <div className="flex items-center gap-1.5">
                    <User size={11} className="text-gray-400 shrink-0" />
                    {p.full_name}
                  </div>
                </td>
                <td className="px-3 py-2"><FareTypeBadge fareType={p.fare_type} /></td>
                <td className="px-3 py-2 text-gray-500 capitalize">{p.gender ?? "—"}</td>
                <td className="px-3 py-2 text-gray-500">
                  {p.birthdate ? `${calcAge(p.birthdate)} yrs` : "—"}
                </td>
                <td className="px-3 py-2 text-gray-500">{p.nationality ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-[#0c7b93] text-xs">{p.ticket_number ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Audit table ───────────────────────────────────────────────────────────────
function TripAuditTable({ bookings, trip }: { bookings: BookingLine[]; trip: TripRow }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
          Booking Audit — {bookings.length} transaction{bookings.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {trip.onlineNetFareCents > 0 && (
            <span className="font-semibold text-[#0c7b93]">Online: {peso(trip.onlineNetFareCents)}</span>
          )}
          {trip.walkInFareCents > 0 && (
            <span className="font-semibold text-amber-700">Walk-in cash: {peso(trip.walkInFareCents)}</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {bookings.map((bl) => (
          <div key={bl.id} className={`px-4 py-3 ${bl.isOnline ? "bg-white" : "bg-amber-50/30"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#0c7b93]">{bl.reference}</span>
                <SourceBadge source={bl.bookingSource} isOnline={bl.isOnline} />
                {!bl.isOnline && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-0.5 border border-amber-200">
                    <RoleBadge role={bl.createdByRole} />
                    <span className="text-xs font-semibold text-amber-800">{bl.createdByName}</span>
                  </div>
                )}
                {bl.isOnline && (
                  <span className="text-xs text-gray-400">by {bl.customerName}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">{formatDateTime(bl.createdAt)}</span>
                <span className={`font-bold ${bl.isOnline ? "text-[#0c7b93]" : "text-amber-700"}`}>
                  {peso(bl.netFareCents)}
                </span>
              </div>
            </div>
            <PassengerBreakdown booking={bl} />
          </div>
        ))}
      </div>

      {/* Trip footer totals */}
      <div className="bg-slate-100 border-t-2 border-slate-200 px-4 py-2.5 flex flex-wrap gap-4 text-xs font-semibold">
        <span className="text-slate-600">
          Total: {bookings.reduce((s, b) => s + b.passengerCount, 0)} pax
        </span>
        {trip.onlineNetFareCents > 0 && (
          <span className="text-[#0c7b93]">Online fare (admin owes owner): {peso(trip.onlineNetFareCents)}</span>
        )}
        {trip.walkInFareCents > 0 && (
          <span className="text-amber-700">Walk-in cash (direct to vessel): {peso(trip.walkInFareCents)}</span>
        )}
        <span className="ml-auto text-slate-700">
          Grand total: {peso(trip.onlineNetFareCents + trip.walkInFareCents)}
        </span>
      </div>
    </div>
  );
}

// ── Trip Table ────────────────────────────────────────────────────────────────
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
          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Admin Owes</th>
          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Audit</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-teal-50">
        {trips.map((t) => {
          const isAudit = auditTripId === t.id;
          // Only show remittance status if there are online bookings that
          // require admin to collect GCash and remit to the vessel owner.
          // Pure cash/walk-in trips go directly to the vessel — no remit needed.
          const hasOnlineBookings = t.onlinePax > 0 || t.onlineNetFareCents > 0;

          return (
            <React.Fragment key={t.id}>
              <tr className={`transition-colors ${highlight || t.isToday ? "bg-teal-50/60" : "hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">
                  {formatDate(t.departureDate, true)}
                  {t.isToday && (
                    <span className="ml-1 rounded-full bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700 font-semibold">
                      today
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">{formatTime(t.departureTime)}</td>
                <td className="px-3 py-2.5 text-[#134e4a] max-w-[120px] truncate">{t.routeName}</td>
                <td className="px-3 py-2.5 text-right">
                  {t.onlinePax > 0
                    ? <span className="font-semibold text-[#0c7b93]">{t.onlinePax}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {t.onlineNetFareCents > 0
                    ? <span className="font-medium text-[#0c7b93]">{peso(t.onlineNetFareCents)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {t.walkInPax > 0
                    ? <span className="text-amber-700">{t.walkInPax}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {t.walkInFareCents > 0
                    ? <span className="text-amber-700">{peso(t.walkInFareCents)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <RemitBadge status={t.paymentStatus} hasOnlineBookings={hasOnlineBookings} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {t.bookings.length > 0 && (
                    <button
                      onClick={() => setAuditTripId(isAudit ? null : t.id)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                        isAudit
                          ? "bg-[#0c7b93] text-white"
                          : "bg-teal-50 text-[#0c7b93] border border-teal-200 hover:bg-teal-100"
                      }`}>
                      {isAudit ? "Hide" : `Log (${t.bookings.length})`}
                    </button>
                  )}
                </td>
              </tr>

              {isAudit && t.bookings.length > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={9} className="px-4 py-4">
                    <TripAuditTable bookings={t.bookings} trip={t} />
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

// ── Main VesselOwnerClient ────────────────────────────────────────────────────
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
  const tripProgressPct = totalTripCount > 0 ? Math.round((completedTripCount / totalTripCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

      {/* ── Header ── */}
      <div className="rounded-2xl px-5 py-6 shadow-lg" style={{ backgroundColor: "#0c7b93" }}>
        <p style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Vessel Owner Dashboard
        </p>
        <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2, lineHeight: 1.2 }}>{ownerName}</h1>
        <p style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>{vessels.map((v) => v.boatName).join(" · ")}</p>
        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "14px 0" }} />

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={prevMonth} style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none" }}>← Prev</button>
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 700 }}>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
          {isViewingNextMonth && <span style={{ backgroundColor: "rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Next Month</span>}
          <button onClick={nextMonth} disabled={isAtMax} style={{ backgroundColor: "rgba(255,255,255,0.18)", color: isAtMax ? "rgba(255,255,255,0.35)" : "#ffffff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none", cursor: isAtMax ? "not-allowed" : "pointer" }}>Next →</button>
          {(isViewingNextMonth || (selectedYear === currentYear && selectedMonth !== currentMonth)) && (
            <button onClick={() => goToMonth(currentYear, currentMonth)} style={{ marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none" }}>This month</button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Total Trips",  value: String(totalTripCount) },
            { label: "Online Pax",   value: String(monthTotals.onlinePax) },
            { label: "Walk-in Pax",  value: String(monthTotals.walkInPax), yellow: true },
            { label: "Total Fare",   value: peso(totalCombined) },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trip Progress ── */}
      {!isViewingNextMonth && (
        <div className="rounded-xl border-2 border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-[#134e4a]">Trip Progress — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              <p className="text-xs text-[#0f766e] mt-0.5">{completedTripCount} completed · {todayTripCount} today · {upcomingTripCount} upcoming</p>
            </div>
            <span className="text-2xl font-black text-[#0c7b93]">{completedTripCount} <span className="text-base font-normal text-[#0f766e]">/ {totalTripCount} trips</span></span>
          </div>
          <div className="w-full h-3 rounded-full bg-teal-100 overflow-hidden">
            <div className="h-3 rounded-full transition-all" style={{ width: `${tripProgressPct}%`, backgroundColor: "#0c7b93" }} />
          </div>
          <p className="mt-1.5 text-xs text-[#0f766e]">{tripProgressPct}% of this month&apos;s trips completed</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Completed", value: completedTripCount, sub: "past trips",    bg: "bg-teal-50",  border: "border-teal-200",  val: "text-[#0c7b93]",  lbl: "text-[#0f766e]"  },
              { label: "Today",     value: todayTripCount,     sub: "happening now", bg: "bg-amber-50", border: "border-amber-200", val: "text-amber-800", lbl: "text-amber-700" },
              { label: "Upcoming",  value: upcomingTripCount,  sub: "remaining",     bg: "bg-blue-50",  border: "border-blue-200",  val: "text-blue-800",  lbl: "text-blue-700"  },
            ].map(s => (
              <div key={s.label} className={`rounded-xl ${s.bg} border ${s.border} p-3 text-center`}>
                <p className={`text-xs ${s.lbl} font-semibold`}>{s.label}</p>
                <p className={`text-xl font-black ${s.val} mt-0.5`}>{s.value}</p>
                <p className={`text-xs ${s.lbl} opacity-60`}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Admin Owes Me ── */}
      {!isViewingNextMonth && (
        <div className={`rounded-xl border-2 p-5 shadow-sm ${totalOwedCents > 0 ? "border-rose-300 bg-rose-50" : "border-green-300 bg-green-50"}`}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className={`text-sm font-bold ${totalOwedCents > 0 ? "text-rose-900" : "text-green-900"}`}>
                Admin Owes Me — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <p className={`text-xs mt-0.5 ${totalOwedCents > 0 ? "text-rose-700" : "text-green-700"}`}>
                Online (GCash) fare collected by admin that hasn&apos;t been remitted yet.
                Walk-in cash goes directly to the vessel — not included here.
              </p>
            </div>
            <div className="text-right">
              {totalOwedCents > 0
                ? <p className="text-2xl font-black text-rose-700">{peso(totalOwedCents)}</p>
                : <p className="text-lg font-bold text-green-700">All paid!</p>}
              {totalPaidCents > 0 && <p className="text-xs text-green-700 font-semibold mt-0.5">{peso(totalPaidCents)} already remitted</p>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "Pending Remittance", value: peso(totalOwedCents),                sub: `${owedTrips.filter(t=>t.paymentStatus==="pending").length} trips`, border: "border-rose-200",  val: "text-rose-700"  },
              { label: "Already Remitted",   value: peso(totalPaidCents),                sub: `${owedTrips.filter(t=>t.paymentStatus==="paid").length} trips`,    border: "border-green-200", val: "text-green-700" },
              { label: "Total Online Fare",  value: peso(totalOwedCents+totalPaidCents), sub: `${owedTrips.length} trips`,                                        border: "border-teal-200",  val: "text-[#0c7b93]" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl bg-white border ${s.border} p-3 text-center`}>
                <p className="text-xs font-semibold text-gray-600">{s.label}</p>
                <p className={`text-xl font-black ${s.val} mt-0.5`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {owedTrips.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowOwedBreakdown(!showOwedBreakdown)}
                className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${totalOwedCents > 0 ? "bg-rose-100 text-rose-800 hover:bg-rose-200" : "bg-green-100 text-green-800 hover:bg-green-200"}`}>
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
                            <span className={t.paymentStatus === "paid" ? "text-green-700" : "text-rose-700"}>{peso(t.netFareCents)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center"><PaymentBadge status={t.paymentStatus} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{t.paidAt ? formatDateTime(t.paidAt) : "—"}</td>
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
            Only online (GCash) bookings require admin remittance. Walk-in cash is collected directly by the vessel.
          </p>
        </div>
      )}

      {/* ── Walk-in Cash Accountability ── */}
      {!isViewingNextMonth && activeVessel && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-sm font-bold text-amber-900">
                Walk-in Cash — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Cash collected by your ticket booth for{" "}
                {vessels.find(v => v.boatId === activeVessel)?.boatName ?? "your vessel"}.
                Mark each day as received once the booth hands it over to you — via cash or GCash.
                Past records are saved permanently for your reference.
              </p>
            </div>
          </div>
          <CashHandoverSummary
            boatId={activeVessel}
            vesselName={vessels.find(v => v.boatId === activeVessel)?.boatName ?? ""}
            mode="owner"
            todayOnly={false}
            year={selectedYear}
            month={selectedMonth}
          />
          <p className="mt-3 text-xs text-gray-400">
            Only days with walk-in bookings are shown. Mark as received once your ticket booth
            hands over the cash — by hand or via GCash transfer.
          </p>
        </div>
      )}

      {/* ── Next Month Preview ── */}
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
          {nextMonthPreview.tripCount > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Trips",            value: nextMonthPreview.tripCount,            cls: "text-blue-900"  },
                { label: "Online Pax",       value: nextMonthPreview.onlinePax,            cls: "text-teal-800"  },
                { label: "Walk-in Pax",      value: nextMonthPreview.walkInPax,            cls: "text-amber-800" },
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
        {[
          { label: "Trips This Month", value: peso(0),               num: allTrips.length,                           bg: "border-teal-100 bg-white",     val: "text-[#134e4a]", lbl: "text-[#0f766e]", isNum: true  },
          { label: "Online Fare",      value: peso(totalRemittable),  num: monthTotals.onlinePax,                     bg: "border-teal-200 bg-teal-50",   val: "text-[#0c7b93]", lbl: "text-[#0c7b93]", isNum: false },
          { label: "Walk-in Cash",     value: peso(totalWalkIn),      num: monthTotals.walkInPax,                     bg: "border-amber-200 bg-amber-50", val: "text-amber-800", lbl: "text-amber-700", isNum: false },
          { label: "Total Revenue",    value: peso(totalCombined),    num: monthTotals.onlinePax + monthTotals.walkInPax, bg: "border-teal-200 bg-white", val: "text-[#134e4a]", lbl: "text-[#0f766e]", isNum: false },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 shadow-sm ${s.bg}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${s.lbl}`}>{s.label}</p>
            <p className={`mt-2 text-2xl font-bold ${s.val}`}>{s.isNum ? s.num : s.value}</p>
            {!s.isNum && <p className={`mt-0.5 text-xs ${s.lbl}`}>{s.num} pax</p>}
          </div>
        ))}
      </div>

      {/* ── How it works ── */}
      <div className="rounded-xl border border-teal-100 bg-white p-4 space-y-2">
        <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">How it works</p>
        <p className="text-xs text-[#0f766e]">
          <span className="font-semibold text-[#0c7b93]">Online fare</span> — paid via GCash through Travela Siargao. Platform and processing fees are deducted. Remaining fare is remitted to you by the admin.
        </p>
        <p className="text-xs text-[#0f766e]">
          <span className="font-semibold text-amber-700">Walk-in cash</span> — collected directly at the ticket booth or vessel counter. Full amount goes directly to the vessel — no admin remittance needed.
        </p>
      </div>

      {/* ── Patronage Bonus ── */}
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
