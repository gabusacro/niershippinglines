"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Route {
  id: string;
  origin: string;
  destination: string;
  display_name: string;
}

interface ScheduleSlot {
  id: string;
  departure_time: string;
  slot_label: string | null;
  estimated_travel_minutes: number;
  is_active: boolean;
}

interface RouteAssignment {
  id: string;
  boat_id: string;
  route_id: string;
  available_from: string;
  available_until: string;
  is_active: boolean;
  routes: Route;
  schedule_slots: ScheduleSlot[];
}

interface CrewMember {
  id: string;
  profile_id: string;
  assignment_role: string;
  full_name: string | null;
}

interface Vessel {
  id: string;
  name: string;
  capacity: number;
  online_quota: number;
  status: string;
  image_url: string | null;
  marina_number: string | null;
  upcomingTripCount: number;
  confirmedPassengers: number;
  routeAssignments: RouteAssignment[];
  crew: CrewMember[];
}

interface FleetClientProps {
  vessels: Vessel[];
  routes: Route[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = (h ?? 0) < 12 ? "AM" : "PM";
  const h12 = (h ?? 0) === 0 ? 12 : (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0);
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const arrH = Math.floor(total / 60) % 24;
  const arrM = total % 60;
  return `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`;
}

function formatDateRange(from: string, until: string): string {
  const f = new Date(from + "T00:00:00");
  const u = new Date(until + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${f.toLocaleDateString("en-PH", opts)} – ${u.toLocaleDateString("en-PH", opts)}`;
}

function isCurrentlyActive(from: string, until: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return from <= today && today <= until;
}

// ─── Main Fleet Client ────────────────────────────────────────────────────────

export function FleetClient({ vessels, routes }: FleetClientProps) {
  const router = useRouter();
  const [assignModalVessel, setAssignModalVessel] = useState<Vessel | null>(null);
  const [crewModalVessel, setCrewModalVessel] = useState<Vessel | null>(null);
  const [editSlot, setEditSlot] = useState<{ slot: ScheduleSlot; assignment: RouteAssignment; vessel: Vessel } | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const handleToggleStatus = useCallback(async (vessel: Vessel) => {
    const newStatus = vessel.status === "running" ? "maintenance" : "running";
    if (newStatus === "maintenance" && vessel.confirmedPassengers > 0) {
      alert(`Cannot set to maintenance: ${vessel.confirmedPassengers} confirmed passenger(s) on upcoming trips.`);
      return;
    }
    if (!confirm(`Set ${vessel.name} to ${newStatus}?`)) return;
    setStatusLoading(vessel.id);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Failed to update status"); return; }
      router.refresh();
    } finally {
      setStatusLoading(null);
    }
  }, [router]);

  return (
    <div className="space-y-5">
      {vessels.length === 0 ? (
        <div className="rounded-2xl border border-teal-200 bg-white p-10 text-center">
          <p className="text-sm text-[#0f766e]">No vessels yet. Click &quot;+ Add Vessel&quot; to get started.</p>
        </div>
      ) : (
        vessels.map((vessel) => (
          <VesselCard
            key={vessel.id}
            vessel={vessel}
            onAssignRoute={() => setAssignModalVessel(vessel)}
            onManageCrew={() => setCrewModalVessel(vessel)}
            onEditSlot={(slot, assignment) => setEditSlot({ slot, assignment, vessel })}
            onToggleStatus={() => handleToggleStatus(vessel)}
            statusLoading={statusLoading === vessel.id}
            onRefresh={() => router.refresh()}
          />
        ))
      )}

      {assignModalVessel && (
        <AssignRouteModal vessel={assignModalVessel} routes={routes}
          onClose={() => setAssignModalVessel(null)}
          onSuccess={() => { setAssignModalVessel(null); router.refresh(); }} />
      )}
      {crewModalVessel && (
        <ManageCrewModal vessel={crewModalVessel}
          onClose={() => setCrewModalVessel(null)}
          onSuccess={() => { setCrewModalVessel(null); router.refresh(); }} />
      )}
      {editSlot && (
        <EditSlotModal slot={editSlot.slot} assignment={editSlot.assignment} vessel={editSlot.vessel}
          onClose={() => setEditSlot(null)}
          onSuccess={() => { setEditSlot(null); router.refresh(); }} />
      )}
    </div>
  );
}

// ─── Vessel Card ─────────────────────────────────────────────────────────────

function VesselCard({
  vessel, onAssignRoute, onManageCrew, onEditSlot, onToggleStatus, statusLoading, onRefresh,
}: {
  vessel: Vessel;
  onAssignRoute: () => void;
  onManageCrew: () => void;
  onEditSlot: (slot: ScheduleSlot, assignment: RouteAssignment) => void;
  onToggleStatus: () => void;
  statusLoading: boolean;
  onRefresh: () => void;
}) {
  const isRunning = vessel.status === "running";
  const [deletingAssignment, setDeletingAssignment] = useState<string | null>(null);
  const [togglingAssignment, setTogglingAssignment] = useState<string | null>(null);

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this route assignment? Existing trips are kept for records. Trips with confirmed bookings block removal.")) return;
    setDeletingAssignment(assignmentId);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}/route-assignments/${assignmentId}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { alert(d.error ?? "Failed"); return; }
      onRefresh();
    } finally { setDeletingAssignment(null); }
  };

  const handleToggleAssignment = async (assignmentId: string, current: boolean) => {
    setTogglingAssignment(assignmentId);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}/route-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Failed"); return; }
      onRefresh();
    } finally { setTogglingAssignment(null); }
  };

  const activeAssignments = vessel.routeAssignments.filter((a) => a.is_active);
  const inactiveAssignments = vessel.routeAssignments.filter((a) => !a.is_active);

  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition-all ${isRunning ? "border-teal-200" : "border-amber-200 bg-amber-50/30"}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-4">
        <div className="flex items-start gap-4">
          {vessel.image_url && (
            <img src={vessel.image_url} alt={vessel.name} className="h-14 w-20 rounded-xl object-cover border border-teal-100" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-[#134e4a]">{vessel.name}</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isRunning ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? "bg-emerald-500" : "bg-amber-500"}`} />
                {isRunning ? "Running" : "Maintenance"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#0f766e]">
              Capacity {vessel.capacity} · Online quota {vessel.online_quota} · Walk-in quota {vessel.capacity - vessel.online_quota}
              {vessel.marina_number && ` · Marina ${vessel.marina_number}`}
            </p>
            {vessel.upcomingTripCount > 0 && (
              <p className="mt-0.5 text-xs text-amber-700">
                {vessel.upcomingTripCount} upcoming trip{vessel.upcomingTripCount !== 1 ? "s" : ""} · {vessel.confirmedPassengers} confirmed passenger{vessel.confirmedPassengers !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/vessels/${vessel.id}`}
            className="min-h-[38px] rounded-xl border-2 border-[#0c7b93] px-4 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors inline-flex items-center">
            Manage Trips →
          </Link>
          <button type="button" onClick={onToggleStatus} disabled={statusLoading}
            className={`min-h-[38px] rounded-xl border-2 px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${isRunning ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
            {statusLoading ? "…" : isRunning ? "Set Maintenance" : "Set Running"}
          </button>
        </div>
      </div>

      {/* Crew */}
      <div className="mx-5 mb-4 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Assigned Crew</p>
          <button type="button" onClick={onManageCrew}
            className="text-xs font-semibold text-[#0c7b93] border border-[#0c7b93]/30 rounded-lg px-2.5 py-1 hover:bg-[#0c7b93]/10 transition-colors">
            + Manage Crew
          </button>
        </div>
        {vessel.crew.length === 0 ? (
          <p className="text-xs text-[#0f766e]/60">No crew assigned yet. Click &quot;+ Manage Crew&quot; to assign.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {vessel.crew.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-sm text-[#134e4a]">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${c.assignment_role === "captain" ? "bg-[#0c7b93]/15 text-[#0c7b93]" : c.assignment_role === "deck_crew" ? "bg-teal-100 text-teal-800" : "bg-purple-100 text-purple-800"}`}>
                  {c.assignment_role === "captain" ? "⚓ Captain" : c.assignment_role === "deck_crew" ? "Deck Crew" : "Ticket Booth"}
                </span>
                {c.full_name ?? "—"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Routes */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#134e4a]">Routes & Schedules</p>
          <button type="button" onClick={onAssignRoute}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50 hover:border-teal-400 transition-colors">
            + Assign Route
          </button>
        </div>

        {vessel.routeAssignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-teal-200 p-4 text-center">
            <p className="text-sm text-[#0f766e]/70">No routes assigned yet.</p>
            <p className="text-xs text-[#0f766e]/50 mt-0.5">Click &quot;+ Assign Route&quot; to set routes, times and availability dates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAssignments.map((a) => (
              <RouteAssignmentCard key={a.id} assignment={a} vesselId={vessel.id}
                onDelete={() => handleDeleteAssignment(a.id)}
                onToggle={() => handleToggleAssignment(a.id, a.is_active)}
                onEditSlot={(slot) => onEditSlot(slot, a)}
                isDeleting={deletingAssignment === a.id}
                isToggling={togglingAssignment === a.id} />
            ))}
            {inactiveAssignments.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-[#0f766e]/70 hover:text-[#0f766e] list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  {inactiveAssignments.length} inactive assignment{inactiveAssignments.length !== 1 ? "s" : ""}
                </summary>
                <div className="mt-2 space-y-2">
                  {inactiveAssignments.map((a) => (
                    <RouteAssignmentCard key={a.id} assignment={a} vesselId={vessel.id}
                      onDelete={() => handleDeleteAssignment(a.id)}
                      onToggle={() => handleToggleAssignment(a.id, a.is_active)}
                      onEditSlot={(slot) => onEditSlot(slot, a)}
                      isDeleting={deletingAssignment === a.id}
                      isToggling={togglingAssignment === a.id} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Route Assignment Card ────────────────────────────────────────────────────

function RouteAssignmentCard({
  assignment, vesselId, onDelete, onToggle, onEditSlot, isDeleting, isToggling,
}: {
  assignment: RouteAssignment;
  vesselId: string;
  onDelete: () => void;
  onToggle: () => void;
  onEditSlot: (slot: ScheduleSlot) => void;
  isDeleting: boolean;
  isToggling: boolean;
}) {
  const isActive = assignment.is_active;
  const isCurrent = isCurrentlyActive(assignment.available_from, assignment.available_until);
  const activeSlots = assignment.schedule_slots.filter((s) => s.is_active);

  return (
    <div className={`rounded-xl border p-4 transition-all ${isActive && isCurrent ? "border-teal-200 bg-white" : isActive ? "border-teal-100 bg-teal-50/30" : "border-gray-200 bg-gray-50/50 opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#134e4a] text-sm">{assignment.routes.origin} → {assignment.routes.destination}</p>
            {isCurrent && isActive && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Active Now</span>}
            {!isActive && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Inactive</span>}
          </div>
          <p className="text-xs text-[#0f766e] mt-0.5">📅 {formatDateRange(assignment.available_from, assignment.available_until)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={onToggle} disabled={isToggling}
            className="text-xs px-2.5 py-1 rounded-lg border border-teal-200 text-[#0f766e] hover:bg-teal-50 disabled:opacity-50 transition-colors">
            {isToggling ? "…" : isActive ? "Deactivate" : "Activate"}
          </button>
          <button type="button" onClick={onDelete} disabled={isDeleting}
            className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
            {isDeleting ? "…" : "Remove"}
          </button>
        </div>
      </div>

      {activeSlots.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeSlots.map((slot) => {
            const arrival = addMinutes(slot.departure_time, slot.estimated_travel_minutes);
            return (
              <div key={slot.id} className="group relative rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs pr-12">
                {slot.slot_label && <p className="font-semibold text-[#134e4a] mb-0.5">{slot.slot_label}</p>}
                <p className="text-[#0f766e]">🚢 Departs <strong>{fmt12(slot.departure_time)}</strong></p>
                <p className="text-[#0f766e]">🏝️ Arrives ~<strong>{fmt12(arrival)}</strong>
                  <span className="text-[#0f766e]/60 ml-1">({slot.estimated_travel_minutes} min)</span>
                </p>
                <button type="button" onClick={() => onEditSlot(slot)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-white border border-teal-300 text-[#0c7b93] rounded-md px-2 py-0.5 font-semibold hover:bg-teal-50 whitespace-nowrap">
                  ✏️ Edit
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-600">⚠️ No departure times set.</p>
      )}
    </div>
  );
}

// ─── Edit Slot Modal ──────────────────────────────────────────────────────────

function EditSlotModal({
  slot, assignment, vessel, onClose, onSuccess,
}: {
  slot: ScheduleSlot;
  assignment: RouteAssignment;
  vessel: Vessel;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState(slot.slot_label ?? "");
  const [departureTime, setDepartureTime] = useState(slot.departure_time.slice(0, 5));
  const [travelMinutes, setTravelMinutes] = useState(slot.estimated_travel_minutes);
  const [availableFrom, setAvailableFrom] = useState(assignment.available_from);
  const [availableUntil, setAvailableUntil] = useState(assignment.available_until);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const arrival = departureTime ? addMinutes(departureTime, travelMinutes) : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!departureTime) { setError("Departure time is required."); return; }
    setSaving(true);
    try {
      const slotRes = await fetch(`/api/admin/schedule-slots/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_label: label.trim() || null, departure_time: departureTime, estimated_travel_minutes: travelMinutes }),
      });
      if (!slotRes.ok) { const d = await slotRes.json(); setError(d.error ?? "Failed to update."); return; }

      if (availableFrom !== assignment.available_from || availableUntil !== assignment.available_until) {
        const assignRes = await fetch(`/api/admin/vessels/${vessel.id}/route-assignments/${assignment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available_from: availableFrom, available_until: availableUntil }),
        });
        if (!assignRes.ok) { const d = await assignRes.json(); setError(d.error ?? "Failed to update date range."); return; }
      }
      onSuccess();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove the ${fmt12(departureTime)} departure? Existing trips are kept.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/schedule-slots/${slot.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      onSuccess();
    } catch { setError("Network error."); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100">
        <div className="border-b border-teal-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-[#134e4a]">Edit Trip Schedule</h2>
            <p className="text-xs text-[#0f766e] mt-0.5">{assignment.routes.origin} → {assignment.routes.destination} · {vessel.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">Trip Label (optional)</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Morning Trip, Trip 1"
              className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">
              Departure from <span className="text-[#0c7b93]">{assignment.routes.origin}</span>
            </label>
            <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} required
              className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">Travel Duration (minutes)</label>
            <input type="number" min={15} max={720} value={travelMinutes}
              onChange={(e) => setTravelMinutes(parseInt(e.target.value) || 120)}
              className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
          </div>

          {arrival && departureTime && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-[#0f766e]">
              🚢 <strong>{fmt12(departureTime)}</strong> from {assignment.routes.origin}
              &nbsp;→&nbsp;🏝️ ~<strong>{fmt12(arrival)}</strong> at {assignment.routes.destination}
              <span className="text-[#0f766e]/60 ml-1">({travelMinutes} min)</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">Availability Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#0f766e] mb-1">From</label>
                <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full rounded-xl border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
              </div>
              <div>
                <label className="block text-xs text-[#0f766e] mb-1">Until</label>
                <input type="date" min={availableFrom} value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)}
                  className="w-full rounded-xl border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
              </div>
            </div>
            <p className="mt-1 text-xs text-[#0f766e]/60">Changing dates extends/shortens availability. Does not delete existing trips.</p>
          </div>

          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 min-h-[44px] rounded-xl bg-[#0c7b93] text-white font-semibold text-sm hover:bg-[#0f766e] disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="min-h-[44px] rounded-xl border-2 border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
              {deleting ? "…" : "🗑️"}
            </button>
            <button type="button" onClick={onClose}
              className="min-h-[44px] rounded-xl border-2 border-teal-200 px-4 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage Crew Modal ────────────────────────────────────────────────────────

interface StaffProfile {
  id: string;
  full_name: string | null;
  role: string;
}

function ManageCrewModal({ vessel, onClose, onSuccess }: {
  vessel: Vessel;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"captain" | "deck_crew" | "ticket_booth">("deck_crew");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/staff-profiles")
      .then((r) => r.json())
      .then((d) => { setStaff(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedProfileId) { setError("Select a staff member."); return; }
    const alreadyAssigned = vessel.crew.some((c) => c.profile_id === selectedProfileId && c.assignment_role === selectedRole);
    if (alreadyAssigned) { setError("Already assigned in that role."); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: selectedProfileId, assignment_role: selectedRole }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Failed."); return; }
      setSelectedProfileId("");
      onSuccess();
    } catch { setError("Network error."); }
    finally { setAdding(false); }
  };

  const handleRemove = async (assignmentId: string) => {
    setRemoving(assignmentId);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}/crew/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      onSuccess();
    } catch { setError("Network error."); }
    finally { setRemoving(null); }
  };

  const roleBadge = (role: string) => ({
    label: role === "captain" ? "⚓ Captain" : role === "deck_crew" ? "Deck Crew" : "Ticket Booth",
    cls: role === "captain" ? "bg-[#0c7b93]/15 text-[#0c7b93]" : role === "deck_crew" ? "bg-teal-100 text-teal-800" : "bg-purple-100 text-purple-800",
  });

  const availableStaff = staff.filter(
    (s) => !vessel.crew.some((c) => c.profile_id === s.id && c.assignment_role === selectedRole)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-teal-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#134e4a]">Manage Crew — {vessel.name}</h2>
            <p className="text-xs text-[#0f766e] mt-0.5">Assign captain, deck crew, and ticket booth staff.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current crew */}
          <div>
            <p className="text-sm font-semibold text-[#134e4a] mb-2">Currently Assigned</p>
            {vessel.crew.length === 0 ? (
              <p className="text-sm text-[#0f766e]/60 italic">No crew assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {vessel.crew.map((c) => {
                  const badge = roleBadge(c.assignment_role);
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
                        <span className="text-sm text-[#134e4a]">{c.full_name ?? "—"}</span>
                      </div>
                      <button type="button" onClick={() => handleRemove(c.id)} disabled={removing === c.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                        {removing === c.id ? "…" : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add form */}
          <form onSubmit={handleAdd} className="space-y-3 border-t border-teal-100 pt-4">
            <p className="text-sm font-semibold text-[#134e4a]">Add Crew Member</p>
            <div>
              <label className="block text-xs text-[#0f766e] mb-1">Role</label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as "captain" | "deck_crew" | "ticket_booth")}
                className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]">
                <option value="captain">⚓ Captain</option>
                <option value="deck_crew">Deck Crew</option>
                <option value="ticket_booth">Ticket Booth</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#0f766e] mb-1">Staff Member</label>
              {loading ? <p className="text-sm text-[#0f766e]">Loading…</p> : (
                <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]">
                  <option value="">Select staff member…</option>
                  {availableStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name ?? s.id} ({s.role})</option>
                  ))}
                </select>
              )}
            </div>
            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={adding || !selectedProfileId}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0c7b93] text-white font-semibold text-sm hover:bg-[#0f766e] disabled:opacity-50 transition-colors">
                {adding ? "Assigning…" : "Assign to Vessel"}
              </button>
              <button type="button" onClick={onClose}
                className="min-h-[44px] rounded-xl border-2 border-teal-200 px-4 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
                Done
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Route Modal ───────────────────────────────────────────────────────

interface TripEntry {
  departure_time: string;
  slot_label: string;
  estimated_travel_minutes: number;
}

function AssignRouteModal({ vessel, routes, onClose, onSuccess }: {
  vessel: Vessel;
  routes: Route[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [routeId, setRouteId] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [trips, setTrips] = useState<TripEntry[]>([{ departure_time: "", slot_label: "", estimated_travel_minutes: 120 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const selectedRoute = routes.find((r) => r.id === routeId);

  const addTrip = () => setTrips((p) => [...p, { departure_time: "", slot_label: "", estimated_travel_minutes: 120 }]);
  const removeTrip = (i: number) => setTrips((p) => p.filter((_, idx) => idx !== i));
  const updateTrip = (i: number, f: keyof TripEntry, v: string | number) =>
    setTrips((p) => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!routeId || !availableFrom || !availableUntil) { setError("Fill in route and date range."); return; }
    if (new Date(availableFrom) > new Date(availableUntil)) { setError("Start date must be before end date."); return; }
    const validTrips = trips.filter((t) => t.departure_time);
    if (validTrips.length === 0) { setError("Add at least one departure time."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/vessels/${vessel.id}/route-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route_id: routeId, available_from: availableFrom, available_until: availableUntil, trips: validTrips }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      onSuccess();
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-teal-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#134e4a]">Assign Route to {vessel.name}</h2>
            <p className="text-xs text-[#0f766e] mt-0.5">Set route, dates, and departure times. Trips are auto-generated daily.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">Route</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} required
              className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]">
              <option value="">Select route…</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.display_name || `${r.origin} → ${r.destination}`}</option>)}
            </select>
            {selectedRoute && <p className="mt-1.5 text-xs text-[#0f766e] bg-teal-50 rounded-lg px-3 py-2">🚢 {selectedRoute.origin} → {selectedRoute.destination}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">From</label>
              <input type="date" min={today} value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} required
                className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#134e4a] mb-1.5">Until</label>
              <input type="date" min={availableFrom || today} value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} required
                className="w-full rounded-xl border border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
            </div>
          </div>
          {availableFrom && availableUntil && (
            <p className="text-xs text-[#0f766e] -mt-3 bg-teal-50 rounded-lg px-3 py-2">
              📅 {formatDateRange(availableFrom, availableUntil)} — trips generated every day in this range.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#134e4a]">Departure Times <span className="text-xs font-normal text-[#0f766e]">(one per daily trip)</span></label>
              <button type="button" onClick={addTrip}
                className="text-xs font-semibold text-[#0c7b93] border border-[#0c7b93]/30 rounded-lg px-2.5 py-1 hover:bg-[#0c7b93]/10 transition-colors">
                + Add Time
              </button>
            </div>
            <div className="space-y-3">
              {trips.map((trip, i) => {
                const arrival = trip.departure_time ? addMinutes(trip.departure_time, trip.estimated_travel_minutes) : null;
                return (
                  <div key={i} className="rounded-xl border border-teal-200 bg-teal-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-[#134e4a]">Trip {i + 1}</p>
                      {trips.length > 1 && <button type="button" onClick={() => removeTrip(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-[#0f766e] mb-1">Label (optional)</label>
                        <input type="text" placeholder="e.g. Morning Trip" value={trip.slot_label}
                          onChange={(e) => updateTrip(i, "slot_label", e.target.value)}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a]" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#0f766e] mb-1">Duration (min)</label>
                        <input type="number" min={15} max={720} value={trip.estimated_travel_minutes}
                          onChange={(e) => updateTrip(i, "estimated_travel_minutes", parseInt(e.target.value) || 120)}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#0f766e] mb-1">Departure from <strong>{selectedRoute?.origin ?? "Origin"}</strong></label>
                      <input type="time" value={trip.departure_time} onChange={(e) => updateTrip(i, "departure_time", e.target.value)}
                        className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a]" />
                    </div>
                    {arrival && trip.departure_time && (
                      <div className="mt-3 rounded-lg bg-white border border-teal-200 px-3 py-2 text-xs text-[#0f766e]">
                        🚢 <strong>{fmt12(trip.departure_time)}</strong> → 🏝️ ~<strong>{fmt12(arrival)}</strong>
                        <span className="text-[#0f766e]/60 ml-1">({trip.estimated_travel_minutes} min)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={submitting}
              className="flex-1 min-h-[46px] rounded-xl bg-[#0c7b93] text-white font-semibold text-sm hover:bg-[#0f766e] disabled:opacity-50 transition-colors">
              {submitting ? "Generating trips…" : "Assign Route & Generate Trips"}
            </button>
            <button type="button" onClick={onClose}
              className="min-h-[46px] rounded-xl border-2 border-teal-200 px-5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
