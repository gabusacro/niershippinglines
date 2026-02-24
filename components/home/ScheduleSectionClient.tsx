"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ScheduleRow } from "@/lib/schedule/get-schedule";
import type { AnnouncementDisplay } from "@/lib/announcements/get-announcements";
import { ROUTES } from "@/lib/constants";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Booking Modal ──────────────────────────────────────────────────────────
function BookingModal({
  route,
  today,
  onClose,
}: {
  route: ScheduleRow;
  today: string;
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#085C52]/80 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-teal-100 bg-[#f8fffe] px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Book a ferry</p>
            <p className="mt-0.5 font-black text-[#134e4a] leading-tight">{route.routeDisplayName}</p>
            {route.vesselName && <p className="text-xs font-semibold text-[#0f766e]">{route.vesselName}</p>}
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-[#134e4a] transition-all hover:bg-teal-200 font-bold">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date picker */}
          <div>
            <label className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-[#6B8886]">
              Travel date
            </label>
            <input
              type="date"
              value={selectedDate}
              min={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border-2 border-teal-100 bg-[#f8fffe] px-4 py-3 font-bold text-[#134e4a] outline-none focus:border-[#0c7b93]"
              style={{ fontFamily: "inherit" }}
            />
          </div>

          {/* Departure times */}
          <div>
            <label className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-[#6B8886]">
              Departure times
            </label>
            <div className="flex flex-col gap-2">
              {(route.timesWithDirection ?? route.times.map((t) => ({ time: t, directionLabel: t }))).map((tw, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-teal-100 bg-[#f8fffe] px-3 py-2.5">
                  <span className="min-w-[76px] text-base font-black text-[#134e4a]">{tw.time}</span>
                  <span className="text-[#0c7b93] font-bold">→</span>
                  <span className="text-sm font-semibold text-[#0f766e] leading-tight">{tw.directionLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gate pass notice */}
          <div className="flex gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-lg shrink-0">🖨️</span>
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              Print or save your QR ticket on your phone. A separate <strong>gate pass fee</strong> is collected at the port — this is <strong>not included</strong> in your fare. Please prepare cash.
            </p>
          </div>

          {/* CTA */}
          <Link
            href={`${ROUTES.book}?route_id=${encodeURIComponent(route.routeId)}&date=${encodeURIComponent(selectedDate)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c7b93] py-3.5 text-base font-black text-white shadow-md transition-all hover:bg-[#0f766e] hover:-translate-y-0.5"
          >
            🎫 Continue to booking →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main ScheduleSection client component ──────────────────────────────────
export function ScheduleSectionClient({
  schedule,
  announcements,
  today,
}: {
  schedule: ScheduleRow[];
  announcements: AnnouncementDisplay[];
  today: string;
}) {
  const [modalRoute, setModalRoute] = useState<ScheduleRow | null>(null);

  return (
    <>
      {modalRoute && (
        <BookingModal route={modalRoute} today={today} onClose={() => setModalRoute(null)} />
      )}

      <section id="schedule" className="border-t border-teal-200/50 bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Live schedule</p>
              <h2 className="mt-1 text-2xl font-black text-[#134e4a] sm:text-3xl">🗓 Ferry departure times</h2>
              <p className="mt-1 text-sm font-semibold text-[#0f766e]">
                Real vessel schedules — times may change due to weather
              </p>
            </div>
            <Link
              href={ROUTES.book}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[#0f766e] hover:-translate-y-0.5"
            >
              🚢 Book a Trip
            </Link>
          </div>

          {/* Vessel cards */}
          {schedule.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-12 text-center">
              <p className="text-sm font-semibold text-[#0f766e]">No schedule data yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {schedule.map((row) => (
                <div
                  key={row.routeId}
                  className="overflow-hidden rounded-2xl border-2 border-teal-100 bg-white shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md"
                >
                  {/* Vessel photo */}
                  {row.vesselImageUrl ? (
                    <div className="h-36 w-full overflow-hidden">
                      <img src={row.vesselImageUrl} alt={row.vesselName ?? "Vessel"}
                        className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-[#085C52] to-[#0c7b93]">
                      <span className="text-5xl">🚢</span>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        {row.vesselName && (
                          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">
                            {row.vesselName}
                          </p>
                        )}
                        <p className="mt-0.5 font-black text-[#134e4a] leading-tight">{row.routeDisplayName}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                        Daily
                      </span>
                    </div>

                    {/* Times */}
                    <div className="flex flex-col gap-2">
                      {(row.timesWithDirection ?? row.times.map((t) => ({ time: t, directionLabel: t }))).map((tw, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-teal-100 bg-[#f8fffe] px-3 py-2.5">
                          <span className="min-w-[72px] text-base font-black text-[#134e4a]">{tw.time}</span>
                          <span className="text-[#0c7b93] font-bold">→</span>
                          <span className="text-sm font-semibold text-[#0f766e] leading-tight">{tw.directionLabel}</span>
                        </div>
                      ))}
                    </div>

                    {/* Book button — opens modal */}
                    <div className="mt-4 pt-3 border-t border-teal-100">
                      <button
                        type="button"
                        onClick={() => setModalRoute(row)}
                        className="block w-full rounded-xl bg-[#0c7b93] py-2.5 text-center text-sm font-extrabold text-white transition-all hover:bg-[#0f766e] hover:-translate-y-0.5"
                      >
                        🎫 Book this vessel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <p className="text-xs font-extrabold uppercase tracking-widest text-red-600">
                  Live updates & announcements
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {announcements.map((a) => (
                  <div key={a.id} className="flex gap-3 rounded-xl border-2 border-red-100 bg-red-50 px-4 py-3">
                    <span className="text-lg shrink-0">⚠️</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-800 leading-snug">{a.message}</p>
                      <p className="mt-1 text-xs font-semibold text-red-400">
                        {a.vesselName ? `${a.vesselName} · ` : ""}{formatRelativeTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Good to know */}
          <div className="mt-6 rounded-2xl border-2 border-teal-100 bg-teal-50/60 p-5">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">📋 Good to know</p>
            <ul className="flex flex-col gap-2 text-sm font-semibold text-[#0f766e]">
              <li className="flex items-start gap-2"><span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>Arrive at the pier at least 30 minutes before departure.</li>
              <li className="flex items-start gap-2"><span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>Schedules can change due to weather or sea conditions.</li>
              <li className="flex items-start gap-2"><span className="text-[#0c7b93] mt-0.5 shrink-0">•</span><span>A separate <strong className="text-[#134e4a]">gate pass fee</strong> is collected at the port — not included in your ferry fare. Prepare cash.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>Print your e-ticket or save the QR code on your phone. It will be scanned at the pier.</li>
            </ul>
          </div>

        </div>
      </section>
    </>
  );
}
