"use client";

import { useState } from "react";
import Link from "next/link";

type Settings = {
  default_car_rate_cents:        number;
  default_motorcycle_rate_cents: number;
  default_van_rate_cents:        number | null;
  commission_per_vehicle_cents:  number;
  platform_fee_cents:            number;
  processing_fee_cents:          number;
  max_parking_days:              number;
  overstay_warning_day:          number;
  checkout_cutoff_hour:          number;
  required_documents_text:       string;
  surrender_policy_text:         string;
  overstay_instructions_text:    string;
};

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

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden shadow-sm">
      <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-bold text-[#134e4a]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function ParkingSettingsClient({ settings: initial }: { settings: Settings }) {
  const [form, setForm] = useState({
    car_rate:           centsToInput(initial.default_car_rate_cents),
    motorcycle_rate:    centsToInput(initial.default_motorcycle_rate_cents),
    van_rate:           centsToInput(initial.default_van_rate_cents),
    commission:         centsToInput(initial.commission_per_vehicle_cents),
    platform_fee:       centsToInput(initial.platform_fee_cents),
    processing_fee:     centsToInput(initial.processing_fee_cents),
    max_days:           String(initial.max_parking_days),
    warning_day:        String(initial.overstay_warning_day),
    cutoff_hour:        String(initial.checkout_cutoff_hour),
    required_docs:      initial.required_documents_text,
    surrender_policy:   initial.surrender_policy_text,
    overstay_text:      initial.overstay_instructions_text,
  });

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function update(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    setSuccess(false);
    setError(null);
  }

  // Live totals preview
  const carTotal        = (inputToCents(form.car_rate)       ?? 0) + (inputToCents(form.platform_fee) ?? 0) + (inputToCents(form.processing_fee) ?? 0);
  const motorcycleTotal = (inputToCents(form.motorcycle_rate) ?? 0) + (inputToCents(form.platform_fee) ?? 0) + (inputToCents(form.processing_fee) ?? 0);
  const commissionCents = inputToCents(form.commission) ?? 0;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const body = {
        default_car_rate_cents:        inputToCents(form.car_rate)        ?? 25000,
        default_motorcycle_rate_cents: inputToCents(form.motorcycle_rate) ?? 25000,
        default_van_rate_cents:        inputToCents(form.van_rate),
        commission_per_vehicle_cents:  inputToCents(form.commission)      ?? 10000,
        platform_fee_cents:            inputToCents(form.platform_fee)    ?? 3500,
        processing_fee_cents:          inputToCents(form.processing_fee)  ?? 3000,
        max_parking_days:              parseInt(form.max_days)            || 45,
        overstay_warning_day:          parseInt(form.warning_day)         || 40,
        checkout_cutoff_hour:          parseInt(form.cutoff_hour)         || 8,
        required_documents_text:       form.required_docs.trim(),
        surrender_policy_text:         form.surrender_policy.trim(),
        overstay_instructions_text:    form.overstay_text.trim(),
      };

      const res = await fetch("/api/admin/parking/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-7 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-black">⚙️ Parking Settings</h1>
        <p className="mt-1 text-sm text-white/80">Rates, fees, commission and policies shown to customers.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          ← Back to Parking
        </Link>
        <Link href="/parking" target="_blank" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">
          View Public Page ↗
        </Link>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3">💡 Live Passenger Preview</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <p className="text-xs text-gray-500 mb-1">🚗 Car — 1 day passenger pays:</p>
            <p className="text-xl font-black text-[#0c7b93]">{peso(carTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {peso(inputToCents(form.car_rate) ?? 0)} parking + {peso(inputToCents(form.platform_fee) ?? 0)} platform + {peso(inputToCents(form.processing_fee) ?? 0)} processing
            </p>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <p className="text-xs text-gray-500 mb-1">🏍️ Motorcycle — 1 day passenger pays:</p>
            <p className="text-xl font-black text-[#0c7b93]">{peso(motorcycleTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {peso(inputToCents(form.motorcycle_rate) ?? 0)} parking + {peso(inputToCents(form.platform_fee) ?? 0)} platform + {peso(inputToCents(form.processing_fee) ?? 0)} processing
            </p>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3 sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">💰 Commission per vehicle booked (goes to admin):</p>
            <p className="text-xl font-black text-amber-700">{peso(commissionCents)}</p>
            <p className="text-xs text-gray-400 mt-1">
              2 vehicles = {peso(commissionCents * 2)} · 3 vehicles = {peso(commissionCents * 3)} · Owner receives: parking fee − commission
            </p>
          </div>
        </div>
      </div>

      {/* Rates */}
      <Section title="Vehicle Parking Rates (Default)" icon="💵">
        <p className="text-xs text-gray-400 mb-4">These are the default rates. Individual lots can override these from the Lots settings page.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>🚗 Car Rate (₱/day)</label>
            <input type="number" min={0} step={0.01} value={form.car_rate}
              onChange={e => update("car_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>🏍️ Motorcycle Rate (₱/day)</label>
            <input type="number" min={0} step={0.01} value={form.motorcycle_rate}
              onChange={e => update("motorcycle_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>🚐 Van Rate (₱/day) — optional</label>
            <input type="number" min={0} step={0.01} value={form.van_rate}
              placeholder="Leave blank if no van slots"
              onChange={e => update("van_rate", e.target.value)} className={inputCls} />
          </div>
        </div>
      </Section>

      {/* Fees & Commission */}
      <Section title="Fees & Commission" icon="💸">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Commission per Vehicle (₱)</label>
            <input type="number" min={0} step={0.01} value={form.commission}
              onChange={e => update("commission", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Flat fee per vehicle per booking. Goes to admin.</p>
          </div>
          <div>
            <label className={labelCls}>Platform Service Fee (₱)</label>
            <input type="number" min={0} step={0.01} value={form.platform_fee}
              onChange={e => update("platform_fee", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Charged once per booking regardless of vehicles.</p>
          </div>
          <div>
            <label className={labelCls}>Payment Processing Fee (₱)</label>
            <input type="number" min={0} step={0.01} value={form.processing_fee}
              onChange={e => update("processing_fee", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">GCash processing. Charged once per booking.</p>
          </div>
        </div>
      </Section>

      {/* Duration & Cutoff */}
      <Section title="Duration & Cutoff Rules" icon="📅">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Maximum Parking Days</label>
            <input type="number" min={1} max={365} value={form.max_days}
              onChange={e => update("max_days", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Vehicle must exit or extend before this limit.</p>
          </div>
          <div>
            <label className={labelCls}>Overstay Warning Day</label>
            <input type="number" min={1} max={365} value={form.warning_day}
              onChange={e => update("warning_day", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Alert admin + customer this many days in. Default: day 40.</p>
          </div>
          <div>
            <label className={labelCls}>Checkout Cutoff Hour (0–23)</label>
            <input type="number" min={0} max={23} value={form.cutoff_hour}
              onChange={e => update("cutoff_hour", e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">New day charged after this hour. Default: 8 (8AM).</p>
          </div>
        </div>
      </Section>

      {/* Policy Text */}
      <Section title="Policy Text (shown to customers)" icon="📋">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Required Documents Text</label>
            <textarea rows={3} value={form.required_docs}
              onChange={e => update("required_docs", e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="e.g. Valid government-issued ID and complete vehicle papers (OR/CR)..." />
          </div>
          <div>
            <label className={labelCls}>Overstay Instructions (shown on scanner when vehicle is overdue)</label>
            <textarea rows={3} value={form.overstay_text}
              onChange={e => update("overstay_text", e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="e.g. Your parking period has expired. Please settle your balance to proceed with vehicle withdrawal." />
          </div>
          <div>
            <label className={labelCls}>Surrender Policy (shown at bottom of public page)</label>
            <textarea rows={3} value={form.surrender_policy}
              onChange={e => update("surrender_policy", e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="e.g. Vehicles parked beyond 45 days without renewal will be considered abandoned..." />
          </div>
        </div>
      </Section>

      {/* Error / Success */}
      {error   && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-semibold">✓ Settings saved! Public parking page will reflect these changes immediately.</div>}

      <button onClick={handleSave} disabled={saving}
        className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] font-bold text-white text-sm hover:bg-[#085f72] disabled:opacity-50 transition-colors shadow-sm">
        {saving ? "Saving…" : "💾 Save All Settings"}
      </button>
    </div>
  );
}
