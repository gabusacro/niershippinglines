import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { Boat, Sun, Wave } from "@/components/icons";
import { getScheduleFromSupabase } from "@/lib/schedule/get-schedule";
import { getActiveAnnouncements } from "@/lib/announcements/get-announcements";
import { AnnouncementsBlock } from "@/components/announcements/AnnouncementsBlock";
import { VesselThumbnail } from "./VesselThumbnail";
import { getTodayInManila } from "@/lib/admin/ph-time";
import { WeatherWidget } from "@/components/weather/WeatherWidget";

export const metadata = {
  title: "Schedule",
  description: `Ferry Schedule — ${APP_NAME}`,
};

export default async function SchedulePage() {
  const today = getTodayInManila();
  const [schedule, announcements] = await Promise.all([
    getScheduleFromSupabase(),
    getActiveAnnouncements(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-6 sm:mb-8">
        <div className="rounded-full bg-[#0c7b93]/10 p-3 w-fit">
          <Boat size={28} className="text-[#0c7b93]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#134e4a] sm:text-2xl">Ferry Schedule</h1>
          <p className="text-sm text-[#0f766e] sm:text-base">Plan your trip. Times may change — check before you go.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-white/80 shadow-sm overflow-hidden">
        <div className="bg-[#0c7b93]/10 px-4 py-3 sm:px-6 sm:py-4 border-b border-teal-200">
          <h2 className="font-semibold text-[#134e4a] flex items-center gap-2 text-sm sm:text-base">
            <Sun size={20} className="text-[#f59e0b] shrink-0" />
            <span>Departure times by Vessel</span>
          </h2>
          <p className="mt-1 text-xs text-[#0f766e] sm:text-sm">
            Times from live schedule. Book in advance for busy seasons.
          </p>
        </div>

        {schedule.length === 0 ? (
          <div className="px-4 py-8 sm:px-6 text-center text-sm text-[#0f766e]">
            No schedule data yet. Routes and times are set in the admin area.
          </div>
        ) : (
          <ul className="divide-y divide-teal-100">
            {schedule.map((vessel) => (
              <li key={vessel.vesselId} className="px-4 py-4 sm:px-6">
                {/* Vessel header */}
                <div className="flex items-center gap-3 mb-3">
                  {vessel.vesselImageUrl ? (
                    <VesselThumbnail
                      vesselImageUrl={vessel.vesselImageUrl}
                      vesselName={vessel.vesselName}
                      vesselImageUrls={undefined}
                    />
                  ) : (
                    <Wave size={20} className="text-[#0c7b93] shrink-0" />
                  )}
                  <p className="font-semibold text-[#134e4a] text-sm sm:text-base">
                    {vessel.vesselName}
                  </p>
                </div>

                {/* Trip slots */}
                <div className="flex flex-col gap-2 pl-0 sm:pl-9">
                  {vessel.trips.map((trip, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-[#f8fffe] px-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 text-sm font-black text-[#134e4a] w-20">{trip.departureTime}</span>
                        <span className="text-xs font-semibold text-[#0f766e] truncate">
                          {trip.routeOrigin}
                          <span className="mx-1 text-[#0c7b93]">→</span>
                          {trip.routeDestination}
                        </span>
                      </div>
                      <Link
                        href={`${ROUTES.book}?route_id=${encodeURIComponent(trip.routeId)}&date=${encodeURIComponent(today)}`}
                        className="shrink-0 rounded-lg bg-[#0c7b93] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#0f766e] transition-colors"
                      >
                        Book
                      </Link>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {announcements.length > 0 && (
        <div className="mt-8 sm:mt-10">
          <AnnouncementsBlock announcements={announcements} />
        </div>
      )}

      <div className="mt-8 sm:mt-10 rounded-xl bg-[#fef3c7]/50 border border-teal-100 p-4 sm:p-6">
        <h3 className="font-semibold text-[#134e4a]">Good to know</h3>
        <ul className="mt-3 space-y-2 text-sm text-[#0f766e]">
          <li>• Arrive at the pier at least 30 minutes before departure.</li>
          <li>• Schedules can change due to weather or sea conditions. We&apos;ll notify you of any changes.</li>
          <li>• For the latest times and to book, use the <Link href={ROUTES.book} className="font-semibold text-[#0c7b93] hover:underline">Book</Link> page — it shows only available trips.</li>
        </ul>
      </div>

      <div className="mt-8 sm:mt-10">
        <h3 className="font-semibold text-[#134e4a] mb-3">Siargao weather</h3>
        <WeatherWidget />
      </div>

      <div className="mt-8 text-center">
        <Link
          href={ROUTES.book}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors touch-target w-full sm:w-auto"
        >
          <Boat size={18} />
          Book a trip
        </Link>
      </div>
    </div>
  );
}
