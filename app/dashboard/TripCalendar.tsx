"use client";

import { useState, useMemo, useRef } from "react";
import { Ship, Users, Ticket, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { getDayLabel, getDayOfMonth, parseDateString, formatTime } from "@/lib/dashboard/format";
import { BookingModal } from "@/app/dashboard/BookingModal";

function getTripDates(trips: UpcomingTripRow[]): string[] {
  const dates = [...new Set(trips.map((t) => t.departure_date).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)))];
  return dates.sort();
}

export function TripCalendar({
  trips,
  loggedInEmail = "",
  passengerName,
  loggedInAddress = "",
  loggedInGender = "",
  loggedInBirthdate = "",
  loggedInNationality = "",
}: {
  trips: UpcomingTripRow[];
  loggedInEmail?: string;
  passengerName?: string;
  loggedInAddress?: string;
  loggedInGender?: string;
  loggedInBirthdate?: string;
  loggedInNationality?: string;
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
    <section>
      <h2 className="text-base font-bold text-[#134e4a]">Scheduled trips</h2>
      <p className="mt-0.5 text-xs text-[#0f766e]">Click a day to see times and seats. Swipe or use arrows to browse dates.</p>

      {/* Date strip */}
      <div className="relative mt-4">
        {canGoPrev && (
          <button
            type="button"
            onClick={() => scrollToIndex(safeIndex - 1)}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-teal-200 text-[#0c7b93] hover:bg-teal-50 transition-colors"
            aria-label="Previous date"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canGoNext && (
          <button
            type="button"
            onClick={() => scrollToIndex(safeIndex + 1)}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-teal-200 text-[#0c7b93] hover:bg-teal-50 transition-colors"
            aria-label="Next date"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth scrollbar-hide px-1"
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
                className={`flex flex-shrink-0 flex-[0_0_calc(33.333%-6px)] min-w-[80px] max-w-[110px] flex-col items-center rounded-xl border-2 px-2 py-3 text-center transition-all snap-center touch-manipulation ${
                  isSelected
                    ? "border-[#0c4a6e] bg-gradient-to-b from-[#0c4a6e] to-[#0891b2] text-white shadow-md"
                    : isToday
                    ? "border-[#0c7b93] bg-[#0c7b93]/10 text-[#134e4a] hover:bg-[#0c7b93]/20"
                    : "border-teal-100 bg-white text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50 shadow-sm"
                }`}
              >
                <span className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? "text-white/70" : "text-[#6B8886]"}`}>
                  {label}
                </span>
                <span className="mt-1 text-xl font-extrabold leading-none">
                  {getDayOfMonth(dateStr) ?? "—"}
                </span>
                {tripCount > 0 && (
                  <span className={`mt-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isSelected ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                  }`}>
                    {tripCount} trip{tripCount !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trip list area */}
      {tripDates.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/30 p-8 text-center">
          <Ship className="mx-auto h-8 w-8 text-teal-300 mb-2" />
          <p className="text-sm font-semibold text-[#134e4a]">No scheduled trips in the next 60 days</p>
          <p className="mt-1 text-xs text-[#0f766e]">Trips will appear here once vessels are scheduled.</p>
        </div>
      ) : selectedDate === null ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/30 p-8 text-center">
          <Ticket className="mx-auto h-8 w-8 text-teal-300 mb-2" />
          <p className="text-sm font-semibold text-[#134e4a]">Click a date above to see trips for that day</p>
          <p className="mt-1 text-xs text-[#0f766e]">Browse dates with scheduled trips</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-sm">
          {/* Selected date header */}
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#134e4a]">{selectedLabel}</h3>
            <p className="text-xs text-[#0f766e]">
              {(() => {
                const d = parseDateString(selectedDate);
                if (!d) return selectedDate;
                const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
              })()}
            </p>
          </div>

          {/* Legend */}
          <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5 text-xs text-[#0f766e] space-y-1">
            <div className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 flex-shrink-0" />
              <span><strong>Online seats</strong> = slots reserved for online booking (limited by design)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ship className="h-3.5 w-3.5 flex-shrink-0" />
              <span><strong>Vessel capacity</strong> = total passengers the boat can carry (walk-in seats may be available at the pier)</span>
            </div>
          </div>

          {selectedTrips.length === 0 ? (
            <p className="text-sm text-[#0f766e]">No scheduled trips on this day.</p>
          ) : (
            <ul className="space-y-3">
              {selectedTrips.map((t) => {
                const onlineQuota   = t.online_quota  ?? 0;
                const onlineBooked  = t.online_booked ?? 0;
                const onlineLeft    = Math.max(0, onlineQuota - onlineBooked);
                const vesselCapacity = (t.boat as { capacity?: number })?.capacity ?? null;
                const isFull        = onlineLeft === 0;
                const directionLabel = getDirectionLabel(t);
                const vesselName    = t.boat?.name ?? "—";

                return (
                  <li
                    key={t.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                      isFull
                        ? "border-slate-200 bg-slate-50"
                        : "border-teal-200 bg-white shadow-sm hover:shadow-md hover:border-teal-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Time */}
                      <p className="text-lg font-extrabold text-[#0c4a6e] leading-none tracking-tight">
                        {formatTime(t.departure_time)}
                      </p>
                      {/* Vessel + Route */}
                      <div className="flex items-center gap-1.5">
                        <Ship className="h-3.5 w-3.5 text-[#6B8886] flex-shrink-0" />
                        <p className="text-xs text-[#6B8886]">{vesselName}</p>
                        <span className="text-[#6B8886] opacity-40">·</span>
                        <p className="text-xs font-semibold text-[#134e4a]">{directionLabel}</p>
                      </div>

                      {/* Seat badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isFull ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            Full — Online booking closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <Ticket className="h-3 w-3" />
                            {onlineLeft} of {onlineQuota} online seat{onlineQuota !== 1 ? "s" : ""} left
                          </span>
                        )}
                        {vesselCapacity && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            <Users className="h-3 w-3" />
                            {vesselCapacity} capacity
                          </span>
                        )}
                      </div>

                      {isFull && (
                        <p className="text-xs text-[#0f766e]">Walk-in tickets may be available at the pier.</p>
                      )}
                    </div>

                    {/* Book button — always visible, dark solid background */}
                    {!isFull && (
                      <button
                        type="button"
                        onClick={() => setBookingTrip(t)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#0c4a6e] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0891b2] transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Book
                      </button>
                    )}
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
          loggedInGender={loggedInGender}
          loggedInBirthdate={loggedInBirthdate}
          loggedInNationality={loggedInNationality}
        />
      )}
    </section>
  );
}
