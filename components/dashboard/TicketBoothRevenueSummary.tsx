"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, Wallet, Smartphone, Users } from "lucide-react";

interface RevenueSummaryRow {
  reference: string;
  booking_source: string;
  is_walk_in: boolean;
  passenger_count: number;
  total_amount_cents: number;
  created_at: string;
  departure_date: string;
  departure_time: string;
  customer_full_name: string;
  status: string;
}

interface SummaryTotals {
  cashTotal: number;
  onlineTotal: number;
  cashPax: number;
  onlinePax: number;
  totalBookings: number;
  rows: RevenueSummaryRow[];
}

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function fmt12(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return d; }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: "Asia/Manila",
    });
  } catch { return iso; }
}

// ── Date range helpers ────────────────────────────────────────────────────────
function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function getWeekRange(offsetWeeks: number): { start: string; end: string; label: string } {
  // Get today in Manila time
  const todayStr = getTodayManila();
  const today = new Date(todayStr + "T00:00:00");
  const day = today.getDay(); // 0=Sun, 1=Mon...
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const labelFmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const label = offsetWeeks === 0
    ? "This Week"
    : offsetWeeks === -1
    ? "Last Week"
    : `${labelFmt(monday)} – ${labelFmt(sunday)}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  return { start, end, label };
}

type ViewMode = "day" | "week" | "month";

interface Props {
  boatId: string;
  vesselName: string;
}

export function TicketBoothRevenueSummary({ boatId, vesselName }: Props) {
  const [mode, setMode]           = useState<ViewMode>("day");
  const [dayOffset, setDayOffset] = useState(0);     // 0 = today, -1 = yesterday
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = this week
  const [monthYear, setMonthYear] = useState({ year: 2026, month: 1 });
  // Initialize to actual current month on client only (avoids hydration mismatch)
  useEffect(() => {
    const now = new Date();
    setMonthYear({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }, []);
  const [data,    setData]    = useState<SummaryTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Compute date range from current mode + offset ─────────────────────────
  const getDateRange = useCallback((): { start: string; end: string; label: string } => {
    if (mode === "day") {
      const today = new Date(getTodayManila() + "T00:00:00");
      today.setDate(today.getDate() + dayOffset);
      const d = today.toISOString().slice(0, 10);
      const label = dayOffset === 0 ? "Today"
        : dayOffset === -1 ? "Yesterday"
        : today.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
      return { start: d, end: d, label };
    }
    if (mode === "week") return getWeekRange(weekOffset);
    return getMonthRange(monthYear.year, monthYear.month);
  }, [mode, dayOffset, weekOffset, monthYear]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({ boat_id: boatId, start, end });
      const res = await fetch(`/api/admin/ticket-booth-summary?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [boatId, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [today, setToday] = useState("");
  useEffect(() => { setToday(getTodayManila()); }, []);
  const [label, setLabel] = useState("Today");
  useEffect(() => { setLabel(getDateRange().label); }, [getDateRange]);
  const isToday = mode === "day" && dayOffset === 0;
  const isThisWeek = mode === "week" && weekOffset === 0;
  const [nowMonth, setNowMonth] = useState({ year: 2026, month: 1 });
  useEffect(() => {
    const now = new Date();
    setNowMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }, []);
  const isThisMonth = mode === "month" &&
    monthYear.year === nowMonth.year && monthYear.month === nowMonth.month;
  const canGoForward = mode === "day" ? dayOffset < 0
    : mode === "week" ? weekOffset < 0
    : !isThisMonth;

  function goBack() {
    if (mode === "day")   setDayOffset(d => d - 1);
    if (mode === "week")  setWeekOffset(w => w - 1);
    if (mode === "month") {
      setMonthYear(({ year, month }) =>
        month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
      );
    }
  }

  function goForward() {
    if (!canGoForward) return;
    if (mode === "day")   setDayOffset(d => d + 1);
    if (mode === "week")  setWeekOffset(w => w + 1);
    if (mode === "month") {
      setMonthYear(({ year, month }) =>
        month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
      );
    }
  }

  function resetToNow() {
    setDayOffset(0); setWeekOffset(0);
    const now = new Date();
    setMonthYear({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="border-b border-teal-100 bg-teal-50/50 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#0c7b93]" />
          <span className="text-sm font-bold text-[#134e4a]">Revenue Summary — {vesselName}</span>
        </div>
        {/* Mode tabs */}
        <div className="flex gap-1 rounded-xl bg-teal-100 p-1">
          {(["day", "week", "month"] as ViewMode[]).map(m => (
            <button key={m} type="button"
              onClick={() => { setMode(m); resetToNow(); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize ${
                mode === m ? "bg-[#0c7b93] text-white shadow-sm" : "text-[#0f766e] hover:bg-teal-200"
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-teal-50 bg-white">
        <button type="button" onClick={goBack}
          className="flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>

        <div className="text-center">
          <div className="text-sm font-bold text-[#134e4a]">{label}</div>
          {!isToday && !isThisWeek && !isThisMonth && (
            <button type="button" onClick={resetToNow}
              className="text-xs text-[#0c7b93] hover:underline mt-0.5">
              Back to current
            </button>
          )}
        </div>

        <button type="button" onClick={goForward} disabled={!canGoForward}
          className="flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>

      {!mounted || loading ? (
        <div className="py-10 text-center text-sm text-[#0f766e] animate-pulse">Loading…</div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-[#0f766e]/60">No data available.</div>
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            {[
              {
                icon: Wallet,
                label: "Cash (Walk-in)",
                value: peso(data.cashTotal),
                sub: `${data.cashPax} pax`,
                color: "text-amber-700",
                bg: "bg-amber-50 border-amber-200",
                iconColor: "text-amber-600",
              },
              {
                icon: Smartphone,
                label: "Online (GCash)",
                value: peso(data.onlineTotal),
                sub: `${data.onlinePax} pax`,
                color: "text-teal-700",
                bg: "bg-teal-50 border-teal-200",
                iconColor: "text-teal-600",
              },
              {
                icon: TrendingUp,
                label: "Total Revenue",
                value: peso(data.cashTotal + data.onlineTotal),
                sub: `${data.cashPax + data.onlinePax} pax`,
                color: "text-[#0c7b93]",
                bg: "bg-[#0c7b93]/5 border-[#0c7b93]/20",
                iconColor: "text-[#0c7b93]",
              },
              {
                icon: Users,
                label: "Total Bookings",
                value: String(data.totalBookings),
                sub: `${data.cashPax + data.onlinePax} passengers`,
                color: "text-[#134e4a]",
                bg: "bg-gray-50 border-gray-200",
                iconColor: "text-gray-500",
              },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={13} className={s.iconColor} />
                  <span className="text-xs font-semibold text-gray-500">{s.label}</span>
                </div>
                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Booking rows */}
          {data.rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#0f766e]/50">
              No bookings for this period.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-teal-50">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-teal-50/40">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Passenger</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Trip</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Type</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[#0f766e] uppercase tracking-wide">Pax</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[#0f766e] uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Booked At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {data.rows.map(r => {
                    const isWalkIn = r.is_walk_in;
                    return (
                      <tr key={r.reference} className={`hover:bg-teal-50/20 transition-colors ${isWalkIn ? "bg-amber-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0c7b93]">{r.reference}</td>
                        <td className="px-4 py-3 font-medium text-[#134e4a]">{r.customer_full_name}</td>
                        <td className="px-4 py-3 text-xs text-[#0f766e]">
                          {formatDate(r.departure_date)} {fmt12(r.departure_time)}
                        </td>
                        <td className="px-4 py-3">
                          {isWalkIn
                            ? <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">Cash</span>
                            : <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-xs font-semibold">Online</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#134e4a]">{r.passenger_count}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={isWalkIn ? "text-amber-700" : "text-teal-700"}>
                            {peso(r.total_amount_cents)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {formatDateTime(r.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 border-t-2 border-teal-200 font-semibold">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-[#134e4a]">
                      {label} Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#134e4a]">
                      {data.cashPax + data.onlinePax}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-[#0c7b93]">
                      {peso(data.cashTotal + data.onlineTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
