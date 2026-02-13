"use client";

import { ROUTES } from "@/lib/constants";
import { formatTime } from "@/lib/dashboard/format";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";

type Props = {
  todayTrips: TodayTripForCrew[];
  selectedTripId: string | null;
};

export function CrewCaptainTripSelect({ todayTrips, selectedTripId }: Props) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-4 sm:p-6">
      <label htmlFor="crew-trip-select" className="block text-sm font-semibold text-[#134e4a]">
        Select trip (today, your vessel)
      </label>
      <form method="GET" action={ROUTES.dashboard} className="mt-2">
        <select
          id="crew-trip-select"
          name="tripId"
          defaultValue={selectedTripId ?? ""}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) form.submit();
          }}
          className="w-full max-w-md rounded-lg border border-teal-300 bg-white px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        >
          {todayTrips.length === 0 ? (
            <option value="">No trips today</option>
          ) : (
            todayTrips.map((t) => {
              const label = `${formatTime(t.departure_time)} · ${t.boat?.name ?? "—"}${t.departed ? " (departed)" : ""}`;
              return (
                <option key={t.id} value={t.id}>
                  {label}
                </option>
              );
            })
          )}
        </select>
      </form>
    </div>
  );
}
