"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Lot = {
  id: string; name: string; slug: string; address: string;
  distance_from_port: string | null;
  total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number;
  accepts_car: boolean; accepts_motorcycle: boolean; accepts_van: boolean;
  car_rate_cents: number | null; motorcycle_rate_cents: number | null; van_rate_cents: number | null;
  is_active: boolean; is_24hrs: boolean;
  available_car: number; available_motorcycle: number; available_van: number;
};

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

export default function AdminParkingLotsPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lot | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { fetchLots(); }, []);

  async function fetchLots() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/parking/lots");
      if (res.ok) { const d = await res.json(); setLots(d); }
    } finally { setLoading(false); }
  }

  async function saveLot() {
    if (!editing) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/parking/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Save failed."); return; }
      setMsg("✅ Saved successfully.");
      setEditing(null);
      await fetchLots();
    } catch { setMsg("Network error."); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full rounded-xl border-2 border-blue-100 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none";
  const labelCls = "text-xs font-semibold text-gray-600 block mb-1";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">🅿️ Parking Lots</h1>
        <p className="mt-2 text-sm text-white/90">Manage lot slots, rates, and availability.</p>
      </div>
      <div className="mb-4 flex gap-3">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back to Parking</Link>
      </div>

      {msg && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>{msg}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-4">
          {lots.map(lot => (
            <div key={lot.id} className="rounded-2xl border-2 border-blue-100 bg-white p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-black text-gray-800 text-lg">{lot.name}</h2>
                  <p className="text-sm text-gray-500">📍 {lot.distance_from_port ?? lot.address}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {lot.accepts_car        && <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-800">🚗 {lot.total_slots_car} slots · {lot.car_rate_cents ? peso(lot.car_rate_cents) : "default"}/day</span>}
                    {lot.accepts_motorcycle && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800">🏍️ {lot.total_slots_motorcycle} slots · {lot.motorcycle_rate_cents ? peso(lot.motorcycle_rate_cents) : "default"}/day</span>}
                    {lot.accepts_van        && <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-800">🚐 {lot.total_slots_van} slots · {lot.van_rate_cents ? peso(lot.van_rate_cents) : "default"}/day</span>}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span>Available: 🚗 {lot.available_car} · 🏍️ {lot.available_motorcycle} · 🚐 {lot.available_van}</span>
                    <span className={`font-bold ${lot.is_active ? "text-emerald-600" : "text-red-500"}`}>{lot.is_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <button onClick={() => setEditing({ ...lot })}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
                  Edit Lot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">{editing.name}</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Total Car Slots</label><input type="number" min={0} value={editing.total_slots_car} onChange={e => setEditing({ ...editing, total_slots_car: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Total Motorcycle Slots</label><input type="number" min={0} value={editing.total_slots_motorcycle} onChange={e => setEditing({ ...editing, total_slots_motorcycle: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Total Van Slots</label><input type="number" min={0} value={editing.total_slots_van} onChange={e => setEditing({ ...editing, total_slots_van: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Car Rate (₱/day, blank = default)</label><input type="number" min={0} value={editing.car_rate_cents ? editing.car_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, car_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Use default" className={inputCls} /></div>
                <div><label className={labelCls}>Motorcycle Rate (₱/day)</label><input type="number" min={0} value={editing.motorcycle_rate_cents ? editing.motorcycle_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, motorcycle_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Use default" className={inputCls} /></div>
                <div><label className={labelCls}>Van Rate (₱/day)</label><input type="number" min={0} value={editing.van_rate_cents ? editing.van_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, van_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Use default" className={inputCls} /></div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{ key: "accepts_car", label: "Accepts Cars" }, { key: "accepts_motorcycle", label: "Accepts Motorcycles" }, { key: "accepts_van", label: "Accepts Vans" }, { key: "is_active", label: "Active" }, { key: "is_24hrs", label: "24 Hours" }].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editing[f.key as keyof Lot] as boolean}
                      onChange={e => setEditing({ ...editing, [f.key]: e.target.checked })}
                      className="rounded" />
                    {f.label}
                  </label>
                ))}
              </div>
              {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg}</div>}
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveLot} disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
