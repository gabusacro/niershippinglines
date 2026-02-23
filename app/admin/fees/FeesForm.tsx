"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FeeSettingsFull = {
  admin_fee_cents_per_passenger: number;
  gcash_fee_cents: number;
  admin_fee_label: string;
  gcash_fee_label: string;
  admin_fee_applies_walkin: boolean;
  gcash_fee_show_breakdown: boolean;
  child_min_age: number;
  child_max_age: number;
  child_discount_percent: number;
  infant_max_age: number;
  infant_is_free: boolean;
  senior_discount_percent: number;
  pwd_discount_percent: number;
};

export function FeesForm({ initial }: { initial: FeeSettingsFull }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...initial });

  function set<K extends keyof FeeSettingsFull>(key: K, value: FeeSettingsFull[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  async function handleSave(section: Partial<FeeSettingsFull>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(section),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      flash("Saved successfully!");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Update failed", true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">⚠ {error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">✓ {success}</div>}

      {/* ── Section 1: Platform Fees ── */}
      <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#134e4a]">💳 Platform Fees</h2>
        <p className="mt-1 text-xs text-[#0f766e]">Fees added on top of the base fare. You can rename them and control where they apply.</p>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {/* Admin Fee */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#134e4a]">Service Fee (per passenger)</label>
            <div>
              <p className="text-xs text-[#0f766e] mb-1">Display name shown to passengers</p>
              <input
                value={form.admin_fee_label}
                onChange={(e) => set("admin_fee_label", e.target.value)}
                placeholder="e.g. Platform Service Fee"
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]"
              />
            </div>
            <div>
              <p className="text-xs text-[#0f766e] mb-1">Amount per passenger</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#134e4a]">₱</span>
                <input
                  type="number" min={0} step={1}
                  value={form.admin_fee_cents_per_passenger / 100}
                  onChange={(e) => set("admin_fee_cents_per_passenger", Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="w-28 rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]"
                />
                <span className="text-xs text-[#0f766e]">per pax</span>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.admin_fee_applies_walkin}
                onChange={(e) => set("admin_fee_applies_walkin", e.target.checked)}
                className="h-4 w-4 rounded border-teal-300"
              />
              <div>
                <p className="text-sm font-medium text-[#134e4a]">Apply to walk-in bookings</p>
                <p className="text-xs text-[#0f766e]">If off, walk-in passengers pay base fare only.</p>
              </div>
            </label>
          </div>

          {/* GCash Fee */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#134e4a]">Online Payment Fee (per booking)</label>
            <div>
              <p className="text-xs text-[#0f766e] mb-1">Display name shown to passengers</p>
              <input
                value={form.gcash_fee_label}
                onChange={(e) => set("gcash_fee_label", e.target.value)}
                placeholder="e.g. Payment Processing Fee"
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]"
              />
            </div>
            <div>
              <p className="text-xs text-[#0f766e] mb-1">Amount per online transaction</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#134e4a]">₱</span>
                <input
                  type="number" min={0} step={1}
                  value={form.gcash_fee_cents / 100}
                  onChange={(e) => set("gcash_fee_cents", Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="w-28 rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]"
                />
                <span className="text-xs text-[#0f766e]">per booking</span>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.gcash_fee_show_breakdown}
                onChange={(e) => set("gcash_fee_show_breakdown", e.target.checked)}
                className="h-4 w-4 rounded border-teal-300"
              />
              <div>
                <p className="text-sm font-medium text-[#134e4a]">Show in booking breakdown</p>
                <p className="text-xs text-[#0f766e]">If off, fee is included in total but not shown as a line item to passengers.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-5 rounded-xl bg-teal-50 p-4 text-sm">
          <p className="text-xs font-semibold uppercase text-[#0c7b93] mb-2">Booking Breakdown Preview — 2 passengers, online</p>
          <div className="space-y-1 text-[#134e4a]">
            <div className="flex justify-between"><span>Passenger 1 (Adult)</span><span>₱XXX</span></div>
            <div className="flex justify-between"><span>Passenger 2 (Adult)</span><span>₱XXX</span></div>
            <div className="flex justify-between border-t border-teal-200 pt-1 mt-1"><span>Fare subtotal</span><span>₱XXX</span></div>
            <div className="flex justify-between text-[#0c7b93]">
              <span>{form.admin_fee_label}</span>
              <span>₱{(form.admin_fee_cents_per_passenger * 2 / 100).toFixed(0)}</span>
            </div>
            {form.gcash_fee_show_breakdown && (
              <div className="flex justify-between text-[#0c7b93]">
                <span>{form.gcash_fee_label}</span>
                <span>₱{(form.gcash_fee_cents / 100).toFixed(0)}</span>
              </div>
            )}
            {!form.gcash_fee_show_breakdown && (
              <p className="text-xs text-amber-600 italic">↑ {form.gcash_fee_label} (₱{(form.gcash_fee_cents / 100).toFixed(0)}) is hidden — included in total silently.</p>
            )}
            <div className="flex justify-between border-t-2 border-teal-300 pt-1 mt-1 font-bold">
              <span>Total</span>
              <span>₱{((form.admin_fee_cents_per_passenger * 2 + form.gcash_fee_cents) / 100).toFixed(0)} + fare</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleSave({
            admin_fee_cents_per_passenger: form.admin_fee_cents_per_passenger,
            gcash_fee_cents: form.gcash_fee_cents,
            admin_fee_label: form.admin_fee_label,
            gcash_fee_label: form.gcash_fee_label,
            admin_fee_applies_walkin: form.admin_fee_applies_walkin,
            gcash_fee_show_breakdown: form.gcash_fee_show_breakdown,
          })}
          disabled={saving}
          className="mt-4 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Platform Fees"}
        </button>
      </div>

      {/* ── Section 2: Fare Discounts ── */}
      <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#134e4a]">🎫 Fare Discounts by Passenger Type</h2>
        <p className="mt-1 text-xs text-[#0f766e]">Discounts on the base fare only. Does not affect platform or processing fees.</p>

        <div className="mt-5 space-y-3">
          {/* Senior */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3">
            <div className="w-32">
              <p className="text-sm font-semibold text-[#134e4a]">👴 Senior Citizen</p>
              <p className="text-xs text-[#0f766e]">60 years old and above</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} step={0.01}
                value={form.senior_discount_percent}
                onChange={(e) => set("senior_discount_percent", parseFloat(e.target.value || "0"))}
                className="w-20 rounded-lg border border-teal-200 px-3 py-2 text-sm text-right outline-none focus:border-[#0c7b93]"
              />
              <span className="text-sm text-[#134e4a]">% off base fare</span>
            </div>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
              Pays {(100 - form.senior_discount_percent).toFixed(0)}% of base fare
            </span>
          </div>

          {/* PWD */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3">
            <div className="w-32">
              <p className="text-sm font-semibold text-[#134e4a]">♿ PWD</p>
              <p className="text-xs text-[#0f766e]">Person with disability</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} step={0.01}
                value={form.pwd_discount_percent}
                onChange={(e) => set("pwd_discount_percent", parseFloat(e.target.value || "0"))}
                className="w-20 rounded-lg border border-teal-200 px-3 py-2 text-sm text-right outline-none focus:border-[#0c7b93]"
              />
              <span className="text-sm text-[#134e4a]">% off base fare</span>
            </div>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
              Pays {(100 - form.pwd_discount_percent).toFixed(0)}% of base fare
            </span>
          </div>

          {/* Child */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3">
            <div className="w-32">
              <p className="text-sm font-semibold text-[#134e4a]">🧒 Child</p>
              <p className="text-xs text-[#0f766e]">Half fare age range</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#134e4a]">
              <span>Ages</span>
              <input type="number" min={0} max={17}
                value={form.child_min_age}
                onChange={(e) => set("child_min_age", parseInt(e.target.value || "0"))}
                className="w-14 rounded-lg border border-amber-200 px-2 py-2 text-center text-sm outline-none focus:border-amber-400"
              />
              <span>to</span>
              <input type="number" min={0} max={17}
                value={form.child_max_age}
                onChange={(e) => set("child_max_age", parseInt(e.target.value || "0"))}
                className="w-14 rounded-lg border border-amber-200 px-2 py-2 text-center text-sm outline-none focus:border-amber-400"
              />
              <span>y/o —</span>
              <input type="number" min={0} max={100} step={0.01}
                value={form.child_discount_percent}
                onChange={(e) => set("child_discount_percent", parseFloat(e.target.value || "0"))}
                className="w-20 rounded-lg border border-amber-200 px-2 py-2 text-right text-sm outline-none focus:border-amber-400"
              />
              <span>% off</span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Ages {form.child_min_age}–{form.child_max_age}: pays {(100 - form.child_discount_percent).toFixed(0)}%
            </span>
          </div>

          {/* Infant */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <div className="w-32">
              <p className="text-sm font-semibold text-[#134e4a]">👶 Infant</p>
              <p className="text-xs text-[#0f766e]">Free/reduced age</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#134e4a]">
              <span>Under</span>
              <input type="number" min={0} max={10}
                value={form.infant_max_age}
                onChange={(e) => set("infant_max_age", parseInt(e.target.value || "0"))}
                className="w-14 rounded-lg border border-emerald-200 px-2 py-2 text-center text-sm outline-none focus:border-emerald-400"
              />
              <span>y/o</span>
              <label className="flex items-center gap-2 ml-2 cursor-pointer">
                <input type="checkbox"
                  checked={form.infant_is_free}
                  onChange={(e) => set("infant_is_free", e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-300"
                />
                <span className="text-sm font-medium text-emerald-700">Free (no charge)</span>
              </label>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${form.infant_is_free ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              Under {form.infant_max_age} y/o: {form.infant_is_free ? "FREE" : "charged normally"}
            </span>
          </div>
        </div>

        {/* Age bracket summary */}
        <div className="mt-4 rounded-xl bg-teal-50 p-3">
          <p className="text-xs font-semibold text-[#0c7b93] mb-2">Age Bracket Summary</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center text-xs">
            <div className="rounded-lg bg-white px-2 py-2">
              <p className="font-semibold text-[#134e4a]">👶 Infant</p>
              <p className="text-[#0f766e]">Under {form.infant_max_age} y/o</p>
              <p className="font-bold text-emerald-600">{form.infant_is_free ? "FREE" : "Full fare"}</p>
            </div>
            <div className="rounded-lg bg-white px-2 py-2">
              <p className="font-semibold text-[#134e4a]">🧒 Child</p>
              <p className="text-[#0f766e]">{form.child_min_age}–{form.child_max_age} y/o</p>
              <p className="font-bold text-amber-600">{(100 - form.child_discount_percent).toFixed(0)}% of fare</p>
            </div>
            <div className="rounded-lg bg-white px-2 py-2">
              <p className="font-semibold text-[#134e4a]">👴 Senior</p>
              <p className="text-[#0f766e]">60+ y/o</p>
              <p className="font-bold text-teal-600">{(100 - form.senior_discount_percent).toFixed(0)}% of fare</p>
            </div>
            <div className="rounded-lg bg-white px-2 py-2">
              <p className="font-semibold text-[#134e4a]">♿ PWD</p>
              <p className="text-[#0f766e]">Any age</p>
              <p className="font-bold text-teal-600">{(100 - form.pwd_discount_percent).toFixed(0)}% of fare</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleSave({
            child_min_age: form.child_min_age,
            child_max_age: form.child_max_age,
            child_discount_percent: form.child_discount_percent,
            infant_max_age: form.infant_max_age,
            infant_is_free: form.infant_is_free,
            senior_discount_percent: form.senior_discount_percent,
            pwd_discount_percent: form.pwd_discount_percent,
          })}
          disabled={saving}
          className="mt-4 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Fare Discounts"}
        </button>
      </div>
    </div>
  );
}
