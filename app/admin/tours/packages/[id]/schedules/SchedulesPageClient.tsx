"use client";

import { useState } from "react";
import Link from "next/link";
import BulkScheduleClient from "./BulkScheduleClient";

type Schedule = {
  id: string;
  available_date: string;
  departure_time: string | null;
  status: string;
  notes: string | null;
  accepts_joiners: boolean;
  joiner_slots_total: number;
  joiner_slots_booked: number;
  accepts_private: boolean;
  private_slots_total: number;
  private_slots_booked: number;
  accepts_exclusive: boolean;
  exclusive_units_total: number;
  exclusive_units_booked: number;
};

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
  initialSchedules: Schedule[];
  today: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function SchedulesPageClient({ pkg, tourId, initialSchedules, today }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const upcoming = schedules.filter(s => s.available_date >= today && s.status !== "cancelled");
  const past     = schedules.filter(s => s.available_date < today || s.status === "cancelled");

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function handleAdded(count: number) {
    showToast("success", `✅ ${count} schedule${count !== 1 ? "s" : ""} added! Refreshing...`);
    // Reload page to get fresh schedules from DB
    setTimeout(() => window.location.reload(), 1200);
  }

  async function handleCancel(scheduleId: string) {
    if (!confirm("Cancel this schedule date?")) return;
    setCancelling(scheduleId);
    try {
      const res = await fetch("/api/admin/tours/schedules/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId, tour_id: tourId }),
      });
      if (res.ok) {
        setSchedules(prev => prev.map(s =>
          s.id === scheduleId ? { ...s, status: "cancelled" } : s
        ));
        showToast("success", "Schedule cancelled.");
      } else {
        showToast("error", "Failed to cancel.");
      }
    } finally {
      setCancelling(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">📅 Schedules</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pkg.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            {upcoming.length} upcoming
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold border ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-600"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Bulk schedule generator */}
      <BulkScheduleClient pkg={pkg} tourId={tourId} onAdded={handleAdded} />

      {/* Upcoming schedules */}
      <div className="mb-6">
        <h2 className="font-bold text-[#134e4a] mb-3">
          Upcoming Schedules
          <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
        </h2>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
            <p className="font-semibold">No upcoming schedules</p>
            <p className="text-sm mt-1">Use the generator above to add dates.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => (
              <div key={s.id}
                className="rounded-xl border-2 border-gray-100 bg-white px-5 py-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-[#134e4a]">{formatDate(s.available_date)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      s.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {s.status.toUpperCase()}
                    </span>
                    {s.departure_time && (
                      <span className="text-xs text-gray-400">🕐 {s.departure_time.slice(0, 5)}</span>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{s.notes}</p>}
                </div>

                {/* Slots */}
                <div className="flex gap-3 flex-wrap">
                  {s.accepts_joiners && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-center min-w-[80px]">
                      <div className="text-xs font-medium text-emerald-600 mb-0.5">👥 Joiners</div>
                      <div className="text-lg font-bold text-emerald-800">
                        {s.joiner_slots_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.joiner_slots_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.joiner_slots_total - s.joiner_slots_booked} left</div>
                    </div>
                  )}
                  {s.accepts_private && (
                    <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-center min-w-[80px]">
                      <div className="text-xs font-medium text-teal-600 mb-0.5">🔒 Private</div>
                      <div className="text-lg font-bold text-teal-800">
                        {s.private_slots_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.private_slots_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.private_slots_total - s.private_slots_booked} left</div>
                    </div>
                  )}
                  {s.accepts_exclusive && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-center min-w-[80px]">
                      <div className="text-xs font-medium text-blue-600 mb-0.5">🚐 Exclusive</div>
                      <div className="text-lg font-bold text-blue-800">
                        {s.exclusive_units_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.exclusive_units_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.exclusive_units_total - s.exclusive_units_booked} left</div>
                    </div>
                  )}
                </div>

                {/* Cancel */}
                {s.status === "open" && (
                  <button
                    onClick={() => handleCancel(s.id)}
                    disabled={cancelling === s.id}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                    {cancelling === s.id ? "..." : "Cancel"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past schedules */}
      {past.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-400 mb-3 text-sm uppercase tracking-wider">
            Past / Cancelled ({past.length})
          </h2>
          <div className="space-y-2">
            {past.slice(0, 10).map(s => (
              <div key={s.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-4 opacity-60">
                <div className="font-medium text-gray-600 text-sm">{formatDate(s.available_date)}</div>
                {s.accepts_joiners && (
                  <span className="text-xs text-gray-400">👥 {s.joiner_slots_booked}/{s.joiner_slots_total}</span>
                )}
                {s.accepts_private && (
                  <span className="text-xs text-gray-400">🔒 {s.private_slots_booked}/{s.private_slots_total}</span>
                )}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${
                  s.status === "cancelled" ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>{s.status}</span>
              </div>
            ))}
            {past.length > 10 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{past.length - 10} older schedules hidden</p>
            )}
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mt-8">
        <Link href={`/admin/tours/packages/${tourId}`}
          className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Package
        </Link>
      </div>
    </>
  );
}
