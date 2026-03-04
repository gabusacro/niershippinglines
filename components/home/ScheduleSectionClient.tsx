"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VesselScheduleRow, TripSlot } from "@/lib/schedule/get-schedule";
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

// ─── Booking Modal ────────────────────────────────────────────────────────────
function BookingModal({
  trip,
  vesselName,
  today,
  onClose,
}: {
  trip: TripSlot;
  vesselName: string;
  today: string;
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#085C52]/80 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-teal-100 bg-[#f8fffe] px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Book a ferry</p>
            <p className="mt-0.5 font-black text-[#134e4a] leading-tight">{trip.routeDisplayName}</p>
            <p className="text-xs font-semibold text-[#0f766e]">
              {vesselName} · Departs {trip.departureTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-[#134e4a] transition-all hover:bg-teal-200 font-bold text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Trip summary */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🚢</span>
            <div>
              <p className="font-black text-[#134e4a] text-sm">{trip.departureTime}</p>
              <p className="text-xs font-semibold text-[#0f766e]">
                {trip.routeOrigin} → {trip.routeDestination}
              </p>
            </div>
          </div>

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

          {/* Gate pass notice */}
          <div className="flex gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-lg shrink-0">🖨️</span>
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              Print or save your QR ticket on your phone. A separate{" "}
              <strong>gate pass fee</strong> is collected at the port —{" "}
              <strong>not included</strong> in your fare. Prepare cash.
            </p>
          </div>

          {/* CTA */}
          <Link
            href={`${ROUTES.book}?route_id=${encodeURIComponent(trip.routeId)}&date=${encodeURIComponent(selectedDate)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c7b93] py-3.5 text-base font-black text-white shadow-md transition-all hover:bg-[#0f766e] hover:-translate-y-0.5"
          >
            🎫 Continue to booking →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main ScheduleSection client component ────────────────────────────────────
export function ScheduleSectionClient({
  schedule,
  announcements,
  today,
}: {
  schedule: VesselScheduleRow[];
  announcements: AnnouncementDisplay[];
  today: string;
}) {
  const [modalData, setModalData] = useState<{ trip: TripSlot; vesselName: string } | null>(null);

  return (
    <>
      {modalData && (
        <BookingModal
          trip={modalData.trip}
          vesselName={modalData.vesselName}
          today={today}
          onClose={() => setModalData(null)}
        />
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

          {/* Vessel cards — 2 col on desktop, 1 col on mobile */}
          {schedule.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-12 text-center">
              <p className="text-sm font-semibold text-[#0f766e]">No schedule data yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {schedule.map((vessel) => (
                <div
                  key={vessel.vesselId}
                  className="overflow-hidden rounded-2xl border-2 border-teal-100 bg-white shadow-sm transition-all hover:border-[#0c7b93] hover:shadow-md flex flex-col"
                >
                  {/* Big landscape photo */}
                  {vessel.vesselImageUrl ? (
                    <div className="h-44 w-full overflow-hidden">
                      <img
                        src={vessel.vesselImageUrl}
                        alt={vessel.vesselName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-[#085C52] to-[#0c7b93]">
                      <span className="text-6xl">🚢</span>
                    </div>
                  )}

                  {/* Vessel name + Daily badge */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Vessel</p>
                      <p className="font-black text-[#134e4a] text-lg leading-tight">{vessel.vesselName}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                      Daily
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 border-t border-teal-100" />

                  {/* Trip rows */}
                  <div className="flex flex-col divide-y divide-teal-50 flex-1">
                    {vessel.trips.map((trip, i) => (
                      <div
                        key={`${trip.routeId}-${i}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-teal-50/40 transition-colors"
                      >
                        {/* Time */}
                        <span className="shrink-0 w-[72px] text-base font-black text-[#134e4a]">
                          {trip.departureTime}
                        </span>

                        {/* Route */}
                        <span className="flex-1 min-w-0 text-sm font-semibold text-[#0f766e] leading-tight">
                          {trip.routeOrigin}
                          <span className="mx-1 text-[#0c7b93] font-bold">→</span>
                          {trip.routeDestination}
                        </span>

                        {/* Book button */}
                        <button
                          type="button"
                          onClick={() => setModalData({ trip, vesselName: vessel.vesselName })}
                          className="shrink-0 rounded-xl bg-[#0c7b93] px-3.5 py-2 text-xs font-extrabold text-white transition-all hover:bg-[#0f766e] hover:-translate-y-0.5 shadow-sm"
                        >
                          🎫 Book
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bottom padding */}
                  <div className="pb-2" />
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
              <li className="flex items-start gap-2">
                <span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>
                Arrive at the pier at least 30 minutes before departure.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>
                Schedules can change due to weather or sea conditions.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>
                <span>
                  A separate <strong className="text-[#134e4a]">gate pass fee</strong> is
                  collected at the port — not included in your ferry fare. Prepare cash.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0c7b93] mt-0.5 shrink-0">•</span>
                Print your e-ticket or save the QR code on your phone. It will be scanned at the pier.
              </li>
            </ul>
          </div>

        </div>
      </section>
    </>
  );
}
