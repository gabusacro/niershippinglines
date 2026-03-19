"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function centsToInput(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return String(cents / 100);
}
function inputToCents(val: string): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20";
const labelCls = "text-xs font-bold text-[#134e4a] block mb-1";

export default function ParkingSettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({
    car_rate:         "250",
    motorcycle_rate:  "250",
    van_rate:         "",
    commission:       "100",
    platform_fee:     "35",
    processing_fee:   "30",
    max_days:         "45",
    warning_day:      "40",
    cutoff_hour:      "8",
    required_docs:    "Valid government-issued ID and complete vehicle papers (OR/CR). Both must be presented upon check-in.",
    surrender_policy: "Vehicles parked beyond 45 days without renewal will be considered abandoned. Travela Siargao reserves the right to surrender the vehicle to the local government unit for towing.",
    overstay_text:    "Your parking period has expired. Please settle your overstay balance to proceed with vehicle withdrawal.",
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/parking/settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setForm({
          car_rate:         centsToInput(data.default_car_rate_cents        ?? 25000),
          motorcycle_rate:  centsToInput(data.default_motorcycle_rate_cents ?? 25000),
          van_rate:         centsToInput(data.default_van_rate_cents),
          commission:       centsToInput(data.commission_per_vehicle_cents  ?? 10000),
          platform_fee:     centsToInput(data.platform_fee_cents            ?? 3500),
          processing_fee:   centsToInput(data.processing_fee_cents          ?? 3000),
          max_days:         String(data.max_parking_days   ?? 45),
          warning_day:      String(data.overstay_warning_day ?? 40),
          cutoff_hour:      String(data.checkout_cutoff_hour ?? 8),
          required_docs:    data.required_documents_text    ?? "",
          surrender_policy: data.surrender_policy_text      ?? "",
          overstay_text:    data.overstay_instructions_text ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function update(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    setSuccess(false); setError(null);
  }

  const carTotal        = (inputToCents(form.car_rate)       ?? 0) + (inputToCents(form.platform_fee) ?? 0) + (inputToCents(form.processing_fee) ?? 0);
  const motorcycleTotal = (inputToCents(form.motorcycle_rate) ?? 0) + (inputToCents(form.platform_fee) ?? 0) + (inputToCents(form.processing_fee) ?? 0);
  const commissionCents = inputToCents(form.commission) ?? 0;

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      const res = await fetch("/api/admin/parking/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_car_rate_cents:        inputToCents(form.car_rate)        ?? 25000,
          default_motorcycle_rate_cents: inputToCents(form.motorcycle_rate) ?? 25000,
          default_van_rate_cents:        inputToCents(form.van_rate),
          commission_per_vehicle_cents:  inputToCents(form.commission)      ?? 10000,
          platform_fee_cents:            inputToCents(form.platform_fee)    ?? 3500,
          processing_fee_cents:          inputToCents(form.processing_fee)  ?? 3000,
          max_parking_days:              parseInt(form.max_days)   || 45,
          overstay_warning_day:          parseInt(form.warning_day) || 40,
          checkout_cutoff_hour:          parseInt(form.cutoff_hour) || 8,
          required_documents_text:       form.required_docs.trim(),
          surrender_policy_text:         form.surrender_policy.trim(),
          overstay_instructions_text:    form.overstay_text.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      setSuccess(true);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (!loaded) return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-[#0f766e] animate-pulse">
      Loading settings…
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">

      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-7 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-black">⚙️ Parking Settings</h1>
        <p className="mt-1 text-sm text-white/80">Rates, fees, commission and policies shown to customers.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back to Parking</Link>
        <Link href="/parking" target="_blank" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">View Public Page ↗</Link>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3">💡 Live Passenger Preview</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <p className="text-xs text-gray-500 mb-1">🚗 Car — 1 day passenger pays:</p>
            <p className="text-xl font-black text-[#0c7b93]">{peso(carTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{peso(inputToCents(form.car_rate) ?? 0)} parking + {peso(inputToCents(form.platform_fee) ?? 0)} platform + {peso(inputToCents(form.processing_fee) ?? 0)} processing</p>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <p className="text-xs text-gray-500 mb-1">🏍️ Motorcycle — 1 day passenger pays:</p>
            <p className="text-xl font-black text-[#0c7b93]">{peso(motorcycleTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{peso(inputToCents(form.motorcycle_rate) ?? 0)} parking + {peso(inputToCents(form.platform_fee) ?? 0)} platform + {peso(inputToCents(form.processing_fee) ?? 0)} processing</p>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3 sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">💰 Commission per vehicle booked (admin earns):</p>
            <p className="text-xl font-black text-amber-700">{peso(commissionCents)}</p>
            <p className="text-xs text-gray-400 mt-1">2 vehicles = {peso(commissionCents * 2)} · 3 vehicles = {peso(commissionCents * 3)}</p>
          </div>
        </div>
      </div>

      {/* Rates */}
      <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-2">
          <span className="text-lg">💵</span>
          <h2 className="text-sm font-bold text-[#134e4a]">Vehicle Parking Rates (Default per day)</h2>
        </div>
        <div className="p-5 grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>🚗 Car (₱/day)</label>
            <input type="number" min={0} step={0.01} value={form.car_rate} onChange={e => update("car_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>🏍️ Motorcycle (₱/day)</label>
            <input type="number" min={0} step={0.01} value={form.motorcycle_rate} onChange={e => update("motorcycle_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>🚐 Van (₱/day) — optional</label>
            <input type="number" min={0} step={0.01} value={form.van_rate} placeholder="Leave blank if none" onChange={e => update("van_rate", e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Fees & Commission */}
      <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-2">
          <span className="text-lg">💸</span>
          <h2 className="text-sm font-bold text-[#134e4a]">Fees & Commission</h2>
        </div>
        <div className="p-5 grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Commission per Vehicle (₱)</label>
            <input type="number" min={0} step={0.01} value={form.commission} onChange={e => update("commission", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Flat per vehicle per booking. Goes to admin.</p>
          </div>
          <div>
            <label className={labelCls}>Platform Service Fee (₱)</label>
            <input type="number" min={0} step={0.01} value={form.platform_fee} onChange={e => update("platform_fee", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Once per booking regardless of vehicles.</p>
          </div>
          <div>
            <label className={labelCls}>Payment Processing Fee (₱)</label>
            <input type="number" min={0} step={0.01} value={form.processing_fee} onChange={e => update("processing_fee", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">GCash fee. Once per booking.</p>
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h2 className="text-sm font-bold text-[#134e4a]">Duration & Cutoff Rules</h2>
        </div>
        <div className="p-5 grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Maximum Parking Days</label>
            <input type="number" min={1} max={365} value={form.max_days} onChange={e => update("max_days", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Overstay Warning Day</label>
            <input type="number" min={1} max={365} value={form.warning_day} onChange={e => update("warning_day", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Alert sent on this day. Default: 40.</p>
          </div>
          <div>
            <label className={labelCls}>Checkout Cutoff Hour (0–23)</label>
            <input type="number" min={0} max={23} value={form.cutoff_hour} onChange={e => update("cutoff_hour", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">New day charged after this hour. Default: 8.</p>
          </div>
        </div>
      </div>

      {/* Policy text */}
      <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h2 className="text-sm font-bold text-[#134e4a]">Policy Text (shown to customers)</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Required Documents</label>
            <textarea rows={3} value={form.required_docs} onChange={e => update("required_docs", e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Overstay Message (shown on scanner when overdue)</label>
            <textarea rows={3} value={form.overstay_text} onChange={e => update("overstay_text", e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Surrender Policy (shown at bottom of public page)</label>
            <textarea rows={3} value={form.surrender_policy} onChange={e => update("surrender_policy", e.target.value)} className={`${inputCls} resize-none`} />
          </div>
        </div>
      </div>

      {error   && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-semibold">✓ Settings saved! Public parking page now reflects these changes.</div>}

      <button onClick={handleSave} disabled={saving}
        className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] font-bold text-white text-sm hover:bg-[#085f72] disabled:opacity-50 transition-colors shadow-sm">
        {saving ? "Saving…" : "💾 Save All Settings"}
      </button>
    </div>
  );
}
