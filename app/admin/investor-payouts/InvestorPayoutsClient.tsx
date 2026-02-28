"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

type InvestorRow = {
  investorId: string; fullName: string; email: string;
  sharePercent: number; notes: string; shareCents: number;
  payoutId: string | null; status: "pending" | "paid";
  paymentReference: string | null; paymentNotes: string | null;
  paidAt: string | null; netPoolCents: number;
};

type PayoutHistory = {
  id: string; investorId: string; investorName: string;
  year: number; month: number; netPoolCents: number;
  shareCents: number; sharePercent: number;
  status: "pending" | "paid";
  paymentReference: string | null; paymentNotes: string | null;
  paidAt: string | null;
};

type RevenueData = {
  totalPassengers: number; activeVessels: number; totalTrips: number;
  platformFeeCents: number; processingFeeCents: number; grossCents: number;
  vesselBonusCents: number;
  vesselBonusLines: { boatName: string; ownerName: string; pct: number; bonusCents: number }[];
  expenseCents: number;
  expenseItems: { id: string; name: string; amount_cents: number; is_recurring: boolean }[];
  netPoolCents: number;
};

interface Props {
  selectedYear: number; selectedMonth: number;
  currentYear: number; currentMonth: number;
  revenue: RevenueData;
  investorRows: InvestorRow[];
  allPayouts: PayoutHistory[];
}

export function InvestorPayoutsClient({
  selectedYear, selectedMonth, currentYear, currentMonth,
  revenue, investorRows, allPayouts,
}: Props) {
  const router = useRouter();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ reference: string; notes: string }>({ reference: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  const prevY = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const prevM = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const nextY = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const nextM = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const canGoNext = nextY < currentYear || (nextY === currentYear && nextM <= currentMonth);

  async function handleMarkPaid(row: InvestorRow) {
    if (!form.reference.trim()) { setError("Payment reference is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/investor-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: row.investorId,
          year: selectedYear,
          month: selectedMonth,
          grossPlatformCents: revenue.grossCents,
          vesselBonusDeductionCents: revenue.vesselBonusCents,
          expenseDeductionCents: revenue.expenseCents,
          netPoolCents: revenue.netPoolCents,
          sharePercent: row.sharePercent,
          shareCents: row.shareCents,
          paymentReference: form.reference.trim(),
          paymentNotes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      setMarkingId(null);
      setForm({ reference: "", notes: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmarkPaid(payoutId: string) {
    if (!confirm("Unmark this payout as paid?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/investor-payouts?id=${payoutId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch { setError("Failed to unmark"); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[#0c7b93] hover:underline">← Admin Dashboard</Link>
          <h1 className="mt-2 text-2xl font-bold text-[#134e4a]">Investor Payouts</h1>
          <p className="text-sm text-[#0f766e]">Manage monthly profit share payouts to investors</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/investor-payouts?year=${prevY}&month=${prevM}`}
            className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">← Prev</Link>
          <span className="text-sm font-bold text-[#134e4a]">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            {isCurrentMonth && <span className="ml-1 text-xs text-[#0f766e]">(current)</span>}
          </span>
          {canGoNext
            ? <Link href={`/admin/investor-payouts?year=${nextY}&month=${nextM}`}
                className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Next →</Link>
            : <span className="rounded-lg border border-teal-100 px-3 py-1.5 text-sm font-semibold text-gray-300 cursor-not-allowed">Next →</span>}
        </div>
      </div>

      {/* Revenue Waterfall */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-4">
          📊 Platform Revenue — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </p>

        <div className="grid grid-cols-3 gap-3 text-center mb-5">
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Trips</p>
            <p className="text-xl font-bold text-[#134e4a]">{revenue.totalTrips}</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Passengers</p>
            <p className="text-xl font-bold text-[#134e4a]">{revenue.totalPassengers}</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Active Vessels</p>
            <p className="text-xl font-bold text-[#134e4a]">{revenue.activeVessels}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-teal-100 pb-2">
            <span className="text-[#134e4a]">Platform Service Fees</span>
            <span className="font-semibold text-emerald-700">{peso(revenue.platformFeeCents)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-teal-200 pb-2">
            <span className="text-[#134e4a]">Payment Processing Fees</span>
            <span className="font-semibold text-blue-700">{peso(revenue.processingFeeCents)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-teal-300 pb-2 font-bold">
            <span className="text-[#134e4a]">Gross Platform Revenue</span>
            <span className="text-[#134e4a]">{peso(revenue.grossCents)}</span>
          </div>

          {/* Vessel bonus lines */}
          {revenue.vesselBonusLines.length > 0
            ? revenue.vesselBonusLines.map((vb, i) => (
                <div key={i} className="flex justify-between text-xs text-rose-600 pl-2">
                  <span>− {vb.ownerName} ({vb.boatName}) loyalty bonus — {vb.pct}%</span>
                  <span>{peso(-vb.bonusCents)}</span>
                </div>
              ))
            : <div className="flex justify-between text-xs text-slate-400 pl-2">
                <span>− Vessel Owner Bonuses (none assigned)</span>
                <span>₱0.00</span>
              </div>}

          {revenue.expenseItems.map((e) => (
            <div key={e.id} className="flex justify-between text-xs text-rose-600 pl-2">
              <span>− {e.name}{e.is_recurring ? " (recurring)" : " (one-time)"}</span>
              <span>{peso(-e.amount_cents)}</span>
            </div>
          ))}

          <div className="flex justify-between border-b-2 border-rose-200 pb-2 font-semibold text-rose-600">
            <span>Total Deductions</span>
            <span>{peso(-(revenue.vesselBonusCents + revenue.expenseCents))}</span>
          </div>

          <div className="flex justify-between pt-1 font-bold text-base">
            <span className="text-[#134e4a]">Net Profit Pool</span>
            <span className="text-emerald-700">{peso(revenue.netPoolCents)}</span>
          </div>
        </div>
      </div>

      {/* Investor payout rows */}
      <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-1">
          💼 Investor Shares — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </p>
        <p className="text-xs text-[#0f766e] mb-4">
          Mark each investor as paid once GCash transfer is sent. Enter the GCash reference number.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-4">
          {investorRows.map((row) => (
            <div key={row.investorId}
              className={`rounded-xl border-2 p-4 transition-colors ${row.status === "paid" ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/30"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-[#134e4a]">💼 {row.fullName}</p>
                  <p className="text-xs text-slate-500">{row.email} · {row.notes}</p>
                  <p className="mt-1 text-xs text-[#0f766e]">
                    {peso(row.netPoolCents)} × {row.sharePercent}% =
                    <span className="ml-1 font-bold text-amber-800 text-sm">{peso(row.shareCents)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {row.status === "paid" ? (
                    <>
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        ✓ Paid
                      </span>
                      <button onClick={() => row.payoutId && handleUnmarkPaid(row.payoutId)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                        Unmark
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setMarkingId(row.investorId); setForm({ reference: "", notes: "" }); setError(null); }}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
                      Mark as Paid
                    </button>
                  )}
                </div>
              </div>

              {/* Paid details */}
              {row.status === "paid" && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t border-green-200 pt-3">
                  <div><p className="text-slate-500">Reference</p><p className="font-mono font-semibold text-[#0c7b93]">{row.paymentReference ?? "—"}</p></div>
                  <div><p className="text-slate-500">Paid At</p><p>{row.paidAt ? new Date(row.paidAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}</p></div>
                  {row.paymentNotes && <div className="col-span-2 sm:col-span-1"><p className="text-slate-500">Notes</p><p>{row.paymentNotes}</p></div>}
                </div>
              )}

              {/* Mark paid form */}
              {markingId === row.investorId && row.status !== "paid" && (
                <div className="mt-4 border-t border-amber-200 pt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Confirm Payment — {row.fullName} — {peso(row.shareCents)}
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">GCash Reference No. *</label>
                    <input
                      type="text"
                      value={form.reference}
                      onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                      placeholder="e.g. 1234567890"
                      className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. February 2026 profit share"
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMarkPaid(row)}
                      disabled={saving}
                      className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                      {saving ? "Saving…" : "✓ Confirm Paid"}
                    </button>
                    <button
                      onClick={() => { setMarkingId(null); setError(null); }}
                      disabled={saving}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full History Table */}
      {allPayouts.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-4">📋 All Payout History</p>
          <div className="overflow-x-auto rounded-lg border border-teal-100">
            <table className="min-w-full text-sm divide-y divide-teal-100">
              <thead>
                <tr className="bg-teal-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Month</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Investor</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Net Pool</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Share %</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Amount</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-[#0f766e]">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Reference</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {allPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/20">
                    <td className="px-4 py-2.5 font-medium text-[#134e4a]">
                      <Link href={`/admin/investor-payouts?year=${p.year}&month=${p.month}`}
                        className="hover:text-[#0c7b93] hover:underline">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[#134e4a]">{p.investorName}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{peso(p.netPoolCents)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{p.sharePercent}%</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-800">{peso(p.shareCents)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status === "paid"
                        ? <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">✓ Paid</span>
                        : <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">⏳ Pending</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#0c7b93]">{p.paymentReference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-PH") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
