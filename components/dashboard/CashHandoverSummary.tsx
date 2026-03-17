"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, CheckCircle, Clock, Banknote, AlertCircle } from "lucide-react";

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return d; }
}
function fmt12(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type BookingRef = { name: string; pax: number; cents: number };

type TripEntry = {
  tripId: string;
  departure_time: string;
  routeName: string;
  pax: number;
  amountCents: number;
  bookingRefs: BookingRef[];
};

type Handover = {
  id: string;
  handover_date: string;
  total_amount_cents: number;
  handover_method: string;
  reference_note: string | null;
  marked_received_at: string;
  marked_received_by: string | null;
};

type DayEntry = {
  date: string;
  totalCents: number;
  totalPax: number;
  tripCount: number;
  trips: TripEntry[];
  hasAnyBookings: boolean;
  handover: Handover | null;
};

type Props = {
  boatId: string;
  vesselName: string;
  mode: "owner" | "booth";
  todayOnly?: boolean;
  year?: number;
  month?: number;
};

const METHOD_LABELS: Record<string, string> = {
  cash_in_person: "Cash in person",
  gcash:          "GCash transfer",
  bank_transfer:  "Bank transfer",
  other:          "Other",
};

// ── Main Component ────────────────────────────────────────────────────────────
export function CashHandoverSummary({
  boatId, vesselName, mode, todayOnly = false, year, month,
}: Props) {
  const [days, setDays]               = useState<DayEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Mark as received modal state
  const [markingDate,   setMarkingDate]   = useState<string | null>(null);
  const [markingAmount, setMarkingAmount] = useState(0);
  const [method,        setMethod]        = useState("cash_in_person");
  const [refNote,       setRefNote]       = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [unmarking,     setUnmarking]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const y = year  ?? now.getFullYear();
      const m = month ?? (now.getMonth() + 1);
      const res = await fetch(
        `/api/cash-handovers?boat_id=${boatId}&year=${y}&month=${m}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load cash data");
      const data: DayEntry[] = await res.json();

      if (todayOnly) {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        setDays(data.filter(d => d.date === today));
      } else {
        setDays(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [boatId, year, month, todayOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openMarkModal = (day: DayEntry) => {
    setMarkingDate(day.date);
    setMarkingAmount(day.totalCents);
    setMethod("cash_in_person");
    setRefNote("");
    setSaveError("");
  };

  const submitMark = async () => {
    if (!markingDate) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/cash-handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boat_id:            boatId,
          handover_date:      markingDate,
          total_amount_cents: markingAmount,
          handover_method:    method,
          reference_note:     refNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Failed to save"); return; }
      setMarkingDate(null);
      await fetchData();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnmark = async (date: string) => {
    setUnmarking(date);
    try {
      await fetch(`/api/cash-handovers?boat_id=${boatId}&handover_date=${date}`, {
        method: "DELETE",
      });
      await fetchData();
    } finally {
      setUnmarking(null);
    }
  };

  // ── Summary totals ────────────────────────────────────────────────────────
  const daysWithCash    = days.filter(d => d.totalCents > 0);
  const totalCollected  = days.reduce((s, d) => s + d.totalCents, 0);
  const totalReceived   = days.filter(d => d.handover).reduce((s, d) => s + d.totalCents, 0);
  const totalPending    = totalCollected - totalReceived;
  const totalPax        = days.reduce((s, d) => s + d.totalPax, 0);
  // Days that had trips but ZERO cash — potential accountability red flag
  const suspiciousDays  = days.filter(d => d.tripCount > 0 && !d.hasAnyBookings);

  if (loading) {
    return (
      <div className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm text-[#0f766e] animate-pulse">
        Loading cash summary…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        {error} — <button onClick={fetchData} className="underline">retry</button>
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm text-[#0f766e]/60">
        {todayOnly ? "No trips scheduled today." : "No trips scheduled this month yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Monthly totals bar ── */}
      {!todayOnly && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              label: "Total collected",
              value: peso(totalCollected),
              sub: `${totalPax} pax · ${daysWithCash.length} days`,
              cls: "text-[#134e4a]",
            },
            {
              label: "Owner confirmed",
              value: peso(totalReceived),
              sub: `${days.filter(d => d.handover).length} days confirmed`,
              cls: "text-emerald-700",
            },
            {
              label: "Pending handover",
              value: peso(totalPending),
              sub: `${daysWithCash.filter(d => !d.handover).length} days unconfirmed`,
              cls: totalPending > 0 ? "text-amber-700" : "text-gray-400",
            },
            {
              label: "Zero cash days",
              value: String(suspiciousDays.length),
              sub: suspiciousDays.length > 0 ? "trips with no walk-in" : "all days accounted for",
              cls: suspiciousDays.length > 0 ? "text-rose-600" : "text-gray-400",
            },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-teal-100 bg-white p-3 text-center">
              <p className="text-xs text-[#0f766e] font-semibold">{s.label}</p>
              <p className={`text-lg font-black mt-0.5 ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Per-day list ── */}
      <div className="space-y-2">
        {days.map((day) => {
          const isExpanded  = expandedDay === day.date;
          const isConfirmed = !!day.handover;
          const isZeroCash  = day.tripCount > 0 && !day.hasAnyBookings;

          // Determine card style based on state
          const cardStyle = isConfirmed
            ? "border-emerald-200 bg-emerald-50/40"
            : isZeroCash
              ? "border-gray-200 bg-gray-50/60"
              : day.totalCents > 0
                ? "border-amber-200 bg-amber-50/30"
                : "border-teal-100 bg-white";

          return (
            <div key={day.date} className={`rounded-xl border-2 overflow-hidden transition-all ${cardStyle}`}>

              {/* ── Day header ── */}
              <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {isConfirmed
                    ? <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                    : isZeroCash
                      ? <AlertCircle size={18} className="text-gray-400 shrink-0" />
                      : <Clock size={18} className="text-amber-600 shrink-0" />
                  }
                  <div>
                    <div className="font-bold text-[#134e4a] text-sm">{formatDate(day.date)}</div>
                    <div className="text-xs text-[#0f766e] mt-0.5">
                      {day.tripCount} trip{day.tripCount !== 1 ? "s" : ""} scheduled
                      {day.totalPax > 0 && ` · ${day.totalPax} walk-in pax`}
                      {isZeroCash && (
                        <span className="ml-1 text-gray-400 italic">— no walk-in bookings</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-right">
                    <div className={`text-lg font-black ${
                      isConfirmed ? "text-emerald-700"
                      : isZeroCash ? "text-gray-400"
                      : "text-amber-700"
                    }`}>
                      {isZeroCash ? "₱0" : peso(day.totalCents)}
                    </div>
                    {isConfirmed && day.handover && (
                      <div className="text-xs text-emerald-600 font-semibold">
                        ✓ {METHOD_LABELS[day.handover.handover_method] ?? day.handover.handover_method}
                        {day.handover.reference_note && ` · ${day.handover.reference_note}`}
                      </div>
                    )}
                    {isConfirmed && day.handover && (
                      <div className="text-xs text-gray-400">
                        {formatTimestamp(day.handover.marked_received_at)}
                      </div>
                    )}
                  </div>

                  {/* Action buttons — owner mode */}
                  {mode === "owner" && !isConfirmed && day.totalCents > 0 && (
                    <button
                      onClick={() => openMarkModal(day)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap">
                      Mark Received
                    </button>
                  )}
                  {mode === "owner" && isConfirmed && (
                    <button
                      onClick={() => handleUnmark(day.date)}
                      disabled={unmarking === day.date}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50">
                      {unmarking === day.date ? "…" : "Undo"}
                    </button>
                  )}

                  {/* Status badge — booth mode */}
                  {mode === "booth" && !isZeroCash && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isConfirmed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {isConfirmed ? "Owner confirmed ✓" : "Pending handover"}
                    </span>
                  )}

                  {/* Expand toggle — only if there's something to show */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                    className="rounded-xl border border-teal-200 bg-white px-2 py-2 text-[#0c7b93] hover:bg-teal-50 transition-colors">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* ── Expanded per-trip breakdown ── */}
              {isExpanded && (
                <div className="border-t border-teal-100 bg-white">
                  {day.trips.map((trip) => (
                    <div key={trip.tripId}
                      className="px-4 py-3 border-b border-teal-50 last:border-b-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-[#0c7b93] text-white px-2 py-1 text-xs font-bold">
                            {fmt12(trip.departure_time)}
                          </span>
                          <span className="text-sm font-semibold text-[#134e4a]">
                            {trip.routeName}
                          </span>
                          {trip.pax > 0
                            ? <span className="text-xs text-[#0f766e]">{trip.pax} pax</span>
                            : <span className="text-xs text-gray-400 italic">no walk-in bookings</span>
                          }
                        </div>
                        <span className={`font-bold ${trip.amountCents > 0 ? "text-amber-700" : "text-gray-400"}`}>
                          {trip.amountCents > 0 ? peso(trip.amountCents) : "₱0"}
                        </span>
                      </div>

                      {/* Per-booking list */}
                      {trip.bookingRefs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {trip.bookingRefs.map((br, i) => (
                            <div key={i}
                              className="flex items-center justify-between text-xs text-gray-500 pl-2 border-l-2 border-teal-100">
                              <span>{br.name} ({br.pax} pax)</span>
                              <span className="font-semibold">{peso(br.cents)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Day total footer */}
                  <div className="px-4 py-2.5 bg-teal-50 flex justify-between text-sm font-bold border-t border-teal-100">
                    <span className="text-[#134e4a]">
                      Day total{day.totalPax > 0 ? ` — ${day.totalPax} pax` : ""}
                    </span>
                    <span className={day.totalCents > 0 ? "text-amber-700" : "text-gray-400"}>
                      {day.totalCents > 0 ? peso(day.totalCents) : "₱0 collected"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mark as Received Modal ── */}
      {markingDate && mode === "owner" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMarkingDate(null); }}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-teal-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="rounded-full bg-emerald-100 p-2">
                <Banknote size={20} className="text-emerald-700" />
              </div>
              <div>
                <div className="font-bold text-[#134e4a]">Confirm Cash Received</div>
                <div className="text-xs text-[#0f766e] mt-0.5">
                  {formatDate(markingDate)} · {vesselName}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center mb-5">
              <div className="text-xs text-emerald-700 font-semibold">Amount to confirm</div>
              <div className="text-3xl font-black text-emerald-800 mt-1">{peso(markingAmount)}</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#134e4a]">How was cash sent?</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none">
                  <option value="cash_in_person">Cash in person</option>
                  <option value="gcash">GCash transfer</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#134e4a]">
                  Reference / Note
                  <span className="ml-1 font-normal text-[#0f766e]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={refNote}
                  onChange={e => setRefNote(e.target.value)}
                  placeholder={
                    method === "gcash" ? "GCash ref # e.g. 09123456789" : "Any notes"
                  }
                  className="mt-1 w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
                />
              </div>

              {saveError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={submitMark}
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 font-bold text-white text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Confirm Received ✓"}
                </button>
                <button
                  onClick={() => setMarkingDate(null)}
                  className="min-h-[48px] rounded-xl border-2 border-teal-200 px-4 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
