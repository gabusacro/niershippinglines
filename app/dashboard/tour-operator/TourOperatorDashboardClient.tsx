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
  status: string;
  schedule_date: string | null;
  departure_time: string | null;
  tour_title: string;
  guide_id: string | null;
  guide_name: string | null;
  tracking: { picked_up: number; on_tour: number; dropped_off: number; no_show: number; waiting: number } | null;
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
  guides: Guide[];
  todayPH: string;
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

function CollapseSection({ title, count, children, defaultOpen = false }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white mb-5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
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

export default function TourOperatorDashboardClient({
  displayName, totalBookings, guidesCount, todayRevenue,
  pendingCount, bookings, guides, todayPH,
}: Props) {
  const [statusPeriod, setStatusPeriod] = useState<"day" | "week" | "month">("day");

  // Filter upcoming (today and future)
  const upcomingBookings = useMemo(() =>
    bookings
      .filter(b => b.schedule_date && b.schedule_date >= todayPH)
      .sort((a, b) => (a.schedule_date ?? "").localeCompare(b.schedule_date ?? "")),
    [bookings, todayPH]
  );

  // Filter for status period
  const statusBookings = useMemo(() => {
    const now = new Date();
    const todayStr = todayPH;

    let startDate: string;
    if (statusPeriod === "day") {
      startDate = todayStr;
    } else if (statusPeriod === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    }

    return bookings
      .filter(b => b.schedule_date && b.schedule_date >= startDate && b.schedule_date <= todayStr)
      .sort((a, b) => (b.schedule_date ?? "").localeCompare(a.schedule_date ?? ""));
  }, [bookings, statusPeriod, todayPH]);

  function formatDateShort(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function formatDateFull(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  // Group upcoming by date
  const upcomingByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of upcomingBookings) {
      const d = b.schedule_date ?? "unknown";
      if (!map[d]) map[d] = [];
      map[d].push(b);
    }
    return map;
  }, [upcomingBookings]);

  // Group status bookings by date
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
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3Cpath d='M0 50 Q30 30 60 50 Q90 70 120 50' stroke='white' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
            backgroundSize: "240px 120px", backgroundRepeat: "repeat",
          }} />
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

      {/* UPCOMING BOOKINGS — collapsible, grouped by date */}
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
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                            {b.booking_type}
                          </span>
                          {b.is_walk_in && (
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Walk-in</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {b.customer_name}
                          {b.total_pax > 1 ? ` & ${b.total_pax - 1} other${b.total_pax - 1 > 1 ? "s" : ""}` : ""}
                          {" · "}{b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                          {b.departure_time ? " · " + b.departure_time.slice(0, 5) : ""}
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5 font-medium">
                          👤 {b.guide_name ?? "No guide assigned"}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-emerald-700 shrink-0">
                        ₱{(b.total_amount_cents / 100).toLocaleString()}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link href="/dashboard/tour-operator/bookings" className="text-xs text-emerald-600 hover:underline font-semibold">
            View all bookings →
          </Link>
        </div>
      </CollapseSection>

      {/* GUEST TOUR STATUS — collapsible with day/week/month filter */}
      <CollapseSection title="Guest Tour Status" count={statusBookings.length} defaultOpen={true}>
        {/* Period filter */}
        <div className="flex gap-2 mb-4">
          {(["day", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setStatusPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                statusPeriod === p
                  ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                  : "border-gray-200 bg-white text-gray-500 hover:border-emerald-300"
              }`}>
              {p === "day" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {statusBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No bookings for this period.
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(statusByDate).map(([date, dayBookings]) => (
              <div key={date}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  {formatDateShort(date)}
                </p>
                <div className="space-y-2">
                  {dayBookings.map((b) => (
                    <Link key={b.id} href={`/dashboard/tour-operator/bookings/${b.id}`}
                      className="block rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-sm text-[#134e4a]">{b.tour_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {b.customer_name}
                            {b.total_pax > 1 ? ` & ${b.total_pax - 1} other${b.total_pax - 1 > 1 ? "s" : ""}` : ""}
                            {" · "}{b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-blue-600 mt-0.5 font-medium">
                            👤 {b.guide_name ?? "No guide assigned"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                            {b.booking_type}
                          </span>
                          {b.is_walk_in && (
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Walk-in</span>
                          )}
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

      {/* MY TOUR GUIDES — collapsible */}
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
