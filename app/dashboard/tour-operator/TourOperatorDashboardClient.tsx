"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  reference: string;
  customer_name: string;
  total_pax: number;
  total_amount_cents: number;
  booking_type: string;
  is_walk_in: boolean;
  booking_source: string;
  status: string;
  schedule_date: string | null;
  departure_time: string | null;
  tour_title: string;
  guide_id: string | null;
  guide_name: string | null;
  tracking: { picked_up: number; on_tour: number; dropped_off: number; no_show: number; waiting: number } | null;
};

type RevenueBooking = {
  id: string;
  reference: string;
  total_amount_cents: number;
  booking_source: string;
  payment_verified_at: string | null;
  operator_payment_status: string;
  operator_payment_ref: string | null;
  operator_paid_at: string | null;
  customer_name: string;
  total_pax: number;
  tour_title: string;
  schedule_date: string | null;
  guide_id: string | null;
  guide_name: string | null;
  guide_payment_status: string;
  guide_payment_ref: string | null;
  guide_paid_at: string | null;
  batch_id: string | null;
};

type Guide = {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
};

interface Props {
  displayName: string;
  totalBookings: number;
  guidesCount: number;
  todayRevenue: number;
  pendingCount: number;
  bookings: Booking[];
  revenueBookings: RevenueBooking[];
  guides: Guide[];
  todayPH: string;
}

type Period = "today" | "week" | "month" | "custom";

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA");
}

function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

function getMonthEnd(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
}

function TrackingBadges({ t }: { t: Booking["tracking"] }) {
  if (!t) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {t.picked_up > 0   && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">✅ {t.picked_up}</span>}
      {t.on_tour > 0     && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">🚐 {t.on_tour}</span>}
      {t.dropped_off > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">📍 {t.dropped_off}</span>}
      {t.no_show > 0     && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">❌ {t.no_show}</span>}
      {(t.picked_up + t.on_tour + t.dropped_off + t.no_show === 0) && (
        <span className="text-xs text-gray-400">⏳ Waiting</span>
      )}
    </div>
  );
}

function CollapseSection({ title, count, children, defaultOpen = false, accent = "gray" }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentClass = accent === "amber" ? "border-amber-100" : accent === "emerald" ? "border-emerald-100" : "border-gray-100";
  return (
    <div className={`rounded-2xl border-2 ${accentClass} bg-white mb-5 overflow-hidden`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[#134e4a]">{title}</h2>
          {count !== undefined && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{count}</span>
          )}
        </div>
        <span className="text-gray-400 text-sm font-bold">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function MarkPaidButton({ id, type, loading, onMark }: {
  id: string; type: "guide"; loading: boolean; onMark: (ref: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [ref, setRef] = useState("");
  if (!showInput) {
    return (
      <button onClick={() => setShowInput(true)}
        className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-full font-bold transition-colors">
        Mark Paid
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input value={ref} onChange={e => setRef(e.target.value.toUpperCase())}
        placeholder="GCash ref #"
        className="w-28 rounded-lg border-2 border-amber-300 px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500"
        autoFocus />
      <button onClick={() => { if (ref.trim()) onMark(ref.trim()); }}
        disabled={loading || !ref.trim()}
        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
        {loading ? "..." : "Confirm"}
      </button>
      <button onClick={() => setShowInput(false)} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">✕</button>
    </div>
  );
}

export default function TourOperatorDashboardClient({
  displayName, totalBookings, guidesCount, todayRevenue,
  pendingCount, bookings, revenueBookings, guides, todayPH,
}: Props) {
  const [statusPeriod, setStatusPeriod] = useState<"day" | "week" | "month">("day");
  const [revPeriod, setRevPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState(getMonthStart(todayPH));
  const [customEnd, setCustomEnd] = useState(todayPH);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [guidePaidMap, setGuidePaidMap] = useState<Record<string, { ref: string; at: string }>>({});

  // ── Revenue period range ──────────────────────────────────────────────
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (revPeriod === "today") return {
      startDate: todayPH, endDate: todayPH,
      periodLabel: new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }),
    };
    if (revPeriod === "week") {
      const start = getWeekStart(todayPH);
      return {
        startDate: start, endDate: todayPH,
        periodLabel: new Date(start + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }) + " – " +
          new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      };
    }
    if (revPeriod === "month") {
      const start = getMonthStart(todayPH);
      const end = getMonthEnd(todayPH);
      return {
        startDate: start, endDate: end,
        periodLabel: new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
      };
    }
    return { startDate: customStart, endDate: customEnd, periodLabel: customStart + " to " + customEnd };
  }, [revPeriod, todayPH, customStart, customEnd]);

  // ── Filter revenue bookings by period ────────────────────────────────
  const periodBookings = useMemo(() =>
    revenueBookings.filter(b => {
      if (!b.payment_verified_at) return false;
      const d = b.payment_verified_at.slice(0, 10);
      return d >= startDate && d <= endDate;
    }), [revenueBookings, startDate, endDate]);

  // Revenue breakdown
  const onlineRev   = periodBookings.filter(b => b.booking_source === "online").reduce((s, b) => s + b.total_amount_cents, 0);
  const adminWalkin = periodBookings.filter(b => b.booking_source === "walk_in").reduce((s, b) => s + b.total_amount_cents, 0);
  const opWalkin    = periodBookings.filter(b => b.booking_source === "operator_walk_in").reduce((s, b) => s + b.total_amount_cents, 0);
  // What admin owes me = online + admin walk-ins assigned to me
  const adminOwesMe = onlineRev + adminWalkin;
  // What I owe guides = from batches for operator_walk_in + online/walk_in bookings I handled
  const guideOwed   = periodBookings.filter(b => b.guide_id).reduce((s, b) => s + b.total_amount_cents, 0);

  // ── What admin owes me (read-only) ────────────────────────────────────
  const adminOwedBookings = periodBookings.filter(b => b.booking_source !== "operator_walk_in");
  const adminPaidTotal    = adminOwedBookings.filter(b => b.operator_payment_status === "paid").reduce((s, b) => s + b.total_amount_cents, 0);
  const adminBalance      = adminOwedBookings.reduce((s, b) => s + b.total_amount_cents, 0) - adminPaidTotal;

  // ── What I owe guides (grouped by guide) ─────────────────────────────
  const guideAudit = useMemo(() => {
    const map: Record<string, {
      guide_name: string;
      bookings: RevenueBooking[];
      totalOwed: number;
      totalPaid: number;
      balance: number;
    }> = {};

    for (const b of periodBookings) {
      if (!b.guide_id || !b.guide_name) continue;
      if (!map[b.guide_id]) {
        map[b.guide_id] = { guide_name: b.guide_name, bookings: [], totalOwed: 0, totalPaid: 0, balance: 0 };
      }
      map[b.guide_id].bookings.push(b);
      map[b.guide_id].totalOwed += b.total_amount_cents;

      const isPaid = guidePaidMap[b.batch_id ?? b.id] || b.guide_payment_status === "paid";
      if (isPaid) map[b.guide_id].totalPaid += b.total_amount_cents;
    }

    for (const entry of Object.values(map)) {
      entry.balance = entry.totalOwed - entry.totalPaid;
    }

    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [periodBookings, guidePaidMap]);

  async function markGuidePaid(batchId: string, ref: string) {
    setMarkingId(batchId);
    try {
      const res = await fetch("/api/dashboard/tour-operator/mark-guide-paid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId, payment_ref: ref }),
      });
      if (res.ok) {
        setGuidePaidMap(prev => ({ ...prev, [batchId]: { ref, at: new Date().toISOString() } }));
      }
    } finally {
      setMarkingId(null);
    }
  }

  // ── Dashboard booking filters (unchanged) ────────────────────────────
  const upcomingBookings = useMemo(() =>
    bookings.filter(b => b.schedule_date && b.schedule_date >= todayPH)
      .sort((a, b) => (a.schedule_date ?? "").localeCompare(b.schedule_date ?? "")),
    [bookings, todayPH]);

  const statusBookings = useMemo(() => {
    let startStr: string;
    if (statusPeriod === "day") {
      startStr = todayPH;
    } else if (statusPeriod === "week") {
      const d = new Date(); d.setDate(d.getDate() - 7);
      startStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    } else {
      const d = new Date(); d.setDate(d.getDate() - 30);
      startStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    }
    return bookings.filter(b => b.schedule_date && b.schedule_date >= startStr && b.schedule_date <= todayPH)
      .sort((a, b) => (b.schedule_date ?? "").localeCompare(a.schedule_date ?? ""));
  }, [bookings, statusPeriod, todayPH]);

  function formatDateFull(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  function formatDateShort(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
  }
  function formatDateMed(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }

  const upcomingByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of upcomingBookings) {
      const d = b.schedule_date ?? "unknown";
      if (!map[d]) map[d] = [];
      map[d].push(b);
    }
    return map;
  }, [upcomingBookings]);

  const statusByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of statusBookings) {
      const d = b.schedule_date ?? "unknown";
      if (!map[d]) map[d] = [];
      map[d].push(b);
    }
    return map;
  }, [statusBookings]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg mb-6">
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3C/svg%3E")`, backgroundSize: "240px 120px", backgroundRepeat: "repeat" }} />
        <span className="pointer-events-none absolute -right-4 top-0 select-none text-[8rem] leading-none opacity-[0.07]">🌴</span>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Tour Operator Dashboard</p>
            <h1 className="mt-1 font-bold text-3xl leading-tight">Welcome, {displayName}! 👋</h1>
            <p className="mt-1 text-sm text-white/70">Manage your bookings, dispatch guides, and track revenue.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{totalBookings}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Bookings</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{guidesCount}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Guides</div>
            </div>
          </div>
        </div>
        <div className="relative mt-4 border-t border-white/15 pt-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-white/70">Today&apos;s Revenue</p>
          <p className="text-xl font-bold text-white">₱{(todayRevenue / 100).toLocaleString()}</p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-5">
        {[
          { href: "/dashboard/tour-operator/bookings", label: "📋 My Bookings",     color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50" },
          { href: "/dashboard/tour-operator/walk-in",  label: "✏️ Walk-in Booking", color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50" },
          { href: "/dashboard/account",                label: "👤 My Account",       color: "border-gray-200 hover:border-gray-400 hover:bg-gray-50" },
        ].map(({ href, label, color }) => (
          <Link key={href} href={href}
            className={`flex min-h-[48px] items-center justify-center rounded-xl border-2 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] text-center transition-colors ${color}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* PENDING ALERT */}
      {pendingCount > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-amber-800">{pendingCount} booking{pendingCount > 1 ? "s" : ""} awaiting payment verification</p>
            <p className="text-sm text-amber-700 mt-0.5">These bookings are pending admin confirmation.</p>
          </div>
          <Link href="/dashboard/tour-operator/bookings?status=pending"
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
            View
          </Link>
        </div>
      )}

      {/* ── REVENUE DASHBOARD ── */}
      <div className="rounded-2xl border-2 border-emerald-100 bg-white mb-5 overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-bold text-[#134e4a] text-lg">📊 Revenue Dashboard</h2>
            <div className="flex gap-2 flex-wrap">
              {(["today", "week", "month", "custom"] as Period[]).map((p) => (
                <button key={p} onClick={() => setRevPeriod(p)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors ${
                    revPeriod === p ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-200 bg-white text-gray-500 hover:border-emerald-300"
                  }`}>
                  {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {revPeriod === "custom" && (
            <div className="flex gap-3 mb-4 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">From</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">To</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-wide">{periodLabel}</p>

          {/* Revenue cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-emerald-900 text-sm">Online Bookings</p>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">GCash</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">₱{(onlineRev / 100).toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">Admin collected · Owes you</p>
            </div>
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-blue-900 text-sm">Admin Walk-ins</p>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Cash</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">₱{(adminWalkin / 100).toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">Admin collected · Owes you</p>
            </div>
            <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-purple-900 text-sm">Your Walk-ins</p>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Yours</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">₱{(opWalkin / 100).toLocaleString()}</p>
              <p className="text-xs text-purple-600 mt-1">You collected · Keep this</p>
            </div>
          </div>

          {/* Summary bar */}
          <div className="rounded-2xl bg-emerald-700 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">Admin Owes You</p>
              <p className="text-xs text-emerald-300 mt-0.5">Online + Admin Walk-ins · {periodLabel}</p>
            </div>
            <p className="text-2xl font-bold text-white">₱{(adminOwesMe / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── WHAT ADMIN OWES ME (read-only) ── */}
      <CollapseSection title="💳 Admin Owes Me" count={adminOwedBookings.length} defaultOpen={true} accent="emerald">
        <p className="text-xs text-gray-400 mb-4">
          Online bookings and admin walk-ins assigned to you. Admin marks these as paid after sending GCash.
        </p>

        {/* Summary */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[100px] rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Total Owed</p>
            <p className="font-bold text-[#134e4a]">₱{(adminOwedBookings.reduce((s, b) => s + b.total_amount_cents, 0) / 100).toLocaleString()}</p>
          </div>
          <div className="flex-1 min-w-[100px] rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Paid</p>
            <p className="font-bold text-emerald-700">₱{(adminPaidTotal / 100).toLocaleString()}</p>
          </div>
          <div className={`flex-1 min-w-[100px] rounded-xl border px-4 py-3 text-center ${adminBalance > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
            <p className="text-xs text-gray-400">Balance</p>
            <p className={`font-bold text-lg ${adminBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {adminBalance > 0 ? `₱${(adminBalance / 100).toLocaleString()}` : "✅ Settled"}
            </p>
          </div>
        </div>

        {adminOwedBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No bookings for this period.</p>
        ) : (
          <div className="space-y-2">
            {adminOwedBookings.map(b => {
              const isPaid = b.operator_payment_status === "paid";
              return (
                <div key={b.id} className="rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        b.booking_source === "walk_in" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                      }`}>
                        {b.booking_source === "walk_in" ? "Admin Walk-in" : "Online"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                      {b.schedule_date ? " · " + formatDateMed(b.schedule_date) : ""}
                    </p>
                    {isPaid && b.operator_payment_ref && (
                      <p className="text-xs text-emerald-600 mt-0.5 font-semibold">
                        GCash ref: {b.operator_payment_ref}
                        {b.operator_paid_at ? " · " + new Date(b.operator_paid_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</p>
                    {isPaid ? (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">✅ Paid</span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">⏳ Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapseSection>

      {/* ── WHAT I OWE MY GUIDES ── */}
      <CollapseSection title="💰 I Owe My Guides" count={guideAudit.length} defaultOpen={true} accent="amber">
        <p className="text-xs text-gray-400 mb-4">
          Service fees owed to guides for tours they handled this period. Mark paid after sending GCash.
        </p>

        {guideAudit.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No guide bookings for this period.</p>
        ) : (
          <div className="space-y-5">
            {guideAudit.map(({ guide_name, bookings: gBookings, totalOwed, totalPaid, balance }) => (
              <div key={guide_name} className="rounded-2xl border-2 border-gray-100 overflow-hidden">
                {/* Guide header */}
                <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${
                  balance > 0 ? "bg-amber-50 border-b-2 border-amber-100" : "bg-emerald-50 border-b-2 border-emerald-100"
                }`}>
                  <div>
                    <p className="font-bold text-[#134e4a]">{guide_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{gBookings.length} tour{gBookings.length > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Total Owed</p>
                      <p className="font-bold text-[#134e4a]">₱{(totalOwed / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Paid</p>
                      <p className="font-bold text-emerald-700">₱{(totalPaid / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className={`font-bold text-lg ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {balance > 0 ? `₱${(balance / 100).toLocaleString()}` : "✅ Settled"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bookings under this guide */}
                <div className="divide-y divide-gray-50">
                  {gBookings.map(b => {
                    const keyId = b.batch_id ?? b.id;
                    const isPaid = guidePaidMap[keyId] || b.guide_payment_status === "paid";
                    const paidInfo = guidePaidMap[keyId];
                    return (
                      <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              b.booking_source === "operator_walk_in" ? "bg-purple-100 text-purple-600" :
                              b.booking_source === "walk_in" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                            }`}>
                              {b.booking_source === "operator_walk_in" ? "Your Walk-in" :
                               b.booking_source === "walk_in" ? "Admin Walk-in" : "Online"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                            {b.schedule_date ? " · " + formatDateMed(b.schedule_date) : ""}
                          </p>
                          {isPaid && (b.guide_payment_ref || paidInfo?.ref) && (
                            <p className="text-xs text-emerald-600 mt-0.5 font-semibold">
                              GCash ref: {paidInfo?.ref ?? b.guide_payment_ref}
                              {(paidInfo?.at ?? b.guide_paid_at) ? " · " + new Date(paidInfo?.at ?? b.guide_paid_at!).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</p>
                          {isPaid ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">✅ Paid</span>
                          ) : (
                            <MarkPaidButton
                              id={keyId}
                              type="guide"
                              loading={markingId === keyId}
                              onMark={(ref) => markGuidePaid(keyId, ref)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapseSection>

      {/* UPCOMING BOOKINGS */}
      <CollapseSection title="Upcoming Bookings" count={upcomingBookings.length} defaultOpen={true}>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No upcoming bookings.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(upcomingByDate).map(([date, dayBookings]) => (
              <div key={date}>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                  {date === todayPH ? "🟢 Today — " : ""}{formatDateFull(date)}
                </p>
                <div className="space-y-2">
                  {dayBookings.map((b) => (
                    <Link key={b.id} href={`/dashboard/tour-operator/bookings/${b.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-[#134e4a]">{b.tour_title}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{b.booking_type}</span>
                          {b.is_walk_in && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Walk-in</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {b.customer_name}{b.total_pax > 1 ? ` & ${b.total_pax - 1} other${b.total_pax - 1 > 1 ? "s" : ""}` : ""}
                          {" · "}{b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                          {b.departure_time ? " · " + b.departure_time.slice(0, 5) : ""}
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5 font-medium">👤 {b.guide_name ?? "No guide assigned"}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-700 shrink-0">₱{(b.total_amount_cents / 100).toLocaleString()}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link href="/dashboard/tour-operator/bookings" className="text-xs text-emerald-600 hover:underline font-semibold">View all bookings →</Link>
        </div>
      </CollapseSection>

      {/* GUEST TOUR STATUS */}
      <CollapseSection title="Guest Tour Status" count={statusBookings.length} defaultOpen={true}>
        <div className="flex gap-2 mb-4">
          {(["day", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setStatusPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                statusPeriod === p ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-gray-200 bg-white text-gray-500 hover:border-emerald-300"
              }`}>
              {p === "day" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
        {statusBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No bookings for this period.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(statusByDate).map(([date, dayBookings]) => (
              <div key={date}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{formatDateShort(date)}</p>
                <div className="space-y-2">
                  {dayBookings.map((b) => (
                    <Link key={b.id} href={`/dashboard/tour-operator/bookings/${b.id}`}
                      className="block rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-sm text-[#134e4a]">{b.tour_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {b.customer_name}{b.total_pax > 1 ? ` & ${b.total_pax - 1} other${b.total_pax - 1 > 1 ? "s" : ""}` : ""}
                            {" · "}{b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-blue-600 mt-0.5 font-medium">👤 {b.guide_name ?? "No guide assigned"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">{b.booking_type}</span>
                          {b.is_walk_in && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Walk-in</span>}
                        </div>
                      </div>
                      <TrackingBadges t={b.tracking} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapseSection>

      {/* MY TOUR GUIDES */}
      <CollapseSection title="My Tour Guides" count={guides.length} defaultOpen={false}>
        {guides.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No guides assigned yet. Contact admin to add guides.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guides.map((g) => (
              <div key={g.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="font-semibold text-sm text-[#134e4a]">{g.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{g.email}</p>
                {g.mobile && <p className="text-xs text-gray-400">{g.mobile}</p>}
              </div>
            ))}
          </div>
        )}
      </CollapseSection>

    </div>
  );
}
