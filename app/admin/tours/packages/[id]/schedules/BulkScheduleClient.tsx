"use client";

import { useState, useMemo } from "react";

type Pkg = {
  id: string;
  title: string;
  accepts_joiners: boolean;
  accepts_private: boolean;
  accepts_exclusive: boolean;
  exclusive_unit_label: string | null;
  pickup_time_label: string | null;
};

interface Props {
  pkg: Pkg;
  tourId: string;
  onAdded: (count: number) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PatternType = "everyday" | "weekdays" | "weekends" | "custom";

export default function BulkScheduleClient({ pkg, tourId, onAdded }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("bulk");

  // Bulk state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pattern, setPattern] = useState<PatternType>("everyday");
  const [customDays, setCustomDays] = useState<number[]>([1,2,3,4,5]); // Mon-Fri default

  // Shared slot settings
  const [departureTime, setDepartureTime] = useState(
    pkg.pickup_time_label?.match(/(\d+:\d+)\s*(AM|PM)/i)?.[0] ?? "07:45"
  );
  const [joinerSlots, setJoinerSlots] = useState(20);
  const [privateSlots, setPrivateSlots] = useState(1);
  const [exclusiveUnits, setExclusiveUnits] = useState(1);
  const [cutoffHours, setCutoffHours] = useState(24);
  const [notes, setNotes] = useState("");

  // Single date state
  const [singleDate, setSingleDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Compute preview dates
  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate + "T00:00:00");
    const end   = new Date(endDate   + "T00:00:00");
    if (start > end) return [];

    const activeDays = pattern === "everyday" ? [0,1,2,3,4,5,6]
      : pattern === "weekdays" ? [1,2,3,4,5]
      : pattern === "weekends" ? [0,6]
      : customDays;

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end && dates.length < 366) {
      if (activeDays.includes(cur.getDay())) {
        dates.push(cur.toLocaleDateString("en-CA"));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate, pattern, customDays]);

  function toggleCustomDay(day: number) {
    setCustomDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  function formatPreviewDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  async function handleBulkSave() {
    if (previewDates.length === 0) {
      setError("No dates match your selection. Adjust the range or pattern.");
      return;
    }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/admin/tours/schedules/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tour_id: tourId,
          dates: previewDates,
          departure_time: departureTime,
          cutoff_hours: cutoffHours,
          joiner_slots_total: pkg.accepts_joiners ? joinerSlots : 0,
          private_slots_total: pkg.accepts_private ? privateSlots : 0,
          exclusive_units_total: pkg.accepts_exclusive ? exclusiveUnits : 0,
          accepts_joiners: pkg.accepts_joiners,
          accepts_private: pkg.accepts_private,
          accepts_exclusive: pkg.accepts_exclusive,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onAdded(data.created ?? previewDates.length);
      // Reset
      setStartDate(""); setEndDate(""); setNotes(""); setShowPreview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSingleSave() {
    if (!singleDate) { setError("Select a date."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/admin/tours/schedules/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tour_id: tourId,
          dates: [singleDate],
          departure_time: departureTime,
          cutoff_hours: cutoffHours,
          joiner_slots_total: pkg.accepts_joiners ? joinerSlots : 0,
          private_slots_total: pkg.accepts_private ? privateSlots : 0,
          exclusive_units_total: pkg.accepts_exclusive ? exclusiveUnits : 0,
          accepts_joiners: pkg.accepts_joiners,
          accepts_private: pkg.accepts_private,
          accepts_exclusive: pkg.accepts_exclusive,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onAdded(1);
      setSingleDate(""); setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-bold text-[#134e4a]">+ Add Schedule</h2>
        <div className="flex gap-2">
          <button onClick={() => setMode("bulk")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              mode === "bulk" ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-200 text-gray-500 hover:border-emerald-300"
            }`}>
            📅 Bulk / Range
          </button>
          <button onClick={() => setMode("single")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              mode === "single" ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-200 text-gray-500 hover:border-emerald-300"
            }`}>
            + Single Date
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {/* ── BULK MODE ── */}
      {mode === "bulk" && (
        <div className="space-y-5">
          {/* Date range */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range</label>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-400 block mb-1">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div className="text-gray-400 font-bold mt-4">→</div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                  className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          {/* Day pattern */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Day Pattern</label>
            <div className="flex gap-2 flex-wrap mb-3">
              {(["everyday", "weekdays", "weekends", "custom"] as PatternType[]).map(p => (
                <button key={p} onClick={() => setPattern(p)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                    pattern === p ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-200 text-gray-500 hover:border-emerald-300"
                  }`}>
                  {p === "everyday" ? "Every Day" : p === "weekdays" ? "Mon–Fri" : p === "weekends" ? "Sat–Sun" : "Custom"}
                </button>
              ))}
            </div>

            {pattern === "custom" && (
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} onClick={() => toggleCustomDay(i)}
                    className={`w-12 h-10 rounded-xl text-xs font-bold border-2 transition-colors ${
                      customDays.includes(i)
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-200 text-gray-500 hover:border-emerald-300"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {startDate && endDate && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-[#134e4a]">
                  {previewDates.length} date{previewDates.length !== 1 ? "s" : ""} will be created
                </p>
                {previewDates.length > 0 && (
                  <button onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-emerald-600 hover:underline font-semibold">
                    {showPreview ? "Hide" : "Preview dates"}
                  </button>
                )}
              </div>
              {showPreview && previewDates.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 max-h-32 overflow-y-auto">
                  {previewDates.map(d => (
                    <span key={d} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      {formatPreviewDate(d)}
                    </span>
                  ))}
                </div>
              )}
              {previewDates.length === 0 && startDate && endDate && (
                <p className="text-xs text-amber-600">No dates match — adjust your pattern or range.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SINGLE DATE MODE ── */}
      {mode === "single" && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
          <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)}
            className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
      )}

      {/* ── SHARED SETTINGS ── */}
      <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
        <h3 className="text-sm font-bold text-gray-700">Slot Settings</h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Departure Time *</label>
            <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cutoff (hrs before)</label>
            <input type="number" min={1} max={72} value={cutoffHours}
              onChange={e => setCutoffHours(parseInt(e.target.value) || 24)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pkg.accepts_joiners && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">👥 Joiner Slots</label>
              <input type="number" min={1} max={100} value={joinerSlots}
                onChange={e => setJoinerSlots(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
          )}
          {pkg.accepts_private && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">🔒 Private Slots</label>
              <input type="number" min={1} max={20} value={privateSlots}
                onChange={e => setPrivateSlots(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
          )}
          {pkg.accepts_exclusive && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                🚐 Exclusive {pkg.exclusive_unit_label ?? "Units"}
              </label>
              <input type="number" min={1} max={20} value={exclusiveUnits}
                onChange={e => setExclusiveUnits(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Holiday schedule, limited slots"
            className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
      </div>

      {/* Save button */}
      <div className="mt-5 flex justify-end">
        <button
          onClick={mode === "bulk" ? handleBulkSave : handleSingleSave}
          disabled={saving || (mode === "bulk" ? previewDates.length === 0 : !singleDate)}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40 transition-colors">
          {saving ? "Saving..." : mode === "bulk"
            ? `Add ${previewDates.length} Schedule${previewDates.length !== 1 ? "s" : ""}`
            : "Add Schedule"}
        </button>
      </div>
    </div>
  );
}
