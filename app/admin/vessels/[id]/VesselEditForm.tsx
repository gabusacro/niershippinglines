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

interface VesselEditFormProps {
  boatId: string;
  initialName: string;
  initialCapacity: number;
  initialOnlineQuota: number;
  initialStatus: string;
  initialImageUrl?: string | null;
  assignments: { id: string; profile_id: string; assignment_role: string }[];
  routes: RouteOption[];
  ports: PortOption[];
}

export default function VesselEditForm({
  boatId,
  initialName,
  initialCapacity,
  initialOnlineQuota,
  initialStatus,
  initialImageUrl,
  assignments,
  routes,
  ports,
}: VesselEditFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [onlineQuota, setOnlineQuota] = useState(initialOnlineQuota);
  const [status, setStatus] = useState(initialStatus);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [routeId, setRouteId] = useState("");
  const [portId, setPortId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    setSaving(true);
    try {
      const patchRes = await fetch(`/api/admin/vessels/${boatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          capacity,
          online_quota: onlineQuota,
          status,
          image_url: imageUrl.trim() || null,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        setError(patchData.error ?? "Failed to save vessel.");
        return;
      }

      const hasSchedule = routeId && startDate && endDate && (!mustSelectPort || portId);
      if (hasSchedule) {
        if (new Date(startDate) > new Date(endDate)) {
          setError("Start date must be on or before end date.");
          return;
        }
        const body: { route_id: string; start_date: string; end_date: string; port_id?: string } = {
          route_id: routeId,
          start_date: startDate,
          end_date: endDate,
        };
        if (portId) body.port_id = portId;

        const tripsRes = await fetch(`/api/admin/vessels/${boatId}/trips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const tripsData = await tripsRes.json();
        if (!tripsRes.ok) {
          setError(tripsData.error ?? "Failed to create trips.");
          return;
        }
      }

      toast.showSuccess("Vessel details saved successfully");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-teal-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-[#134e4a]">Vessel details</h2>
        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Vessel name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Passenger capacity</label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Online quota</label>
          <input
            type="number"
            min={0}
            value={onlineQuota}
            onChange={(e) => setOnlineQuota(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="running">Running</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Image URL (optional)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            placeholder="https://… (vessel photo for schedule & ticket)"
          />
          {imageUrl && (
            <p className="mt-1 text-xs text-[#0f766e]">Preview:</p>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Vessel"
              className="mt-0.5 h-16 w-24 rounded object-cover border border-teal-200"
            />
          )}
        </div>
        {assignments.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#134e4a]">Assigned</p>
            <ul className="mt-1 text-sm text-[#0f766e]">
              {assignments.map((a) => (
                <li key={a.id}>{a.assignment_role.replace("_", " ")}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-teal-200 bg-[#fef9e7]/30 p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-[#134e4a]">Assign schedule (route & date range)</h2>
        <p className="text-sm text-[#0f766e]">
          Pick <strong>one direction</strong> (e.g. Surigao → Siargao) and a date range. Start/end date is the period this vessel works this route before maintenance. Trips are created only at times when the boat <strong>departs from the origin</strong> of the chosen route. The return leg (e.g. Siargao → Surigao) is a <strong>separate route</strong> with its own times—set them in Admin → Schedule and add that route below in &quot;Add more trips&quot;.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-[#134e4a]">Route (one direction)</label>
            <select
              value={routeId}
              onChange={(e) => {
                setRouteId(e.target.value);
                setPortId("");
              }}
              className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            >
              <option value="">Optional — select to add trips</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.display_name || `${r.origin} → ${r.destination}`}</option>
              ))}
            </select>
          </div>
          {isDinagatRoute && ports.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#134e4a]">Dinagat port</label>
              <select
                value={portId}
                onChange={(e) => setPortId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
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
            <label className="block text-sm font-medium text-[#134e4a]">Start date</label>
            <input
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#134e4a]">End date</label>
            <input
              type="date"
              min={today}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            />
          </div>
        </div>
        {routeId && selectedRoute && (
          <div className="rounded-lg border border-teal-200 bg-white/80 px-4 py-3">
            <p className="text-xs font-medium text-[#134e4a] mb-1">
              Departures <strong>from {selectedRoute.origin}</strong> only ({selectedRoute.origin} → {selectedRoute.destination})
            </p>
            {loadingTimes ? (
              <p className="text-sm text-[#0f766e]">Loading…</p>
            ) : scheduleTimes.length === 0 ? (
              <p className="text-sm text-amber-700">No times set. In Admin → Schedule, add times when the boat leaves {selectedRoute.origin} for {selectedRoute.destination}. The return from {selectedRoute.destination} to {selectedRoute.origin} (e.g. 11:30 AM) is set on the other route.</p>
            ) : (
              <>
                <p className="text-sm text-[#0f766e]">
                  Trips will be created at: <strong>{scheduleTimes.map((t) => t.label).join(", ")}</strong>
                </p>
                <p className="text-xs text-[#0f766e] mt-2">
                  These are times the boat leaves {selectedRoute.origin}. E.g. {scheduleTimes[0]?.label ?? "5:30 AM"} is when it departs {selectedRoute.origin} to {selectedRoute.destination}; this boat returns from {selectedRoute.destination} to {selectedRoute.origin} at another time (e.g. 11:30 AM)—set that on the route &quot;{selectedRoute.destination} → {selectedRoute.origin}&quot; in Admin → Schedule.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation"
      >
        {saving ? "Saving…" : "Save & assign schedule"}
      </button>
    </form>
  );
}
