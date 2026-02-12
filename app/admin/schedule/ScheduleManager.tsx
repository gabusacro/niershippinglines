"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/ActionToast";

type Route = { id: string; origin: string; destination: string; display_name: string };
type Slot = { id: string; route_id: string; departure_time: string; is_active: boolean; route_name: string; label: string };

export function ScheduleManager() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [routesRes, slotsRes] = await Promise.all([
        fetch("/api/admin/routes", { credentials: "include" }),
        fetch("/api/admin/schedule-slots", { credentials: "include" }),
      ]);
      if (!routesRes.ok) throw new Error("Failed to load routes");
      if (!slotsRes.ok) throw new Error("Failed to load schedule slots");
      const routesData = await routesRes.json();
      const slotsData = await slotsRes.json();
      setRoutes(Array.isArray(routesData) ? routesData : []);
      setSlots(Array.isArray(slotsData?.slots) ? slotsData.slots : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <p className="text-sm text-[#0f766e]">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-8">
      <AddRouteForm onSuccess={fetchData} />
      {routes.length === 0 ? (
        <p className="text-sm text-[#0f766e]">No routes yet. Add a route above to get started.</p>
      ) : (
      <>
      {routes.map((route) => (
        <RouteSection
          key={route.id}
          route={route}
          slots={slots.filter((s) => s.route_id === route.id)}
          onUpdate={fetchData}
        />
      ))}
      </>
      )}
    </div>
  );
}

function AddRouteForm({ onSuccess }: { onSuccess: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!origin.trim() || !destination.trim()) {
      setError("Origin and destination are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
          display_name: displayName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add route");
      toast.showSuccess("Route added successfully");
      setOrigin("");
      setDestination("");
      setDisplayName("");
      setOpen(false);
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add route";
      setError(msg);
      toast.showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 px-5 py-3 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50 hover:border-teal-400"
      >
        <span>+</span>
        Add new route / destination
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-teal-200 bg-teal-50/30 p-6">
      <h3 className="text-base font-semibold text-[#134e4a]">Add new route</h3>
      <p className="mt-1 text-sm text-[#0f766e]">Create a new origin → destination pair. Then add departure times below.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-[#134e4a]">Origin</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Surigao City"
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#134e4a]">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Siargao Island"
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#134e4a]">Display name (optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Surigao ↔ Siargao"
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add route"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="min-h-[44px] rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function RouteSection({
  route,
  slots,
  onUpdate,
}: {
  route: Route;
  slots: Slot[];
  onUpdate: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [origin, setOrigin] = useState(route.origin);
  const [destination, setDestination] = useState(route.destination);
  const [displayName, setDisplayName] = useState(route.display_name);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSaveRoute = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/routes/${route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, display_name: displayName }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setEditing(false);
      toast.showSuccess("Route saved successfully");
      onUpdate();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTime = async () => {
    const t = newTime.trim();
    if (!t) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/schedule-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route_id: route.id, departure_time: t }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Add failed");
      }
      setNewTime("");
      toast.showSuccess("Departure time added successfully");
      onUpdate();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Add failed. Use HH:MM (e.g. 06:00).");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Remove this departure time?")) return;
    try {
      const res = await fetch(`/api/admin/schedule-slots/${slotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.showSuccess("Departure time removed successfully");
      onUpdate();
    } catch {
      toast.showError("Could not remove.");
    }
  };

  const handleDeleteRoute = async () => {
    if (!confirm(`Delete route "${route.display_name}" (${route.origin} → ${route.destination})? This will remove all its departure times. It will fail if any trips use this route.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/routes/${route.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.showSuccess("Route deleted successfully");
      onUpdate();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not delete route.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateRoute = async () => {
    if (!route.origin?.trim() || !route.destination?.trim()) {
      toast.showError("Cannot duplicate: route has no origin or destination.");
      return;
    }
    setDuplicating(true);
    try {
      let newRouteId: string | null = null;
      let suffix = "";
      let lastError = "";
      for (let n = 1; n <= 10; n++) {
        const destWithNum = `${route.origin.trim()}(${n})`;
        const displayWithNum = `${route.destination.trim()} ↔ ${route.origin.trim()}(${n})`;
        const res = await fetch("/api/admin/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: route.destination.trim(),
            destination: destWithNum,
            display_name: displayWithNum,
          }),
        });
        let data: { error?: string; id?: string };
        try {
          data = await res.json();
        } catch {
          lastError = "Invalid response from server.";
          continue;
        }
        if (res.ok) {
          newRouteId = data.id as string;
          suffix = `(${n})`;
          break;
        }
        lastError = data.error ?? "Duplicate failed";
        const errLower = lastError.toLowerCase();
        const isDuplicate =
          errLower.includes("already exists") ||
          errLower.includes("duplicate") ||
          errLower.includes("23505") ||
          errLower.includes("unique");
        if (res.status !== 400 || !isDuplicate) {
          throw new Error(lastError);
        }
      }
      if (!newRouteId) {
        toast.showError(lastError || "Could not create duplicate (tried 1–10). A route with that name may already exist.");
        return;
      }
      for (const slot of slots) {
        const timeStr = String(slot.departure_time ?? "").trim().slice(0, 8);
        if (!timeStr) continue;
        const slotRes = await fetch("/api/admin/schedule-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route_id: newRouteId, departure_time: timeStr }),
        });
        if (!slotRes.ok) break;
      }
      toast.showSuccess(`Route duplicated as ${route.destination} ↔ ${route.origin}${suffix}. Edit names/times as needed.`);
      onUpdate();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#134e4a]">{route.display_name}</h2>
          {editing ? (
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-xs text-[#0f766e]">Origin</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="mt-0.5 w-full max-w-xs rounded-lg border border-teal-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#0f766e]">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="mt-0.5 w-full max-w-xs rounded-lg border border-teal-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#0f766e]">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-0.5 w-full max-w-xs rounded-lg border border-teal-200 px-3 py-2 text-sm"
                  placeholder="e.g. Siargao ↔ Surigao"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveRoute}
                  disabled={saving}
                  className="rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-[#0f766e]">
              {route.origin} → {route.destination}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[44px] rounded-xl border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
            >
              Edit route
            </button>
            <button
              type="button"
              onClick={handleDuplicateRoute}
              disabled={duplicating}
              className="min-h-[44px] rounded-xl border-2 border-dashed border-teal-400 px-4 py-2 text-sm font-semibold text-[#0f766e] bg-teal-50 hover:bg-teal-100 disabled:opacity-50"
              title="Create return route (destination → origin) with same departure times; edit names/times as needed"
            >
              {duplicating ? "Duplicating…" : "Duplicate route"}
            </button>
            <button
              type="button"
              onClick={handleDeleteRoute}
              disabled={deleting}
              className="min-h-[44px] rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
              title="Delete this route and its departure times. Fails if any trips use this route."
            >
              {deleting ? "Deleting…" : "Delete route"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-teal-100 pt-6">
        <h3 className="text-sm font-semibold text-[#134e4a]">Departure times</h3>
        <p className="mt-0.5 text-xs text-[#0f766e]/80">These times are used when you assign a vessel to this route. Add or remove as needed.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            placeholder="HH:MM (e.g. 06:00)"
            className="rounded-lg border border-teal-200 px-3 py-2 text-sm w-32"
          />
          <button
            type="button"
            onClick={handleAddTime}
            disabled={adding || !newTime.trim()}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 touch-manipulation"
          >
            {adding ? "Adding…" : "Add time"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {slots.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-[#134e4a]"
            >
              {s.label}
              <button
                type="button"
                onClick={() => handleDeleteSlot(s.id)}
                className="ml-1 rounded p-0.5 text-red-600 hover:bg-red-100"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
          {slots.length === 0 && <span className="text-sm text-[#0f766e]/70">No times yet. Add above.</span>}
        </div>
      </div>
    </div>
  );
}
