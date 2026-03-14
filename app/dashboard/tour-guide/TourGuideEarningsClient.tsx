"use client";

import { useState, useMemo } from "react";

type Earning = {
  batch_id: string;
  schedule_date: string | null;
  tour_title: string;
  total_pax: number;
  booking_count: number;
  service_fee_cents: number;
  guide_payment_status: string;
  guide_payment_ref: string | null;
  guide_paid_at: string | null;
};

interface Props {
  earnings: Earning[];
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
function getMonthStart(dateStr: string): string { return dateStr.slice(0, 7) + "-01"; }
function getMonthEnd(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
}

export default function TourGuideEarningsClient({ earnings, todayPH }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState(getMonthStart(todayPH));
  const [customEnd, setCustomEnd] = useState(todayPH);

  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (period === "today") return {
      startDate: todayPH, endDate: todayPH,
      periodLabel: new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }),
    };
    if (period === "week") {
      const start = getWeekStart(todayPH);
      return {
        startDate: start, endDate: todayPH,
        periodLabel: new Date(start + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }) + " – " +
          new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      };
    }
    if (period === "month") {
      const start = getMonthStart(todayPH);
      const end = getMonthEnd(todayPH);
      return {
        startDate: start, endDate: end,
        periodLabel: new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
      };
    }
    return { startDate: customStart, endDate: customEnd, periodLabel: customStart + " to " + customEnd };
  }, [period, todayPH, customStart, customEnd]);

  const periodEarnings = useMemo(() =>
    earnings.filter(e => {
      if (!e.schedule_date) return false;
      return e.schedule_date >= startDate && e.schedule_date <= endDate;
    }).sort((a, b) => (b.schedule_date ?? "").localeCompare(a.schedule_date ?? "")),
    [earnings, startDate, endDate]
  );

  const totalEarned   = periodEarnings.filter(e => e.guide_payment_status === "paid").reduce((s, e) => s + e.service_fee_cents, 0);
  const totalPending  = periodEarnings.filter(e => e.guide_payment_status !== "paid").reduce((s, e) => s + e.service_fee_cents, 0);
  const totalTours    = periodEarnings.length;
  const totalPax      = periodEarnings.reduce((s, e) => s + e.total_pax, 0);

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="rounded-2xl border-2 border-blue-100 bg-white overflow-hidden">
      {/* Header + filter */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-bold text-[#134e4a] text-lg">💵 My Earnings</h2>
          <div className="flex gap-2 flex-wrap">
            {(["today", "week", "month", "custom"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors ${
                  period === p ? "border-blue-500 bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-500 hover:border-blue-300"
                }`}>
                {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {period === "custom" && (
          <div className="flex gap-3 mb-4 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">From</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">To</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-wide">{periodLabel}</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Tours Done</p>
            <p className="text-2xl font-bold text-blue-700">{totalTours}</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Total Pax</p>
            <p className="text-2xl font-bold text-[#134e4a]">{totalPax}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Received</p>
            <p className="text-lg font-bold text-emerald-700">
              {totalEarned > 0 ? `₱${(totalEarned / 100).toLocaleString()}` : "₱0"}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-lg font-bold text-amber-600">
              {totalPending > 0 ? `₱${(totalPending / 100).toLocaleString()}` : "₱0"}
            </p>
          </div>
        </div>

        {/* Pending notice */}
        {totalPending > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-800">
              ₱{(totalPending / 100).toLocaleString()} pending from your operator
            </p>
            <span className="text-xs text-amber-600">⏳ Awaiting payment</span>
          </div>
        )}
      </div>

      {/* Tour list */}
      {periodEarnings.length === 0 ? (
        <div className="px-6 pb-6">
          <p className="text-sm text-gray-400 text-center py-4">No tours for this period.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {periodEarnings.map(e => {
            const isPaid = e.guide_payment_status === "paid";
            const hasNoFee = e.service_fee_cents === 0;
            return (
              <div key={e.batch_id} className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#134e4a]">{e.tour_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {e.schedule_date ? formatDate(e.schedule_date) : "—"}
                    {" · "}{e.total_pax} pax · {e.booking_count} booking{e.booking_count > 1 ? "s" : ""}
                  </p>
                  {isPaid && e.guide_payment_ref && (
                    <p className="text-xs text-emerald-600 mt-0.5 font-semibold">
                      GCash ref: {e.guide_payment_ref}
                      {e.guide_paid_at
                        ? " · " + new Date(e.guide_paid_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {hasNoFee ? (
                    <span className="text-xs text-gray-400 italic">Fee not set</span>
                  ) : (
                    <p className="text-sm font-bold text-[#134e4a]">
                      ₱{(e.service_fee_cents / 100).toLocaleString()}
                    </p>
                  )}
                  {isPaid ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">✅ Paid</span>
                  ) : hasNoFee ? (
                    <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-semibold">⏳ Pending</span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">⏳ Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
