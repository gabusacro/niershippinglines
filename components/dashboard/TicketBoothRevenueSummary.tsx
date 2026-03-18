"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, Wallet, Smartphone, Users, User } from "lucide-react";

interface RevenueSummaryRow {
  reference:          string;
  booking_source:     string;
  is_walk_in:         boolean;
  passenger_count:    number;
  total_amount_cents: number;
  created_at:         string;
  departure_date:     string;
  departure_time:     string;
  customer_full_name: string;
  status:             string;
  issuer_name:        string;
  issuer_role:        string;
}

interface StaffSummary {
  issuer_id:    string;
  issuer_name:  string;
  issuer_role:  string;
  cashTotal:    number;
  onlineTotal:  number;
  cashPax:      number;
  onlinePax:    number;
  bookingCount: number;
}

interface SummaryTotals {
  cashTotal:     number;
  onlineTotal:   number;
  cashPax:       number;
  onlinePax:     number;
  totalBookings: number;
  rows:          RevenueSummaryRow[];
  staffSummary:  StaffSummary[];
}

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

const ROLE_LABELS: Record<string, string> = {
  ticket_booth: "Ticket Booth",
  captain:      "Captain",
  deck_crew:    "Crew",
  admin:        "Admin",
};

const ROLE_BADGE: Record<string, string> = {
  ticket_booth: "bg-pink-100 text-pink-800",
  captain:      "bg-sky-100 text-sky-800",
  deck_crew:    "bg-orange-100 text-orange-800",
  admin:        "bg-purple-100 text-purple-800",
};

type ViewMode = "day" | "week" | "month";

interface Props {
  boatId:     string;
  vesselName: string;
}

function getDateRange(mode: ViewMode, dayOffset: number, weekOffset: number, monthOffset: number) {
  const now = new Date();

  if (mode === "day") {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const str = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const label = dayOffset === 0 ? "Today"
      : dayOffset === -1 ? "Yesterday"
      : d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
    return { start: str, end: str, label };
  }

  if (mode === "week") {
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const today    = new Date(todayStr + "T00:00:00");
    const day      = today.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const monday   = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday + weekOffset * 7);
    const sunday   = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt      = (d: Date) => d.toISOString().slice(0, 10);
    const labelFmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const label    = weekOffset === 0 ? "This Week"
      : weekOffset === -1 ? "Last Week"
      : `${labelFmt(monday)} – ${labelFmt(sunday)}`;
    return { start: fmt(monday), end: fmt(sunday), label };
  }

  const base    = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year    = base.getFullYear();
  const month   = base.getMonth() + 1;
  const start   = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end     = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label   = base.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  return { start, end, label };
}

export function TicketBoothRevenueSummary({ boatId, vesselName }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [mode,        setMode]        = useState<ViewMode>("day");
  const [dayOffset,   setDayOffset]   = useState(0);
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [data,        setData]        = useState<SummaryTotals | null>(null);
  const [loading,     setLoading]     = useState(false);

  const fetchData = useCallback(async () => {
    if (!mounted) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange(mode, dayOffset, weekOffset, monthOffset);
      const params = new URLSearchParams({ boat_id: boatId, start, end });
      const res = await fetch(`/api/admin/ticket-booth-summary?${params}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [mounted, boatId, mode, dayOffset, weekOffset, monthOffset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white shadow-sm p-8 text-center">
        <div className="text-sm text-[#0f766e] animate-pulse">Loading revenue summary…</div>
      </div>
    );
  }

  const { label } = getDateRange(mode, dayOffset, weekOffset, monthOffset);
  const canGoForward = mode === "day" ? dayOffset < 0
    : mode === "week" ? weekOffset < 0
    : monthOffset < 0;

  function goBack() {
    if (mode === "day")   setDayOffset(d => d - 1);
    if (mode === "week")  setWeekOffset(w => w - 1);
    if (mode === "month") setMonthOffset(m => m - 1);
  }
  function goForward() {
    if (!canGoForward) return;
    if (mode === "day")   setDayOffset(d => d + 1);
    if (mode === "week")  setWeekOffset(w => w + 1);
    if (mode === "month") setMonthOffset(m => m + 1);
  }
  function resetToNow() {
    setDayOffset(0); setWeekOffset(0); setMonthOffset(0);
  }

  const isAtCurrent = mode === "day" ? dayOffset === 0
    : mode === "week" ? weekOffset === 0
    : monthOffset === 0;

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="border-b border-teal-100 bg-teal-50/50 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#0c7b93]" />
          <span className="text-sm font-bold text-[#134e4a]">Revenue Summary — {vesselName}</span>
        </div>
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
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-teal-50">
        <button type="button" onClick={goBack}
          className="flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-[#134e4a]">{label}</div>
          {!isAtCurrent && (
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

      {loading ? (
        <div className="py-10 text-center text-sm text-[#0f766e] animate-pulse">Loading…</div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-[#0f766e]/60">No data available.</div>
      ) : (
        <>
          {/* ── Overall stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            {[
              { icon: Wallet,     label: "Cash (Walk-in)",   value: peso(data.cashTotal),                    sub: `${data.cashPax} pax`,                  color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",        iconColor: "text-amber-600"  },
              { icon: Smartphone, label: "Online (Payment)", value: peso(data.onlineTotal),                  sub: `${data.onlinePax} pax`,                color: "text-teal-700",   bg: "bg-teal-50 border-teal-200",          iconColor: "text-teal-600"   },
              { icon: TrendingUp, label: "Total Revenue",    value: peso(data.cashTotal + data.onlineTotal), sub: `${data.cashPax + data.onlinePax} pax`, color: "text-[#0c7b93]",  bg: "bg-[#0c7b93]/5 border-[#0c7b93]/20", iconColor: "text-[#0c7b93]"  },
              { icon: Users,      label: "Total Bookings",   value: String(data.totalBookings),              sub: `${data.cashPax + data.onlinePax} pax`, color: "text-[#134e4a]",  bg: "bg-gray-50 border-gray-200",          iconColor: "text-gray-500"   },
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

          {/* ── Per-staff accountability breakdown ── */}
          {data.staffSummary.length > 0 && (
            <div className="mx-4 mb-4 rounded-xl border-2 border-teal-100 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center gap-2">
                <User size={14} className="text-[#0c7b93]" />
                <span className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">
                  Staff Accountability — {label}
                </span>
              </div>
              <div className="divide-y divide-teal-50">
                {data.staffSummary.map((staff) => (
                  <div key={staff.issuer_id} className="px-4 py-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-black text-[#0c7b93] shrink-0">
                        {staff.issuer_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#134e4a]">{staff.issuer_name}</div>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${ROLE_BADGE[staff.issuer_role] ?? "bg-gray-100 text-gray-600"}`}>
                          {ROLE_LABELS[staff.issuer_role] ?? staff.issuer_role}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {staff.cashTotal > 0 && (
                        <div>
                          <div className="text-xs text-amber-700 font-semibold">Cash</div>
                          <div className="text-base font-black text-amber-700">{peso(staff.cashTotal)}</div>
                          <div className="text-xs text-gray-400">{staff.cashPax} pax</div>
                        </div>
                      )}
                      {staff.onlineTotal > 0 && (
                        <div>
                          <div className="text-xs text-teal-700 font-semibold">Online</div>
                          <div className="text-base font-black text-teal-700">{peso(staff.onlineTotal)}</div>
                          <div className="text-xs text-gray-400">{staff.onlinePax} pax</div>
                        </div>
                      )}
                      <div className="border-l border-teal-100 pl-4">
                        <div className="text-xs text-[#0f766e] font-semibold">Total</div>
                        <div className="text-base font-black text-[#0c7b93]">
                          {peso(staff.cashTotal + staff.onlineTotal)}
                        </div>
                        <div className="text-xs text-gray-400">{staff.bookingCount} booking{staff.bookingCount !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Staff total footer */}
              <div className="bg-teal-50/60 border-t-2 border-teal-200 px-4 py-2.5 flex justify-between text-xs font-bold text-[#134e4a]">
                <span>{data.staffSummary.length} staff member{data.staffSummary.length !== 1 ? "s" : ""}</span>
                <span className="text-[#0c7b93]">{peso(data.cashTotal + data.onlineTotal)} total</span>
              </div>
            </div>
          )}

          {/* ── Booking rows table ── */}
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
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#0f766e] uppercase tracking-wide">Issued By</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[#0f766e] uppercase tracking-wide">Pax</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold text-[#0f766e] uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {data.rows.map(r => (
                    <tr key={r.reference} className={`hover:bg-teal-50/20 transition-colors ${r.is_walk_in ? "bg-amber-50/20" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0c7b93]">{r.reference}</td>
                      <td className="px-4 py-3 font-medium text-[#134e4a]">{r.customer_full_name}</td>
                      <td className="px-4 py-3 text-xs text-[#0f766e] whitespace-nowrap">
                        {r.departure_date} {r.departure_time ? r.departure_time.slice(0, 5) : ""}
                      </td>
                      <td className="px-4 py-3">
                        {r.is_walk_in
                          ? <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">Cash</span>
                          : <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-xs font-semibold">Online</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#134e4a]">{r.issuer_name}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[r.issuer_role] ?? "bg-gray-100 text-gray-600"}`}>
                            {ROLE_LABELS[r.issuer_role] ?? r.issuer_role}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#134e4a]">{r.passenger_count}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={r.is_walk_in ? "text-amber-700" : "text-teal-700"}>
                          {peso(r.total_amount_cents)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 border-t-2 border-teal-200">
                    <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-[#134e4a]">{label} Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#134e4a]">{data.cashPax + data.onlinePax}</td>
                    <td className="px-4 py-2.5 text-right font-black text-[#0c7b93]">{peso(data.cashTotal + data.onlineTotal)}</td>
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
