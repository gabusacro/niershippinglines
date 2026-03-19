"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FeeBreakdownCards } from "@/components/admin/FeeBreakdownCards";
import {
  TrendingUp, Users, Clock, Smartphone, Ticket,
  RotateCcw, Ship, ChevronDown, LayoutDashboard,
} from "lucide-react";
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

// ── Week navigation helpers ───────────────────────────────────────────────────
function getWeekRange(offsetWeeks: number): { start: string; end: string; label: string } {
  const now = new Date();
  const day = now.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const labelFmt = (d: Date) =>
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const label = offsetWeeks === 0
    ? "This Week"
    : offsetWeeks === -1
    ? "Last Week"
    : `${labelFmt(monday)} – ${labelFmt(sunday)}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

function PeriodToggle({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  const periods: { key: Period; label: string }[] = [
    { key: "today",  label: "Today"      },
    { key: "week",   label: "This Week"  },
    { key: "month",  label: "This Month" },
    { key: "year",   label: "This Year"  },
    { key: "custom", label: "Custom"     },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {periods.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
            active === key
              ? "border-[#0c7b93] bg-[#0c7b93] text-white"
              : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93]"
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

// ── Passengers card ───────────────────────────────────────────────────────────
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
    <div className="rounded-2xl border-2 border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Card header accent */}
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
      <div className="p-4">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2" type="button">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Users size={18} className="text-emerald-700" />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm text-[#134e4a]">Passengers</div>
              {vessels.length > 0 && (
                <div className="text-xs text-[#0f766e]/70">{vessels.length} vessel{vessels.length !== 1 ? "s" : ""}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-emerald-700">{grandTotal}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        <div className="flex flex-wrap gap-1.5 mt-3 pl-12">
          <StatusPill label="Boarded"    count={totalBoarded}    color="bg-emerald-100 text-emerald-800" />
          <StatusPill label="Checked in" count={totalCheckedIn}  color="bg-blue-100 text-blue-800"      />
          <StatusPill label="Confirmed"  count={totalConfirmed}  color="bg-amber-100 text-amber-800"    />
        </div>

        {open && vessels.length > 0 && (
          <div className="mt-3 pt-3 border-t border-emerald-100">
            {vessels.map((v, i) => (
              <div key={i} className="py-2 border-b border-emerald-50 last:border-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Ship size={13} className="text-emerald-600" />
                    <span className="font-semibold text-sm text-[#134e4a]">{v.boat_name}</span>
                  </div>
                  <span className="font-bold text-sm text-emerald-700">{v.boarded + v.checked_in + v.confirmed}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  <StatusPill label="Boarded"    count={v.boarded}    color="bg-emerald-100 text-emerald-800" />
                  <StatusPill label="Checked in" count={v.checked_in} color="bg-blue-100 text-blue-800"      />
                  <StatusPill label="Confirmed"  count={v.confirmed}  color="bg-amber-100 text-amber-800"    />
                </div>
              </div>
            ))}
            <Link href={href} className="mt-3 w-full flex items-center justify-center rounded-xl py-2 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors">
              View manifest →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Generic snapshot card ─────────────────────────────────────────────────────
type AccentKey = "teal" | "amber" | "blue" | "purple" | "red";

const ACCENT: Record<AccentKey, {
  border: string; bar: string; iconBg: string; iconColor: string;
  title: string; val: string; badge: string; divider: string;
}> = {
  teal:   { border: "border-teal-200",   bar: "from-teal-400 to-cyan-400",      iconBg: "bg-teal-100",   iconColor: "text-teal-700",   title: "text-[#134e4a]",   val: "text-[#0c7b93]",   badge: "bg-teal-100 text-teal-800",     divider: "border-teal-100"   },
  amber:  { border: "border-amber-300",  bar: "from-amber-400 to-orange-400",   iconBg: "bg-amber-100",  iconColor: "text-amber-700",  title: "text-amber-900",   val: "text-amber-700",   badge: "bg-amber-100 text-amber-800",   divider: "border-amber-100"  },
  blue:   { border: "border-blue-200",   bar: "from-blue-400 to-indigo-400",    iconBg: "bg-blue-100",   iconColor: "text-blue-700",   title: "text-blue-900",    val: "text-blue-700",    badge: "bg-blue-100 text-blue-800",     divider: "border-blue-100"   },
  purple: { border: "border-purple-200", bar: "from-purple-400 to-pink-400",    iconBg: "bg-purple-100", iconColor: "text-purple-700", title: "text-purple-900",  val: "text-purple-700",  badge: "bg-purple-100 text-purple-800", divider: "border-purple-100" },
  red:    { border: "border-red-200",    bar: "from-red-400 to-rose-400",       iconBg: "bg-red-100",    iconColor: "text-red-700",    title: "text-red-900",     val: "text-red-700",     badge: "bg-red-100 text-red-800",       divider: "border-red-100"    },
};

function SnapshotCard({ title, icon: Icon, total, totalLabel, vessels, href, accent }: {
  title: string;
  icon: React.ElementType;
  total: string | number;
  totalLabel?: string;
  vessels: { name: string; value: string | number; sub?: string }[];
  href?: string;
  accent: AccentKey;
}) {
  const [open, setOpen] = useState(false);
  const c = ACCENT[accent];

  return (
    <div className={`rounded-2xl border-2 ${c.border} bg-white shadow-sm overflow-hidden`}>
      <div className={`h-1 bg-gradient-to-r ${c.bar}`} />
      <div className="p-4">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2" type="button">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={c.iconColor} />
            </div>
            <div className="text-left">
              <div className={`font-bold text-sm ${c.title}`}>{title}</div>
              {vessels.length > 0 && (
                <div className="text-xs text-[#0f766e]/60">{vessels.length} vessel{vessels.length !== 1 ? "s" : ""}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black ${c.val}`}>{total}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        {totalLabel && (
          <p className={`text-xs mt-2 pl-12 ${c.title} opacity-60`}>{totalLabel}</p>
        )}

        {open && (
          <div className={`mt-3 pt-3 border-t ${c.divider}`}>
            {vessels.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No data for this period.</p>
            )}
            {vessels.map((v, i) => (
              <div key={i} className={`flex flex-col gap-0.5 py-2 border-b ${c.divider} last:border-0`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Ship size={13} className={c.iconColor} />
                    <span className={`font-semibold text-sm ${c.title}`}>{v.name}</span>
                  </div>
                  <span className={`font-bold text-sm ${c.val}`}>{v.value}</span>
                </div>
                {v.sub && <p className="text-xs text-gray-400 pl-5">{v.sub}</p>}
              </div>
            ))}
            {href && (
              <Link href={href} className={`mt-3 w-full flex items-center justify-center rounded-xl py-2 text-xs font-semibold ${c.badge} hover:opacity-90 transition-opacity`}>
                View details →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminSnapshotClient({ initialStats, todayLabel, adminFeeLabel, gcashFeeLabel }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stats, setStats] = useState<PeriodDashboardStats>(initialStats);
  const [isPending, startTransition] = useTransition();

  async function fetchStats(p: Period, cs?: string, ce?: string) {
    const params = new URLSearchParams({ period: p });
    if (cs && ce) { params.set("start", cs); params.set("end", ce); }
    const res = await fetch(`/api/admin/dashboard-stats?${params}`);
    if (res.ok) setStats(await res.json());
  }

  async function fetchWeek(offset: number) {
    const { start, end } = getWeekRange(offset);
    const params = new URLSearchParams({ period: "custom", start, end });
    const res = await fetch(`/api/admin/dashboard-stats?${params}`);
    if (res.ok) setStats(await res.json());
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (p === "week") {
      setWeekOffset(0);
      startTransition(() => fetchWeek(0));
    } else if (p !== "custom") {
      startTransition(() => fetchStats(p));
    }
  }

  function handleWeekNav(dir: -1 | 1) {
    const next = weekOffset + dir;
    setWeekOffset(next);
    startTransition(() => fetchWeek(next));
  }

  const weekInfo = getWeekRange(weekOffset);
  const s = stats;
  const totalCheckedIn = s.vessels.reduce((acc, v) => acc + v.checked_in, 0);

  const periodLabel =
    period === "today"  ? todayLabel :
    period === "week"   ? weekInfo.label :
    period === "month"  ? "This month" :
    period === "year"   ? "This year" :
    customStart && customEnd ? `${customStart} – ${customEnd}` : "Custom range";

  return (
    <div className="mt-8">

      {/* ── Section header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0c7b93] flex items-center justify-center shadow-sm">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#134e4a] leading-tight">Operations Overview</h2>
            <p className="text-xs text-[#0f766e]/70 mt-0.5">
              {periodLabel} · {s.vessels_active} vessel{s.vessels_active !== 1 ? "s" : ""} active · {s.trips_today} trips today
            </p>
          </div>
        </div>
        <PeriodToggle active={period} onChange={handlePeriodChange} />
      </div>

      {/* ── Week Prev/Next navigation ── */}
      {period === "week" && (
        <div className="flex items-center justify-between mb-4 rounded-xl border border-teal-200 bg-white px-4 py-2.5 shadow-sm">
          <button type="button" onClick={() => handleWeekNav(-1)} disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 disabled:opacity-40 transition-colors">
            ← Prev Week
          </button>
          <div className="text-center">
            <div className="text-xs font-bold text-[#134e4a]">{weekInfo.label}</div>
            <div className="text-xs text-[#0f766e]/60">{weekInfo.start} — {weekInfo.end}</div>
          </div>
          <button type="button" onClick={() => handleWeekNav(1)} disabled={isPending || weekOffset >= 0}
            className="flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 disabled:opacity-40 transition-colors">
            Next Week →
          </button>
        </div>
      )}

      {/* ── Custom date range ── */}
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

      {isPending && (
        <div className="text-center py-8 text-sm text-[#0f766e] animate-pulse">Loading…</div>
      )}

      {!isPending && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          <SnapshotCard
            title="Total Revenue" icon={TrendingUp}
            total={peso(s.total_revenue_cents)}
            totalLabel={[
  `Fare: ${peso(s.total_fare_cents)}`,
  `${adminFeeLabel}: ${peso(s.total_platform_fee_cents)}`,
  `${gcashFeeLabel}: ${peso(s.total_processing_fee_cents)}`,
  s.total_refunded_amount_cents > 0 ? `Refunded: −${peso(s.total_refunded_amount_cents)}` : null,
].filter(Boolean).join(' · ')}
            vessels={s.vessels.map(v => ({
              name: v.boat_name,
              value: peso(v.total_revenue_cents),
              sub: `Fare: ${peso(v.fare_cents)} · ${adminFeeLabel}: ${peso(v.platform_fee_cents)} · ${gcashFeeLabel}: ${peso(v.processing_fee_cents)}`,
            }))}
            accent="teal"
          />

          <BoardedCard
            vessels={s.vessels}
            totalBoarded={s.total_boarded}
            totalCheckedIn={totalCheckedIn}
            totalConfirmed={s.total_confirmed}
            href="/admin/bookings"
          />

          <SnapshotCard
            title="Pending Payments" icon={Clock}
            total={s.total_pending}
            totalLabel={s.total_pending > 0 ? "Needs verification" : "All clear ✓"}
            vessels={s.vessels.map(v => ({ name: v.boat_name, value: `${v.pending_count} pending` }))}
            href="/admin/pending-payments"
            accent={s.total_pending > 0 ? "amber" : "teal"}
          />

          <SnapshotCard
            title="Online Bookings" icon={Smartphone}
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

          <SnapshotCard
            title="Walk-in Bookings" icon={Ticket}
            total={s.total_walkin}
            totalLabel={`${peso(s.total_platform_fee_cents)} ${adminFeeLabel} collected`}
            vessels={s.vessels.map(v => ({
              name: v.boat_name,
              value: `${v.walkin_count} bookings`,
              sub: `Fare: ${peso(v.fare_cents)} · ${adminFeeLabel}: ${peso(v.platform_fee_cents)}`,
            }))}
            href="/admin/bookings"
            accent="purple"
          />

          <SnapshotCard
            title="Refund Requests" icon={RotateCcw}
           total={s.total_refund_requests + s.total_refunds_approved + s.total_refunds_processed}
            totalLabel={
            (s.total_refund_requests + s.total_refunds_approved + s.total_refunds_processed) === 0
            ? "None pending ✓"
            : [
            s.total_refund_requests   > 0 ? `Pending: ${s.total_refund_requests}`     : null,
             s.total_refunds_approved  > 0 ? `Approved: ${s.total_refunds_approved}`   : null,
             s.total_refunds_processed > 0 ? `Processed: ${s.total_refunds_processed}` : null,
              ].filter(Boolean).join(' · ')
}


            vessels={[]}
            href="/admin/refunds"
            accent={(s.total_refund_requests + s.total_refunds_approved) > 0 ? "red" : "teal"}
          />

          <FeeBreakdownCards
            platformFeeCents={s.total_platform_fee_cents}
            processingFeeCents={s.total_processing_fee_cents}
            adminFeeLabel={adminFeeLabel}
            gcashFeeLabel={gcashFeeLabel}
          />

        </div>
      )}
    </div>
  );
}
