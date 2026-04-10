"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp, Wallet, Smartphone, Users, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PassengerItem {
  name:       string;
  fare_type:  string;
  ticket_num: string;
  amount:     number;
  address:    string | null;
}

interface StaffRow {
  key:          string;
  issuer_name:  string;
  issuer_role:  string;
  payment_type: "cash" | "online";
  pax:          number;
  total:        number;
  passengers:   PassengerItem[];
}

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

interface RefundedRow {
  reference:          string;
  customer_full_name: string;
  total_amount_cents: number;
  passenger_count:    number;
  is_walk_in:         boolean;
  departure_date:     string;
  departure_time:     string;
  issuer_name:        string;
  issuer_role:        string;
}

interface SummaryTotals {
  cashTotal:        number;
  onlineTotal:      number;
  cashPax:          number;
  onlinePax:        number;
  totalBookings:    number;
  rows:             RevenueSummaryRow[];
  staffRows:        StaffRow[];
  // Refund accountability
  refundedRows:     RefundedRow[];
  refundCashTotal:  number;
  refundOnlineTotal: number;
  refundCashPax:    number;
  refundOnlinePax:  number;
  refundCount:      number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

const ROLE_BADGE: Record<string, string> = {
  ticket_booth: "bg-pink-100 text-pink-800",
  captain:      "bg-sky-100 text-sky-800",
  deck_crew:    "bg-orange-100 text-orange-800",
  admin:        "bg-purple-100 text-purple-800",
};
const ROLE_LABEL: Record<string, string> = {
  ticket_booth: "Ticket Booth",
  captain:      "Captain",
  deck_crew:    "Crew",
  admin:        "Admin",
};

type ViewMode = "day" | "week" | "month";

interface Props { boatId: string; vesselName: string; }

function getDateRange(mode: ViewMode, dayOffset: number, weekOffset: number, monthOffset: number) {
  const now = new Date();
  if (mode === "day") {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const str   = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const label = dayOffset === 0 ? "Today"
      : dayOffset === -1 ? "Yesterday"
      : d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
    return { start: str, end: str, label };
  }
  if (mode === "week") {
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const today    = new Date(todayStr + "T00:00:00");
    const day      = today.getDay();
    const monday   = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
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
  return { start, end, label: base.toLocaleDateString("en-PH", { month: "long", year: "numeric" }) };
}

// ── Expandable Staff Row ──────────────────────────────────────────────────────
function StaffAccountabilityRow({ row }: { row: StaffRow }) {
  const [open, setOpen] = useState(false);
  const isCash    = row.payment_type === "cash";
  const rowBg     = isCash ? "bg-amber-50/40" : "bg-teal-50/40";
  const typeBadge = isCash
    ? <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold">💵 Cash</span>
    : <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-xs font-bold">📱 Online</span>;
  const noteText = isCash
    ? "Collected in person — staff owes this to vessel owner"
    : "Paid via GCash to admin — admin remits to vessel owner";

  return (
    <div className={`border-b border-teal-100 last:border-b-0 ${rowBg}`}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 gap-3 flex-wrap hover:brightness-95 transition-all text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-white border border-teal-200 flex items-center justify-center text-xs font-black text-[#0c7b93] shrink-0 shadow-sm">
            {row.issuer_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <span className="text-sm font-bold text-[#134e4a]">{row.issuer_name}</span>
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[row.issuer_role] ?? "bg-gray-100 text-gray-600"}`}>
              {ROLE_LABEL[row.issuer_role] ?? row.issuer_role}
            </span>
          </div>
          {typeBadge}
          <span className="text-xs text-gray-400">{row.pax} pax</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-base font-black ${isCash ? "text-amber-700" : "text-teal-700"}`}>{peso(row.total)}</div>
            <div className="text-xs text-gray-400">{noteText}</div>
          </div>
          <div className={`rounded-full p-1 ${open ? "bg-teal-100" : "bg-white border border-teal-200"}`}>
            {open ? <ChevronUp size={14} className="text-[#0c7b93]" /> : <ChevronDown size={14} className="text-[#0c7b93]" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-teal-100 bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-teal-50/60">
                <th className="px-4 py-2 text-left font-semibold text-[#0f766e]">#</th>
                <th className="px-4 py-2 text-left font-semibold text-[#0f766e]">Passenger Name</th>
                <th className="px-4 py-2 text-left font-semibold text-[#0f766e]">Fare Type</th>
                <th className="px-4 py-2 text-left font-semibold text-[#0f766e]">Ticket #</th>
                <th className="px-4 py-2 text-left font-semibold text-[#0f766e] hidden sm:table-cell">Address</th>
                <th className="px-4 py-2 text-right font-semibold text-[#0f766e]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50">
              {row.passengers.map((p, i) => (
                <tr key={`${p.ticket_num}-${i}`} className="hover:bg-teal-50/20 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#134e4a]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-[#0c7b93] shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-teal-50 border border-teal-200 text-[#0c7b93] px-2 py-0.5 text-xs font-semibold">{p.fare_type}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0c7b93]">{p.ticket_num}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell max-w-[160px] truncate">{p.address ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    <span className={isCash ? "text-amber-700" : "text-teal-700"}>{peso(p.amount)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${isCash ? "bg-amber-50/60 border-amber-200" : "bg-teal-50/60 border-teal-200"}`}>
                <td colSpan={4} className="px-4 py-2 text-xs font-bold text-[#134e4a]">
                  {row.issuer_name} · {ROLE_LABEL[row.issuer_role] ?? row.issuer_role} · {row.pax} pax
                </td>
                <td className="hidden sm:table-cell" />
                <td className={`px-4 py-2 text-right font-black text-sm ${isCash ? "text-amber-700" : "text-teal-700"}`}>{peso(row.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function TicketBoothRevenueSummary({ boatId, vesselName }: Props) {
  const [mounted,     setMounted]     = useState(false);
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
      else {
  const err = await res.json().catch(() => ({}));
  console.error("ticket-booth-summary error:", res.status, err);
  setData(null);
}
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
  const canGoForward = mode === "day" ? dayOffset < 0 : mode === "week" ? weekOffset < 0 : monthOffset < 0;

  function goBack()    {
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
  function resetToNow() { setDayOffset(0); setWeekOffset(0); setMonthOffset(0); }
  const isAtCurrent = mode === "day" ? dayOffset === 0 : mode === "week" ? weekOffset === 0 : monthOffset === 0;

  const refundCount   = data?.refundCount ?? 0;
  const netCash       = (data?.cashTotal ?? 0) - (data?.refundCashTotal ?? 0);
  const netOnline     = (data?.onlineTotal ?? 0) - (data?.refundOnlineTotal ?? 0);

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
            <button key={m} type="button" onClick={() => { setMode(m); resetToNow(); }}
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
            <button type="button" onClick={resetToNow} className="text-xs text-[#0c7b93] hover:underline mt-0.5">
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
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            {[
              { icon: Wallet,     label: "Cash (Walk-in)",   value: peso(data.cashTotal),                    sub: `${data.cashPax} pax`,                  color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",        iconColor: "text-amber-600" },
              { icon: Smartphone, label: "Online (Payment)", value: peso(data.onlineTotal),                  sub: `${data.onlinePax} pax`,                color: "text-teal-700",   bg: "bg-teal-50 border-teal-200",          iconColor: "text-teal-600"  },
              { icon: TrendingUp, label: "Total Revenue",    value: peso(data.cashTotal + data.onlineTotal), sub: `${data.cashPax + data.onlinePax} pax`, color: "text-[#0c7b93]",  bg: "bg-[#0c7b93]/5 border-[#0c7b93]/20", iconColor: "text-[#0c7b93]" },
              { icon: Users,      label: "Total Bookings",   value: String(data.totalBookings),              sub: `${data.cashPax + data.onlinePax} pax`, color: "text-[#134e4a]",  bg: "bg-gray-50 border-gray-200",          iconColor: "text-gray-500"  },
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

          {/* ── Refund accountability section ── */}
          {refundCount > 0 && (
            <div className="mx-4 mb-4 rounded-xl border-2 border-red-200 bg-red-50/50 overflow-hidden">
              <div className="bg-red-50 px-4 py-2.5 border-b border-red-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-red-600" />
                  <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
                    Refunds — {refundCount} booking{refundCount !== 1 ? "s" : ""} deducted
                  </span>
                </div>
                <div className="flex gap-3 text-xs font-semibold">
                  {data.refundCashTotal > 0 && (
                    <span className="text-amber-700">Cash refunded: −{peso(data.refundCashTotal)} ({data.refundCashPax} pax)</span>
                  )}
                  {data.refundOnlineTotal > 0 && (
                    <span className="text-teal-700">Online refunded: −{peso(data.refundOnlineTotal)} ({data.refundOnlinePax} pax)</span>
                  )}
                </div>
              </div>

              {/* Note explaining accountability */}
              <div className="px-4 py-2 border-b border-red-100 text-xs text-red-700 bg-white">
                <strong>💵 Cash refunds</strong> — money the booth collected then returned. Deducted from cash handover to vessel owner.
                {data.refundOnlineTotal > 0 && (
                  <> &nbsp;·&nbsp; <strong>📱 Online refunds</strong> — GCash returned by admin. Not booth cash responsibility.</>
                )}
              </div>

              {/* Refunded booking rows */}
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-red-50/60">
                    <th className="px-4 py-2 text-left font-semibold text-red-700">Reference</th>
                    <th className="px-4 py-2 text-left font-semibold text-red-700">Passenger</th>
                    <th className="px-4 py-2 text-left font-semibold text-red-700">Trip</th>
                    <th className="px-4 py-2 text-left font-semibold text-red-700">Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-red-700">Issued By</th>
                    <th className="px-4 py-2 text-right font-semibold text-red-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 bg-white">
                  {data.refundedRows.map(r => (
                    <tr key={r.reference} className="hover:bg-red-50/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-red-700">{r.reference}</td>
                      <td className="px-4 py-2.5 font-medium text-[#134e4a]">{r.customer_full_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.departure_date} {r.departure_time?.slice(0, 5)}</td>
                      <td className="px-4 py-2.5">
                        {r.is_walk_in
                          ? <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">💵 Cash</span>
                          : <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-xs font-semibold">📱 Online</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-[#134e4a]">{r.issuer_name}</span>
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[r.issuer_role] ?? "bg-gray-100 text-gray-600"}`}>
                          {ROLE_LABEL[r.issuer_role] ?? r.issuer_role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-600">−{peso(r.total_amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50 border-t-2 border-red-200">
                    <td colSpan={4} className="px-4 py-2 text-xs font-bold text-red-800">Net after refunds</td>
                    <td />
                    <td className="px-4 py-2 text-right text-xs font-black text-red-800">
                      Cash: {peso(netCash)} · Online: {peso(netOnline)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Staff Accountability ── */}
          {data.staffRows && data.staffRows.length > 0 && (
            <div className="mx-4 mb-4 rounded-xl border-2 border-teal-100 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center justify-between">
                <span className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">
                  Staff Accountability — {label}
                </span>
                <span className="text-xs text-gray-400">Click a row to see passenger details</span>
              </div>
              <div className="px-4 py-2 bg-white border-b border-teal-50 flex flex-wrap gap-3 text-xs text-gray-500">
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />💵 Cash = staff collected, must hand to vessel owner</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-teal-400 mr-1" />📱 Online = admin collected via GCash, admin remits to owner</span>
              </div>
              {data.staffRows.map(row => (
                <StaffAccountabilityRow key={row.key} row={row} />
              ))}
              <div className="bg-teal-50/60 border-t-2 border-teal-200 px-4 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold">
                <div>
                  <span className="text-amber-700">Cash to hand over: {peso(data.cashTotal)}</span>
                  <span className="text-gray-400 font-normal ml-1">({data.cashPax} pax)</span>
                </div>
                <div>
                  <span className="text-teal-700">Online via admin: {peso(data.onlineTotal)}</span>
                  <span className="text-gray-400 font-normal ml-1">({data.onlinePax} pax)</span>
                </div>
                <div className="text-[#0c7b93] sm:text-right">
                  Total: {peso(data.cashTotal + data.onlineTotal)}
                </div>
              </div>
            </div>
          )}

          {/* ── Booking rows table ── */}
          {data.rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#0f766e]/50">No bookings for this period.</div>
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
                            {ROLE_LABEL[r.issuer_role] ?? r.issuer_role}
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
