"use client";

import { useState, useMemo, useRef } from "react";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { getDayLabel, formatTime } from "@/lib/dashboard/format";
import { BookingModal } from "@/app/dashboard/BookingModal";

/** Unique dates from trips (sorted). Shows all dates that have scheduled vessels. */
function getTripDates(trips: UpcomingTripRow[]): string[] {
  const dates = [...new Set(trips.map((t) => t.departure_date))];
  return dates.sort();
}

export function TripCalendar({
  trips,
  loggedInEmail = "",
  passengerName,
  loggedInAddress = "",
}: {
  trips: UpcomingTripRow[];
  loggedInEmail?: string;
  passengerName?: string;
  loggedInAddress?: string;
}) {
  const tripDates = useMemo(() => getTripDates(trips), [trips]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingTrip, setBookingTrip] = useState<UpcomingTripRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, UpcomingTripRow[]>();
    for (const t of trips) {
      const d = t.departure_date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return map;
  }, [trips]);

  /** Direction label per trip: same logic as Book form and manual booking — group by route+date, sort by time; first = origin→destination, second = destination→origin. */
  const getDirectionLabel = useMemo(() => {
    const groupKey = (t: UpcomingTripRow) => `${t.route?.id ?? ""}-${t.departure_date ?? ""}`;
    const byGroup = new Map<string, UpcomingTripRow[]>();
    for (const t of trips) {
      const k = groupKey(t);
      if (!byGroup.has(k)) byGroup.set(k, []);
      byGroup.get(k)!.push(t);
    }
    for (const arr of byGroup.values()) {
      arr.sort((a, b) => (a.departure_time ?? "").localeCompare(b.departure_time ?? ""));
    }
    return (t: UpcomingTripRow): string => {
      const r = t.route;
      const origin = r?.origin ?? "";
      const destination = r?.destination ?? "";
      if (!origin && !destination) return t.route?.display_name ?? "—";
      const group = byGroup.get(groupKey(t)) ?? [];
      const idx = group.findIndex((x) => x.id === t.id);
      if (idx === 0) return `${origin} → ${destination}`;
      if (idx === 1) return `${destination} → ${origin}`;
      return `${origin} → ${destination}`;
    };
  }, [trips]);

  const selectedTrips = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const selectedLabel = selectedDate ? getDayLabel(selectedDate) : null;

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el || !el.children[index]) return;
    (el.children[index] as HTMLElement).scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  };

  const currentIndex = tripDates.findIndex((d) => d === selectedDate || d === today);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < tripDates.length - 1;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[#134e4a]">Scheduled trips</h2>
      <p className="mt-1 text-sm text-[#0f766e]">Click a day to see times and seats. Swipe or use arrows to browse dates.</p>

      {/* Date carousel — 3 cards visible, swipe/scroll for more */}
      <div className="relative mt-4">
        {canGoPrev && (
          <button
            type="button"
            onClick={() => scrollToIndex(safeIndex - 1)}
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-md border border-teal-200 text-[#0c7b93] hover:bg-[#0c7b93]/10"
            aria-label="Previous date"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {canGoNext && (
          <button
            type="button"
            onClick={() => scrollToIndex(safeIndex + 1)}
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-md border border-teal-200 text-[#0c7b93] hover:bg-[#0c7b93]/10"
            aria-label="Next date"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth scrollbar-hide"
          role="region"
          aria-label="Date selection"
        >
          {tripDates.map((dateStr) => {
            const dayTrips = byDate.get(dateStr) ?? [];
            const label = getDayLabel(dateStr);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const tripCount = dayTrips.length;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate((prev) => (prev === dateStr ? null : dateStr))}
                className={`flex flex-shrink-0 flex-[0_0_calc(33.333%-6px)] min-w-[96px] max-w-[130px] flex-col items-center rounded-xl border-2 px-2 py-3 text-center transition-all snap-center touch-manipulation min-h-[44px] sm:py-4 ${
                  isSelected
                    ? "border-[#0c7b93] bg-[#0c7b93] text-white shadow-md"
                    : isToday
                    ? "border-[#0c7b93] bg-[#0c7b93]/10 text-[#134e4a] hover:bg-[#0c7b93]/20"
                    : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93] hover:bg-[#0c7b93]/5"
                }`}
              >
                <span className="text-xs font-medium opacity-90 sm:text-sm">{label}</span>
                <span className="mt-1 text-lg font-bold sm:text-xl">
                  {new Date(dateStr + "Z").getDate()}
                </span>
                {tripCount > 0 && (
                  <span className={`mt-1 text-xs ${isSelected ? "opacity-90" : "text-[#0f766e]"}`}>
                    {tripCount} trip{tripCount !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day — times and seats (only after a date is clicked) */}
      {tripDates.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/30 p-8 text-center">
          <p className="text-sm font-medium text-[#134e4a]">No scheduled trips in the next 60 days</p>
          <p className="mt-1 text-xs text-[#0f766e]">Trips will appear here once vessels are scheduled.</p>
        </div>
      ) : selectedDate === null ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/30 p-8 text-center">
          <p className="text-sm font-medium text-[#134e4a]">Click a date above to see trips for that day</p>
          <p className="mt-1 text-xs text-[#0f766e]">Browse dates with scheduled trips</p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-teal-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-base font-bold text-[#134e4a]">{selectedLabel}</h3>
          <p className="text-xs text-[#0f766e] sm:text-sm">
            {new Date(selectedDate + "Z").toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {selectedTrips.length === 0 ? (
            <p className="mt-4 text-sm text-[#0f766e]">No scheduled trips on this day.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {selectedTrips.map((t) => {
                const ob = t.online_booked ?? 0;
                const wb = t.walk_in_booked ?? 0;
                const capacity = (t.boat as { capacity?: number })?.capacity ?? (t.online_quota ?? 0) + (t.walk_in_quota ?? 0);
                const available = Math.max(0, capacity - ob - wb);
                const directionLabel = getDirectionLabel(t);
                const vesselName = t.boat?.name ?? "—";
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-[#fef9e7]/30 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#134e4a]">{formatTime(t.departure_time)}</p>
                      <p className="text-sm text-[#0f766e]">
                        {vesselName} · {directionLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-[#0f766e]">
                        {available} seat{available !== 1 ? "s" : ""} left
                      </span>
                      <button
                        type="button"
                        onClick={() => setBookingTrip(t)}
                        className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
                      >
                        Book
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {bookingTrip && (
        <BookingModal
          trip={bookingTrip}
          onClose={() => setBookingTrip(null)}
          loggedInEmail={loggedInEmail}
          passengerName={passengerName}
          loggedInAddress={loggedInAddress}
        />
      )}
    </section>
  );
}
