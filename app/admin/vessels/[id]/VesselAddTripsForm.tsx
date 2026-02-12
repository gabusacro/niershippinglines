"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

interface RouteOption {
  id: string;
  display_name: string;
  origin?: string;
  destination?: string;
}

interface PortOption {
  id: string;
  name: string;
}

interface VesselAddTripsFormProps {
  boatId: string;
  routes: RouteOption[];
  ports: PortOption[];
}

export default function VesselAddTripsForm({ boatId, routes, ports }: VesselAddTripsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [routeId, setRouteId] = useState("");
  const [portId, setPortId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const selectedRoute = routes.find((r) => r.id === routeId);
  const isDinagatRoute =
    selectedRoute?.origin === "Dinagat" || selectedRoute?.destination === "Dinagat";
  const mustSelectPort = isDinagatRoute && ports.length > 0;

  const [scheduleTimes, setScheduleTimes] = useState<{ departure_time: string; label: string }[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  useEffect(() => {
    if (!routeId) {
      setScheduleTimes([]);
      return;
    }
    setLoadingTimes(true);
    fetch(`/api/admin/schedule-slots?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        setScheduleTimes(Array.isArray(data?.times) ? data.times : []);
        setLoadingTimes(false);
      })
      .catch(() => {
        setScheduleTimes([]);
        setLoadingTimes(false);
      });
  }, [routeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!routeId || !startDate || !endDate) {
      setMessage({ type: "err", text: "Select route, start date, and end date." });
      return;
    }
    if (mustSelectPort && !portId) {
      setMessage({ type: "err", text: "For Dinagat routes, select which port (Loreto, Valencia, or San Jose)." });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setMessage({ type: "err", text: "Start date must be on or before end date." });
      return;
    }
    setSubmitting(true);
    try {
      const body: { route_id: string; start_date: string; end_date: string; port_id?: string } = {
        route_id: routeId,
        start_date: startDate,
        end_date: endDate,
      };
      if (portId) body.port_id = portId;

      const res = await fetch(`/api/admin/vessels/${boatId}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to create trips." });
        return;
      }
      const created = data.created ?? 0;
      setMessage({ type: "ok", text: data.message ?? `Created ${created} trip(s).` });
      toast.showSuccess(`Created ${created} trip(s) successfully`);
      setStartDate("");
      setEndDate("");
      setPortId("");
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-[#fef9e7]/30 p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-[#134e4a]">Add more trips (another route & date range)</h3>
      <p className="mt-1 text-sm text-[#0f766e]">
        Same idea as above: pick a route (one direction) and date range. Use this to add the <strong>return leg</strong> (e.g. Siargao → Surigao for the same period) or another period. Times shown are <strong>departures from that route&apos;s origin only</strong>—return times belong on the return route in Admin → Schedule. For Dinagat ↔ Surigao, choose port. Duplicates are skipped.
      </p>

      {routeId && selectedRoute && (
        <div className="mt-4 rounded-lg border border-teal-200 bg-white/80 px-4 py-3">
          <p className="text-sm font-medium text-[#134e4a] mb-1">
            Departures <strong>from {selectedRoute.origin}</strong> only ({selectedRoute.origin} → {selectedRoute.destination})
          </p>
          {loadingTimes ? (
            <p className="text-sm text-[#0f766e]">Loading times…</p>
          ) : scheduleTimes.length === 0 ? (
            <p className="text-sm text-amber-700">No times set. In Admin → Schedule, add times when the boat leaves {selectedRoute.origin} for {selectedRoute.destination}. The return from {selectedRoute.destination} to {selectedRoute.origin} (e.g. 11:30 AM) is set on the other route.</p>
          ) : (
            <>
              <p className="text-sm text-[#0f766e]">
                Trips will be created at: <strong>{scheduleTimes.map((t) => t.label).join(", ")}</strong>
              </p>
              <p className="text-xs text-[#0f766e] mt-2">
                These are times the boat leaves {selectedRoute.origin}. E.g. {scheduleTimes[0]?.label ?? "5:30 AM"} departs {selectedRoute.origin} to {selectedRoute.destination}; the return from {selectedRoute.destination} to {selectedRoute.origin} (e.g. 11:30 AM) is set on the route &quot;{selectedRoute.destination} → {selectedRoute.origin}&quot; in Admin → Schedule.
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-[#134e4a] mb-1">Route (one direction)</label>
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setPortId("");
            }}
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            required
          >
            <option value="">Select route</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.display_name || `${r.origin} → ${r.destination}`}</option>
            ))}
          </select>
        </div>
        {isDinagatRoute && ports.length > 0 && (
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-[#134e4a] mb-1">Dinagat port</label>
            <select
              value={portId}
              onChange={(e) => setPortId(e.target.value)}
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              required={mustSelectPort}
            >
              <option value="">Select port</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-[#134e4a] mb-1">Start date</label>
          <input
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#134e4a] mb-1">End date</label>
          <input
            type="date"
            min={today}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || routes.length === 0 || (routeId && scheduleTimes.length === 0)}
          className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create trips"}
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.type === "ok" ? "text-[#0f766e]" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
