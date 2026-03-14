"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PeriodDashboardStats, VesselDayStats } from "@/lib/admin/dashboard-stats";

type Period = "today" | "week" | "month" | "year" | "custom";

interface Props {
  initialStats: PeriodDashboardStats;
  todayLabel: string;
  adminFeeLabel: string;
  gcashFeeLabel: string;
}

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

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
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
            active === key ? "border-[#0c7b93] bg-[#0c7b93] text-white" : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93]"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}: <strong>{count}</strong>
    </span>
  );
}

function BoardedCard({ vessels, totalBoarded, totalCheckedIn, totalConfirmed, href }: {
  vessels: VesselDayStats[];
  totalBoarded: number;
  totalCheckedIn: number;
  totalConfirmed: number;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const grandTotal = totalBoarded + totalCheckedIn + totalConfirmed;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2" type="button">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛳️</span>
          <span className="font-bold text-sm text-emerald-900">Passengers</span>
          {vessels.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">{vessels.length} vessels</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-emerald-700">{grandTotal}</span>
          <span className={`text-gray-400 text-xs font-bold transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      <div className="flex flex-wrap gap-1.5 mt-2 pl-7">
        <StatusPill label="Boarded" count={totalBoarded} color="bg-emerald-100 text-emerald-800" />
        <StatusPill label="Checked in" count={totalCheckedIn} color="bg-blue-100 text-blue-800" />
        <StatusPill label="Confirmed" count={totalConfirmed} color="bg-amber-100 text-amber-800" />
      </div>

      {open && vessels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-200">
          {vessels.map((v, i) => (
            <div key={i} className="py-2 border-b border-emerald-100 last:border-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-emerald-900">🚢 {v.boat_name}</span>
                <span className="font-bold text-sm text-emerald-700">{v.boarded + v.checked_in + v.confirmed} total</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-1">
                <StatusPill label="Boarded" count={v.boarded} color="bg-emerald-100 text-emerald-800" />
                <StatusPill label="Checked in" count={v.checked_in} color="bg-blue-100 text-blue-800" />
                <StatusPill label="Confirmed" count={v.confirmed} color="bg-amber-100 text-amber-800" />
              </div>
            </div>
          ))}
          <Link href={href} className="mt-3 w-full flex items-center justify-center rounded-xl py-2 text-xs font-semibold bg-emerald-100 text-emerald-800 hover:opacity-90">
            View manifest →
          </Link>
        </div>
      )}
    </div>
  );
}

function SnapshotCard({ title, icon, total, totalLabel, vessels, href, accent }: {
  title: string; icon: string; total: string | number; totalLabel?: string;
  vessels: { name: string; value: string | number; sub?: string }[];
  href?: string; accent: "teal" | "amber" | "blue" | "green" | "red";
}) {
  const [open, setOpen] = useState(false);
  const colors = {
    teal:  { bg: "bg-teal-50",    border: "border-teal-200",    title: "text-[#134e4a]",   val: "text-[#0c7b93]",   badge: "bg-teal-100 text-teal-800"      },
    amber: { bg: "bg-amber-50",   border: "border-amber-300",   title: "text-amber-900",   val: "text-amber-700",   badge: "bg-amber-100 text-amber-800"    },
    blue:  { bg: "bg-blue-50",    border: "border-blue-200",    title: "text-blue-900",    val: "text-blue-700",    badge: "bg-blue-100 text-blue-800"      },
    green: { bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-900", val: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
    red:   { bg: "bg-red-50",     border: "border-red-200",     title: "text-red-900",     val: "text-red-700",     badge: "bg-red-100 text-red-800"        },
  }[accent];

  return (
    <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-4`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2" type="button">
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
      {totalLabel && <p className={`text-xs mt-1 ${colors.title} opacity-70 pl-7`}>{totalLabel}</p>}
      {open && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-10">
          {vessels.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No data for this period.</p>}
          {vessels.map((v, i) => (
            <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-current border-opacity-10 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold text-sm ${colors.title}`}>🚢 {v.name}</span>
                <span className={`font-bold text-sm ${colors.val}`}>{v.value}</span>
              </div>
              {v.sub && <p className="text-xs text-gray-500 pl-1">{v.sub}</p>}
            </div>
          ))}
          {href && (
            <Link href={href} className={`mt-3 w-full flex items-center justify-center rounded-xl py-2 text-xs font-semibold ${colors.badge} hover:opacity-90`}>
              View details →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSnapshotClient({ initialStats, todayLabel, adminFeeLabel, gcashFeeLabel }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stats, setStats] = useState<PeriodDashboardStats>(initialStats);
  const [isPending, startTransition] = useTransition();

  async function fetchStats(p: Period, cs?: string, ce?: string) {
    const params = new URLSearchParams({ period: p });
    if (p === "custom" && cs && ce) { params.set("start", cs); params.set("end", ce); }
    const res = await fetch(`/api/admin/dashboard-stats?${params}`);
    if (res.ok) setStats(await res.json());
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (p !== "custom") startTransition(() => { fetchStats(p); });
  }

  const s = stats;
  const totalCheckedIn = s.vessels.reduce((acc, v) => acc + v.checked_in, 0);

  const periodLabel = period === "today" ? todayLabel
    : period === "week" ? "This week"
    : period === "month" ? "This month"
    : period === "year" ? "This year"
    : customStart && customEnd ? `${customStart} to ${customEnd}` : "Custom range";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#134e4a]">📊 Snapshot</h2>
          <p className="text-xs text-[#0f766e]/70">{periodLabel} · {s.vessels_active} vessels active · {s.trips_today} trips today</p>
        </div>
        <PeriodToggle active={period} onChange={handlePeriodChange} />
      </div>

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
            <button
              onClick={() => { if (customStart && customEnd) startTransition(() => fetchStats("custom", customStart, customEnd)); }}
              disabled={!customStart || !customEnd || isPending}
              className="px-4 py-2 rounded-lg bg-[#0c7b93] text-white text-sm font-semibold disabled:opacity-50">
              {isPending ? "Loading..." : "Search"}
            </button>
          </div>
        </div>
      )}

      {isPending && <div className="text-center py-6 text-sm text-[#0f766e]">Loading...</div>}

      {!isPending && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Total Revenue */}
          <SnapshotCard
            title="Total Revenue" icon="💰"
            total={peso(s.total_revenue_cents)}
            totalLabel={`Fare: ${peso(s.total_fare_cents)} · ${adminFeeLabel}: ${peso(s.total_platform_fee_cents)} · ${gcashFeeLabel}: ${peso(s.total_processing_fee_cents)}`}
            vessels={s.vessels.map(v => ({
              name: v.boat_name,
              value: peso(v.total_revenue_cents),
              sub: `Fare: ${peso(v.fare_cents)} · ${adminFeeLabel}: ${peso(v.platform_fee_cents)} · ${gcashFeeLabel}: ${peso(v.processing_fee_cents)}`,
            }))}
            accent="teal"
          />

          {/* Passengers */}
          <BoardedCard
            vessels={s.vessels}
            totalBoarded={s.total_boarded}
            totalCheckedIn={totalCheckedIn}
            totalConfirmed={s.total_confirmed}
            href="/admin/bookings"
          />

          {/* Pending Payments */}
          <SnapshotCard
            title="Pending Payments" icon="⏳"
            total={s.total_pending}
            totalLabel={s.total_pending > 0 ? "Needs verification" : "All clear ✓"}
            vessels={s.vessels.map(v => ({ name: v.boat_name, value: `${v.pending_count} pending` }))}
            href="/admin/pending-payments"
            accent={s.total_pending > 0 ? "amber" : "teal"}
          />

          {/* Online Bookings */}
          <SnapshotCard
            title="Online Bookings" icon="📱"
            total={s.total_online}
            totalLabel={`${peso(s.total_processing_fee_cents)} ${gcashFeeLabel} collected`}
            vessels={s.vessels.map(v => ({
              name: v.boat_name,
              value: `${v.online_count} bookings`,
              sub: `Fare: ${peso(v.fare_cents)} · ${adminFeeLabel}: ${peso(v.platform_fee_cents)} · ${gcashFeeLabel}: ${peso(v.processing_fee_cents)}`,
            }))}
            href="/admin/bookings"
            accent="blue"
          />

          {/* Walk-in Bookings */}
          <SnapshotCard
            title="Walk-in Bookings" icon="🎫"
            total={s.total_walkin}
            totalLabel={`${peso(s.total_platform_fee_cents)} ${adminFeeLabel} collected`}
            vessels={s.vessels.map(v => ({
              name: v.boat_name,
              value: `${v.walkin_count} bookings`,
              sub: `Fare: ${peso(v.fare_cents)} · ${adminFeeLabel}: ${peso(v.platform_fee_cents)}`,
            }))}
            href="/admin/bookings"
            accent="teal"
          />

          {/* Refund Requests */}
          <SnapshotCard
            title="Refund Requests" icon="💸"
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
