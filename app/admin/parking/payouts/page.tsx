"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type PayoutItem = {
  id: string;
  type: "reservation" | "extension";
  reference: string;
  customer_full_name: string;
  lot_name: string;
  owner_id: string;
  lot_id: string;
  date: string;
  days: number;
  parking_fee_cents: number;
  commission_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  owner_receivable_cents: number;
  total_amount_cents: number;
  payout_status: "pending" | "paid";
  payment_reference: string | null;
  paid_at: string | null;
};

type Lot = { id: string; name: string; owner_name: string };

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminParkingPayoutsPage() {
  const [items, setItems]         = useState<PayoutItem[]>([]);
  const [lots, setLots]           = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("pending");
  const [loading, setLoading]     = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refInput, setRefInput]   = useState<Record<string, string>>({});
  const [notesInput, setNotesInput] = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState<string | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLot !== "all") params.set("lot_id", selectedLot);
      const res = await fetch(`/api/admin/parking/payouts?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {} finally { setLoading(false); }
  }, [selectedLot]);

  useEffect(() => {
    fetch("/api/admin/parking/lots")
      .then(r => r.json())
      .then(d => setLots(d.lots ?? []));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleMarkPaid(item: PayoutItem) {
    const ref = refInput[item.id]?.trim();
    if (!ref) { setMsg("Payment reference is required."); return; }
    setSaving(item.id); setMsg(null);
    try {
      const res = await fetch("/api/admin/parking/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type, id: item.id,
          payment_reference: ref,
          payment_notes: notesInput[item.id]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Failed."); return; }
      setMarkingId(null);
      setRefInput(p => { const n = {...p}; delete n[item.id]; return n; });
      setNotesInput(p => { const n = {...p}; delete n[item.id]; return n; });
      fetchData();
    } catch { setMsg("Network error."); }
    finally { setSaving(null); }
  }

  async function handleUnmark(item: PayoutItem) {
    if (!confirm("Revert this payout to pending?")) return;
    setSaving(item.id);
    try {
      await fetch(`/api/admin/parking/payouts?type=${item.type}&id=${item.id}`, { method: "DELETE" });
      fetchData();
    } catch {} finally { setSaving(null); }
  }

  const filtered = items.filter(i => statusFilter === "all" || i.payout_status === statusFilter);
  const pendingCents = items.filter(i => i.payout_status === "pending").reduce((s, i) => s + i.owner_receivable_cents, 0);
  const paidCents    = items.filter(i => i.payout_status === "paid").reduce((s, i) => s + i.owner_receivable_cents, 0);

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Admin — Pay Parking</p>
          <h1 className="mt-1 text-2xl font-black text-white">💰 Owner Remittances</h1>
          <p className="text-sm text-white/70 mt-0.5">Remit GCash parking fees to lot owners after deducting platform and processing fees.</p>
          <div className="mt-4">
            <Link href="/admin/parking" className="text-xs text-white/60 hover:text-white/90">← Back to Parking</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center">
            <p className="text-2xl font-black text-red-700">{peso(pendingCents)}</p>
            <p className="text-xs text-red-600 mt-1">Pending Remittance</p>
            <p className="text-xs text-gray-400 mt-0.5">{items.filter(i => i.payout_status === "pending").length} transactions</p>
          </div>
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="text-2xl font-black text-emerald-700">{peso(paidCents)}</p>
            <p className="text-xs text-emerald-600 mt-1">Already Remitted</p>
            <p className="text-xs text-gray-400 mt-0.5">{items.filter(i => i.payout_status === "paid").length} transactions</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select value={selectedLot} onChange={e => setSelectedLot(e.target.value)}
            className="rounded-xl border-2 border-teal-100 bg-white px-3 py-2 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none">
            <option value="all">All Lots</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div className="flex gap-2">
            {(["pending", "paid", "all"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${statusFilter === s ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{msg}</div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-16"><div className="text-4xl animate-pulse mb-3">💰</div><p className="text-sm text-gray-400">Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-[#134e4a]">No {statusFilter === "all" ? "" : statusFilter} transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={`${item.type}-${item.id}`}
                className={`rounded-2xl border-2 bg-white p-5 ${item.payout_status === "paid" ? "border-emerald-100" : "border-teal-100"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-[#0c7b93] text-sm">{item.reference}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.type === "extension" ? "bg-purple-100 text-purple-800" : "bg-teal-100 text-teal-800"}`}>
                        {item.type === "extension" ? "Extension" : "Booking"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.payout_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {item.payout_status === "paid" ? "✓ Remitted" : "Pending"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#134e4a] mt-0.5">{item.customer_full_name}</p>
                    <p className="text-xs text-gray-400">{item.lot_name} · {fmt(item.date)} · {item.days} day{item.days !== 1 ? "s" : ""}</p>
                    {item.payout_status === "paid" && item.payment_reference && (
                      <p className="text-xs text-emerald-700 mt-1">✓ Ref: {item.payment_reference} · {item.paid_at ? new Date(item.paid_at).toLocaleDateString("en-PH") : ""}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Customer paid</p>
                    <p className="font-bold text-[#134e4a]">{peso(item.total_amount_cents)}</p>
                  </div>
                </div>

                {/* Fee breakdown */}
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs space-y-1 mb-3">
                  <div className="flex justify-between text-gray-500">
                    <span>Parking fee</span><span>{peso(item.parking_fee_cents)}</span>
                  </div>
                  {item.commission_cents > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Commission (Travela)</span><span>-{peso(item.commission_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-red-500">
                    <span>Platform fee (Travela)</span><span>-{peso(item.platform_fee_cents)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Processing fee (Travela)</span><span>-{peso(item.processing_fee_cents)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 border-t border-gray-200 pt-1">
                    <span>Owner receivable</span><span>{peso(item.owner_receivable_cents)}</span>
                  </div>
                </div>

                {/* Action */}
                {item.payout_status === "pending" && (
                  markingId === item.id ? (
                    <div className="space-y-2">
                      <input type="text" placeholder="GCash / Bank reference number *"
                        value={refInput[item.id] ?? ""}
                        onChange={e => setRefInput(p => ({ ...p, [item.id]: e.target.value }))}
                        className={inputCls} />
                      <input type="text" placeholder="Notes (optional)"
                        value={notesInput[item.id] ?? ""}
                        onChange={e => setNotesInput(p => ({ ...p, [item.id]: e.target.value }))}
                        className={inputCls} />
                      <div className="flex gap-2">
                        <button onClick={() => setMarkingId(null)}
                          className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                          Cancel
                        </button>
                        <button onClick={() => handleMarkPaid(item)} disabled={saving === item.id}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                          {saving === item.id ? "Saving…" : "✓ Confirm Remittance"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setMarkingId(item.id)}
                      className="w-full rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                      💸 Mark as Remitted to Owner
                    </button>
                  )
                )}
                {item.payout_status === "paid" && (
                  <button onClick={() => handleUnmark(item)} disabled={saving === item.id}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    ↩ Revert to pending
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
