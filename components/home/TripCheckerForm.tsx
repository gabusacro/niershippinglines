"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";

type RouteOption = {
  routeId: string;
  routeOrigin: string;
  routeDestination: string;
};

export function TripCheckerForm({
  routes,
  today,
}: {
  routes: RouteOption[];
  today: string;
}) {
  const router = useRouter();
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.routeId ?? "");
  const [date, setDate] = useState(today);

  function handleCheck() {
    const params = new URLSearchParams();
    if (selectedRouteId) params.set("route_id", selectedRouteId);
    if (date) params.set("date", date);
    router.push(`${ROUTES.book}?${params.toString()}`);
  }

  return (
    <div className="mt-6 mx-auto max-w-2xl rounded-2xl border-2 border-teal-200/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm sm:p-5">
      <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">
        🔍 Check available trips
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Route selector */}
        <div className="col-span-2 sm:col-span-2">
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-[#6B8886]">
            Route
          </label>
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="w-full rounded-xl border-2 border-teal-100 bg-[#f8fffe] px-3 py-2.5 text-sm font-bold text-[#134e4a] outline-none focus:border-[#0c7b93]"
          >
            {routes.length === 0 && (
              <option value="">Siargao ↔ Surigao</option>
            )}
            {routes.map((r) => (
              <option key={r.routeId} value={r.routeId}>
                {r.routeOrigin} → {r.routeDestination}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="col-span-1">
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-[#6B8886]">
            Date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border-2 border-teal-100 bg-[#f8fffe] px-3 py-2.5 text-sm font-bold text-[#134e4a] outline-none focus:border-[#0c7b93]"
          />
        </div>

        {/* Check button */}
        <div className="col-span-1 flex items-end">
          <button
            type="button"
            onClick={handleCheck}
            className="w-full rounded-xl bg-[#0c7b93] py-2.5 text-center text-sm font-extrabold text-white transition-colors hover:bg-[#0f766e]"
          >
            Check →
          </button>
        </div>
      </div>
    </div>
  );
}
