"use client";

import { useState, useMemo } from "react";

type Booking = {
  id: string;
  reference: string;
  total_amount_cents: number;
  booking_source: string;
  payment_verified_at: string | null;
  tour_operator_id: string | null;
  operator_payment_status: string;
  operator_payment_ref: string | null;
  operator_paid_at: string | null;
  status: string;
  customer_name: string;
  total_pax: number;
  tour_title: string;
  schedule_date: string | null;
};

type Operator = {
  id: string;
  full_name: string;
};

interface Props {
  bookings: Booking[];
  operators: Operator[];
  todayPH: string;
}

type Period = "today" | "week" | "month" | "custom";

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // Mon start
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

export default function AdminToursRevenueClient({ bookings, operators, todayPH }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState(getMonthStart(todayPH));
  const [customEnd, setCustomEnd] = useState(todayPH);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});

  // Compute date range based on period
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (period === "today") return {
      startDate: todayPH, endDate: todayPH,
      periodLabel: "Today — " + new Date(todayPH + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }),
    };
    if (period === "week") {
      const start = getWeekStart(todayPH);
      const end = todayPH;
      return {
        startDate: start, endDate: end,
        periodLabel: "This Week — " + new Date(start + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }) + " to " + new Date(end + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
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
    return {
      startDate: customStart, endDate: customEnd,
      periodLabel: customStart + " to " + customEnd,
    };
  }, [period, todayPH, customStart, customEnd]);

  // Filter bookings within period using payment_verified_at
  const periodBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!b.payment_verified_at) return false;
      const d = b.payment_verified_at.slice(0, 10); // YYYY-MM-DD
      return d >= startDate && d <= endDate;
    });
  }, [bookings, startDate, endDate]);

  // Revenue breakdown for period
  const onlineRev = periodBookings.filter(b => b.booking_source === "online").reduce((s, b) => s + b.total_amount_cents, 0);
  const walkinRev = periodBookings.filter(b => b.booking_source === "walk_in").reduce((s, b) => s + b.total_amount_cents, 0);
  const opWalkinRev = periodBookings.filter(b => b.booking_source === "operator_walk_in").reduce((s, b) => s + b.total_amount_cents, 0);
  const yourTotal = onlineRev + walkinRev;

  // Operator audit — only bookings YOU received money for (online + walk_in) that have an operator
  const operatorAudit = useMemo(() => {
    const map: Record<string, {
      operator: Operator;
      bookings: Booking[];
      totalOwed: number;
      totalPaid: number;
      balance: number;
    }> = {};

    for (const b of periodBookings) {
      if (b.booking_source === "operator_walk_in") continue; // skip — not your money
      if (!b.tour_operator_id) continue;

      const op = operators.find(o => o.id === b.tour_operator_id);
      if (!op) continue;

      if (!map[b.tour_operator_id]) {
        map[b.tour_operator_id] = { operator: op, bookings: [], totalOwed: 0, totalPaid: 0, balance: 0 };
      }

      map[b.tour_operator_id].bookings.push(b);
      map[b.tour_operator_id].totalOwed += b.total_amount_cents;

      const isPaid = paidMap[b.id] || b.operator_payment_status === "paid";
      if (isPaid) {
        map[b.tour_operator_id].totalPaid += b.total_amount_cents;
      }
    }

    for (const entry of Object.values(map)) {
      entry.balance = entry.totalOwed - entry.totalPaid;
    }

    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [periodBookings, operators, paidMap]);

  async function markOperatorPaid(bookingId: string, ref: string) {
    setMarkingId(bookingId);
    try {
      const res = await fetch("/api/admin/tours/bookings/mark-operator-paid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, payment_ref: ref }),
      });
      if (res.ok) {
        setPaidMap(prev => ({ ...prev, [bookingId]: true }));
      }
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="mt-6">
      {/* Period filter */}
      <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-bold text-[#134e4a] text-lg">📊 Revenue Dashboard</h2>
          <div className="flex gap-2 flex-wrap">
            {(["today", "week", "month", "custom"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                  period === p
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:border-emerald-300"
                }`}>
                {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {period === "custom" && (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-emerald-900">Online Revenue</p>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">GCash</span>
            </div>
            <p className="text-3xl font-bold text-emerald-700">₱{(onlineRev / 100).toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-1">Money you received online</p>
          </div>

          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-blue-900">Walk-in Revenue</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Cash</span>
            </div>
            <p className="text-3xl font-bold text-blue-700">₱{(walkinRev / 100).toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-1">Cash you collected</p>
          </div>

          <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-purple-900">Operator Walk-ins</p>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Not Yours</span>
            </div>
            <p className="text-3xl font-bold text-purple-700">₱{(opWalkinRev / 100).toLocaleString()}</p>
            <p className="text-xs text-purple-600 mt-1">⚠️ You did not receive this</p>
          </div>
        </div>

        {/* Your total */}
        <div className="rounded-2xl bg-emerald-700 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">Your Total Revenue</p>
            <p className="text-xs text-emerald-300 mt-0.5">Online + Your Walk-ins · {periodLabel}</p>
          </div>
          <p className="text-3xl font-bold text-white">₱{(yourTotal / 100).toLocaleString()}</p>
        </div>
      </div>

      {/* Operator Payment Audit */}
      <div className="rounded-2xl border-2 border-amber-100 bg-white p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-[#134e4a] text-lg">💰 Operator Payment Audit</h2>
          <span className="text-xs text-gray-400 font-semibold">{periodLabel}</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Amount you owe each operator from online bookings and your walk-ins assigned to them.
          Operator walk-ins are excluded — that&apos;s their own cash.
        </p>

        {operatorAudit.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No operator bookings for this period.</p>
        ) : (
          <div className="space-y-6">
            {operatorAudit.map(({ operator, bookings: opBookings, totalOwed, totalPaid, balance }) => (
              <div key={operator.id} className="rounded-2xl border-2 border-gray-100 overflow-hidden">
                {/* Operator header */}
                <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${
                  balance > 0 ? "bg-amber-50 border-b-2 border-amber-100" : "bg-emerald-50 border-b-2 border-emerald-100"
                }`}>
                  <div>
                    <p className="font-bold text-[#134e4a]">{operator.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opBookings.length} booking{opBookings.length > 1 ? "s" : ""}</p>
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

                {/* Bookings list */}
                <div className="divide-y divide-gray-50">
                  {opBookings.map(b => {
                    const isPaid = paidMap[b.id] || b.operator_payment_status === "paid";
                    return (
                      <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              b.booking_source === "walk_in" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                            }`}>
                              {b.booking_source === "walk_in" ? "Walk-in" : "Online"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                            {b.schedule_date ? " · " + new Date(b.schedule_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : ""}
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
                            <MarkPaidButton
                              bookingId={b.id}
                              loading={markingId === b.id}
                              onMark={(ref) => markOperatorPaid(b.id, ref)}
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
      </div>
    </div>
  );
}

function MarkPaidButton({ bookingId, loading, onMark }: {
  bookingId: string;
  loading: boolean;
  onMark: (ref: string) => void;
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
    <div className="flex items-center gap-2">
      <input
        value={ref}
        onChange={e => setRef(e.target.value.toUpperCase())}
        placeholder="GCash ref #"
        className="w-28 rounded-lg border-2 border-amber-300 px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500"
        autoFocus
      />
      <button
        onClick={() => { if (ref.trim()) onMark(ref.trim()); }}
        disabled={loading || !ref.trim()}
        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full font-bold disabled:opacity-50">
        {loading ? "..." : "Confirm"}
      </button>
      <button onClick={() => setShowInput(false)}
        className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
        ✕
      </button>
    </div>
  );
}
