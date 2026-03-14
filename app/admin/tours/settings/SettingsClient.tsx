"use client";

import { useState } from "react";
import Link from "next/link";

interface Settings {
  id: number;
  min_age_years: number;
  max_age_years: number;
  minor_requires_guardian: boolean;
  guardian_min_age: number;
  booking_cutoff_hours: number;
  health_declaration_text: string;
  admin_markup_per_pax_cents: number;
  updated_at: string;
}

interface Props {
  settings: Settings;
}

export default function SettingsClient({ settings }: Props) {
  const [minAge, setMinAge] = useState(settings.min_age_years);
  const [maxAge, setMaxAge] = useState(settings.max_age_years);
  const [minorGuardian, setMinorGuardian] = useState(settings.minor_requires_guardian);
  const [guardianMinAge, setGuardianMinAge] = useState(settings.guardian_min_age);
  const [cutoffHours, setCutoffHours] = useState(settings.booking_cutoff_hours);
  const [healthText, setHealthText] = useState(settings.health_declaration_text);
  const [markupPesos, setMarkupPesos] = useState(
    Math.round((settings.admin_markup_per_pax_cents ?? 9900) / 100)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave() {
    setLoading(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/tours/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          min_age_years: minAge,
          max_age_years: maxAge,
          minor_requires_guardian: minorGuardian,
          guardian_min_age: guardianMinAge,
          booking_cutoff_hours: cutoffHours,
          health_declaration_text: healthText,
          admin_markup_per_pax_cents: Math.round(markupPesos * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tour Settings</h1>
        <p className="mt-2 text-sm text-white/90">
          Configure booking rules, age limits, markup pricing, and health declaration text.
        </p>
      </div>

      <div className="mt-4">
        <Link href="/admin/tours" className="text-sm text-emerald-600 hover:underline">
          Back to Tour Management
        </Link>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div className={"mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
          (error ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200")}>
          {error || success}
        </div>
      )}

      <div className="mt-6 space-y-6">

        {/* ── PRICING MARKUP ── */}
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-1">💰 Admin Markup per Pax</h2>
          <p className="text-xs text-gray-400 mb-4">
            This amount is added on top of the tour operator&apos;s price per person.
            Tour operators set their own base price — your markup is added automatically when shown to guests.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Markup Amount (₱ per pax)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500">₱</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={markupPesos}
                  onChange={(e) => setMarkupPesos(parseInt(e.target.value) || 0)}
                  className="w-36 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 font-bold"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Default: ₱99 per person
              </p>
            </div>

            {/* Example calculation */}
            <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 px-5 py-4 min-w-[200px]">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Example</p>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Operator price</span>
                  <span className="font-semibold">₱1,000</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Your markup</span>
                  <span className="font-semibold">+₱{markupPesos.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1 font-bold text-[#134e4a]">
                  <span>Guest pays</span>
                  <span>₱{(1000 + markupPesos).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold mt-1">
                  <span>You earn (10 pax)</span>
                  <span>₱{(markupPesos * 10).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOOKING RULES ── */}
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Booking Rules</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Booking Cutoff (hours before tour)
              </label>
              <input
                type="number"
                min={1}
                max={72}
                value={cutoffHours}
                onChange={(e) => setCutoffHours(parseInt(e.target.value) || 24)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Customers cannot book within {cutoffHours} hour{cutoffHours !== 1 ? "s" : ""} of tour departure.
              </p>
            </div>
          </div>
        </div>

        {/* ── AGE REQUIREMENTS ── */}
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Age Requirements</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Minimum Age</label>
              <input
                type="number"
                min={1}
                max={18}
                value={minAge}
                onChange={(e) => setMinAge(parseInt(e.target.value) || 6)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Maximum Age</label>
              <input
                type="number"
                min={18}
                max={100}
                value={maxAge}
                onChange={(e) => setMaxAge(parseInt(e.target.value) || 65)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMinorGuardian(!minorGuardian)}
                  className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                    (minorGuardian ? "bg-emerald-500" : "bg-gray-200")}>
                  <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow " +
                    (minorGuardian ? "translate-x-6" : "translate-x-1")} />
                </button>
                <label className="text-sm font-semibold text-gray-700">
                  Minors require a guardian
                </label>
              </div>
              {minorGuardian && (
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Guardian Minimum Age
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={30}
                    value={guardianMinAge}
                    onChange={(e) => setGuardianMinAge(parseInt(e.target.value) || 18)}
                    className="w-40 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── HEALTH DECLARATION ── */}
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-1">Health Declaration Text</h2>
          <p className="text-xs text-gray-400 mb-3">
            This text appears on the booking form and customers must accept it before confirming.
          </p>
          <textarea
            rows={6}
            value={healthText}
            onChange={(e) => setHealthText(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{healthText.length} characters</p>
        </div>

        {/* Last updated */}
        <p className="text-xs text-gray-400 text-center">
          Last updated: {new Date(settings.updated_at).toLocaleDateString("en-PH", {
            month: "long", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          })}
        </p>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg">
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
