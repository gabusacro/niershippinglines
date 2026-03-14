"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PeriodDashboardStats, VesselDayStats } from "@/lib/admin/dashboard-stats";

// ── Types ────────────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "year" | "custom";

interface Props {
  initialStats: PeriodDashboardStats;
  todayLabel: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

// ── Vessel row inside a card ─────────────────────────────────────────────────
function VesselFeeRow({ v, showFees = false }: { v: VesselDayStats; showFees?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-teal-100 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-[#134e4a]">🚢 {v.boat_name}</span>
        <span className="font-bold text-sm text-[#0c7b93]">{peso(v.total_revenue_cents)}</span>
      </div>
      {showFees && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#0f766e]/80 pl-1">
          <span>Fare: <strong>{peso(v.fare_cents)}</strong></span>
          <span>Platform fee: <strong>{peso(v.platform_fee_cents)}</strong></span>
          <span>GCash fee: <strong>{peso(v.processing_fee_cents)}</strong></span>
        </div>
      )}
    </div>
  );
}

// ── Expandable snapshot card ─────────────────────────────────────────────────
function SnapshotCard({
  title, icon, total, totalLabel, vessels, href, accent, showFees, extraRow,
}: {
  title: string;
  icon: string;
  total: string | number;
  totalLabel?: string;
  vessels: { name: string; value: string | number; sub?: string }[];
  href?: string;
  accent: "teal" | "amber" | "blue" | "green" | "red";
  showFees?: boolean;
  extraRow?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const colors = {
    teal:  { bg: "bg-teal-50",  border: "border-teal-200",  title: "text-[#134e4a]", val: "text-[#0c7b93]",   badge: "bg-teal-100 text-teal-800"  },
    amber: { bg: "bg-amber-50", border: "border-amber-300", title: "text-amber-900", val: "text-amber-700",   badge: "bg-amber-100 text-amber-800" },
    blue:  { bg: "bg-blue-50",  border: "border-blue-200",  title: "text-blue-900",  val: "text-blue-700",    badge: "bg-blue-100 text-blue-800"   },
    green: { bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-900", val: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
    red:   { bg: "bg-red-50",   border: "border-red-200",   title: "text-red-900",   val: "text-red-700",     badge: "bg-red-100 text-red-800"     },
  }[accent];

  const content = (
    <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-4 transition-all`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2"
        type="button"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className={`font-bold text-sm ${colors.title}`}>{title}</span>
          {vessels.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>{vessels.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${colors.val}`}>{total}</span>
          <span className={`text-gray-400 text-xs font-bold transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {totalLabel && <p className={`text-xs mt-0.5 ${colors.title} opacity-70 text-left pl-7`}>{totalLabel}</p>}

      {open && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-10">
          {vessels.map((v, i) => (
            <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-current border-opacity-10 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold text-sm ${colors.title}`}>🚢 {v.name}</span>
                <span className={`font-bold text-sm ${colors.val}`}>{v.value}</span>
              </div>
              {v.sub && <p className="text-xs text-gray-500 pl-1">{v.sub}</p>}
            </div>
          ))}
          {extraRow}
          {href && (
            <Link
              href={href}
              className={`mt-3 w-full flex items-center justify-center rounded-xl py-2 text-xs font-semibold ${colors.badge} hover:opacity-90 transition-opacity`}
            >
              View details →
            </Link>
          )}
        </div>
      )}
    </div>
  );

  return content;
}

// ── Period toggle ────────────────────────────────────────────────────────────
function PeriodToggle({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "custom", label: "Custom" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {periods.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
            active === key
              ? "border-[#0c7b93] bg-[#0c7b93] text-white"
              : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AdminSnapshotClient({ initialStats, todayLabel }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stats, setStats] = useState<PeriodDashboardStats>(initialStats);
  const [isPending, startTransition] = useTransition();

  async function fetchStats(p: Period, cs?: string, ce?: string) {
    const params = new URLSearchParams({ period: p });
    if (p === "custom" && cs && ce) {
      params.set("start", cs);
      params.set("end", ce);
    }
    const res = await fetch(`/api/admin/dashboard-stats?${params}`);
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (p !== "custom") {
      startTransition(() => { fetchStats(p); });
    }
  }

  function handleCustomSearch() {
    if (customStart && customEnd) {
      startTransition(() => { fetchStats("custom", customStart, customEnd); });
    }
  }

  const s = stats;

  const revenueVessels = s.vessels.map(v => ({
    name: v.boat_name,
    value: peso(v.total_revenue_cents),
    sub: `Fare: ${peso(v.fare_cents)} · Platform: ${peso(v.platform_fee_cents)} · GCash: ${peso(v.processing_fee_cents)}`,
  }));

  const boardedVessels = s.vessels.map(v => ({
    name: v.boat_name,
    value: `${v.boarded} boarded`,
    sub: v.confirmed > 0 ? `+${v.confirmed} confirmed` : undefined,
  }));

  const onlineVessels = s.vessels.map(v => ({
    name: v.boat_name,
    value: `${v.online_count} bookings`,
    sub: `${peso(v.fare_cents)} fare · ${peso(v.platform_fee_cents)} platform · ${peso(v.processing_fee_cents)} GCash`,
  }));

  const walkinVessels = s.vessels.map(v => ({
    name: v.boat_name,
    value: `${v.walkin_count} bookings`,
    sub: `${peso(v.fare_cents)} fare · ${peso(v.platform_fee_cents)} platform fee`,
  }));

  const pendingVessels = s.vessels.map(v => ({
    name: v.boat_name,
    value: `${v.pending_count} pending`,
  }));

  const periodLabel = period === "today" ? todayLabel
    : period === "week" ? "This week"
    : period === "month" ? "This month"
    : period === "year" ? "This year"
    : customStart && customEnd ? `${customStart} to ${customEnd}`
    : "Custom range";

  return (
    <div className="mt-8">
      {/* Header + period toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#134e4a]">📊 Snapshot</h2>
          <p className="text-xs text-[#0f766e]/70">{periodLabel} · {s.vessels_active} vessels active · {s.trips_today} trips today</p>
        </div>
        <PeriodToggle active={period} onChange={handlePeriodChange} />
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-teal-50 rounded-xl border border-teal-200">
          <div>
            <label className="text-xs font-semibold text-[#134e4a] block mb-1">From</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="rounded-lg border border-teal-200 px-3 py-2 text-sm focus:outline-none focus:border-[#0c7b93]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#134e4a] block mb-1">To</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="rounded-lg border border-teal-200 px-3 py-2 text-sm focus:outline-none focus:border-[#0c7b93]" />
          </div>
          <div className="flex items-end">
            <button onClick={handleCustomSearch}
              disabled={!customStart || !customEnd || isPending}
              className="px-4 py-2 rounded-lg bg-[#0c7b93] text-white text-sm font-semibold disabled:opacity-50">
              {isPending ? "Loading..." : "Search"}
            </button>
          </div>
        </div>
      )}

      {isPending && (
        <div className="text-center py-4 text-sm text-[#0f766e]">Loading...</div>
      )}

      {/* Cards grid */}
      {!isPending && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Total Revenue */}
          <SnapshotCard
            title="Total Revenue"
            icon="💰"
            total={peso(s.total_revenue_cents)}
            totalLabel={`Fare: ${peso(s.total_fare_cents)} · Platform: ${peso(s.total_platform_fee_cents)} · GCash: ${peso(s.total_processing_fee_cents)}`}
            vessels={revenueVessels}
            accent="teal"
            showFees
          />

          {/* Boarded */}
          <SnapshotCard
            title="Boarded"
            icon="🛳️"
            total={s.total_boarded}
            totalLabel={s.total_confirmed > 0 ? `+${s.total_confirmed} confirmed, not yet boarded` : undefined}
            vessels={boardedVessels}
            href="/admin/bookings"
            accent="green"
          />

          {/* Pending Payments */}
          <SnapshotCard
            title="Pending Payments"
            icon="⏳"
            total={s.total_pending}
            totalLabel={s.total_pending > 0 ? "Needs verification" : "All clear ✓"}
            vessels={pendingVessels}
            href="/admin/pending-payments"
            accent={s.total_pending > 0 ? "amber" : "teal"}
          />

          {/* Online Bookings */}
          <SnapshotCard
            title="Online Bookings"
            icon="📱"
            total={s.total_online}
            totalLabel={`${peso(s.total_processing_fee_cents)} GCash fees collected`}
            vessels={onlineVessels}
            href="/admin/bookings"
            accent="blue"
            showFees
          />

          {/* Walk-in Bookings */}
          <SnapshotCard
            title="Walk-in Bookings"
            icon="🎫"
            total={s.total_walkin}
            totalLabel={`${peso(s.total_platform_fee_cents)} platform fees collected`}
            vessels={walkinVessels}
            href="/admin/bookings"
            accent="teal"
          />

          {/* Refund Requests */}
          <SnapshotCard
            title="Refund Requests"
            icon="💸"
            total={s.total_refund_requests}
            totalLabel={s.total_refund_requests > 0 ? "Action needed" : "None pending ✓"}
            vessels={[]}
            href="/admin/refunds"
            accent={s.total_refund_requests > 0 ? "red" : "teal"}
          />
        </div>
      )}
    </div>
  );
}
