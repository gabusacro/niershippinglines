"use client";

import { useState } from "react";
import { ViewBookingsModal } from "./ViewBookingsModal";
import { DeleteTripButton } from "./DeleteTripButton";

export type PastTrip = {
  id: string;
  departure_date: string;
  departure_time: string | null;
  route: { display_name?: string } | null;
};

interface PastTripsTableProps {
  boatId: string;
  trips: PastTrip[];
  confirmedByTrip: Record<string, number>;
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const s = String(t).slice(0, 5);
  const [h, m] = s.split(":");
  const hh = parseInt(h ?? "0", 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m ?? "00"} ${am ? "AM" : "PM"}`;
}

export function PastTripsTable({ boatId, trips, confirmedByTrip }: PastTripsTableProps) {
  const [viewBookingsTrip, setViewBookingsTrip] = useState<{
    id: string;
    routeLabel: string;
    departureDate: string;
    departureTime: string;
  } | null>(null);

  return (
    <>
      <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/50">
        <table className="min-w-full divide-y divide-amber-100 text-sm">
          <thead>
            <tr className="bg-amber-100/50">
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Route</th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Time</th>
              <th className="px-4 py-2 text-right font-semibold text-[#134e4a]">Confirmed</th>
              <th className="px-4 py-2 text-center font-semibold text-[#134e4a]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {trips.map((t) => {
              const route = t.route as { display_name?: string } | null;
              const confirmedCount = confirmedByTrip[t.id] ?? 0;
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-[#134e4a]">{route?.display_name ?? "—"}</td>
                  <td className="px-4 py-2 text-[#134e4a]">{t.departure_date}</td>
                  <td className="px-4 py-2 text-[#134e4a]">{formatTime(t.departure_time)}</td>
                  <td className="px-4 py-2 text-right text-[#134e4a]">
                    {confirmedCount > 0 ? (
                      <span className="font-medium text-amber-700">{confirmedCount} confirmed</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setViewBookingsTrip({
                            id: t.id,
                            routeLabel: route?.display_name ?? "—",
                            departureDate: t.departure_date,
                            departureTime: formatTime(t.departure_time),
                          })
                        }
                        className="rounded px-2 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50"
                      >
                        View
                      </button>
                      <DeleteTripButton boatId={boatId} tripId={t.id} confirmedCount={0} isPastTrip />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {viewBookingsTrip && (
        <ViewBookingsModal
          tripId={viewBookingsTrip.id}
          routeLabel={viewBookingsTrip.routeLabel}
          departureDate={viewBookingsTrip.departureDate}
          departureTime={viewBookingsTrip.departureTime}
          onClose={() => setViewBookingsTrip(null)}
        />
      )}
    </>
  );
}
