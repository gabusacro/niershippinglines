"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteTripButton } from "./DeleteTripButton";
import { ViewBookingsModal } from "./ViewBookingsModal";
import { useToast } from "@/components/ui/ActionToast";

export type TripRow = {
  id: string;
  routeLabel: string;
  departureDate: string;
  departureTime: string;
  status: string;
  avail: number;
  onlineQuota: number;
  confirmedCount: number;
};

interface TripsTableWithBulkActionsProps {
  boatId: string;
  trips: TripRow[];
  totalConfirmed: number;
}

export function TripsTableWithBulkActions({ boatId, trips, totalConfirmed }: TripsTableWithBulkActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [viewBookingsTrip, setViewBookingsTrip] = useState<{ id: string; routeLabel: string; departureDate: string; departureTime: string } | null>(null);

  const removableTrips = trips.filter((t) => t.confirmedCount === 0);
  const removableIds = new Set(removableTrips.map((t) => t.id));
  const allRemovableSelected = removableTrips.length > 0 && removableTrips.every((t) => selected.has(t.id));

  const toggleOne = (id: string) => {
    if (!removableIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRemovable = () => {
    if (allRemovableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(removableTrips.map((t) => t.id)));
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected).filter((id) => removableIds.has(id));
    if (ids.length === 0) return;
    if (!confirm(`Remove ${ids.length} selected trip${ids.length !== 1 ? "s" : ""}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/vessels/${boatId}/trips`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_ids: ids }),
      });
      let data: { error?: string; deleted?: number; skipped?: number; errors?: string[] };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.statusText || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const msg = data.error ?? "Bulk delete failed";
        toast.showError(msg);
        alert(msg);
        return;
      }
      const { deleted = 0, skipped = 0, errors } = data;
      setSelected(new Set());
      if ((errors?.length ?? 0) > 0) {
        const errMsg = `Removed ${deleted} trip(s). ${errors!.length} failed. ${errors![0] ?? ""}`;
        toast.showError(errMsg);
        alert(errMsg);
        router.refresh();
      } else {
        const msg1 = skipped > 0
          ? `Removed ${deleted} trip(s). ${skipped} had confirmed passengers and were skipped.`
          : `Removed ${deleted} trip(s) successfully`;
        toast.showSuccess(msg1);
        window.location.reload();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove trips.";
      toast.showError(msg);
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const deleteAll = async () => {
    if (removableTrips.length === 0) {
      const msg = totalConfirmed > 0 ? "All trips have confirmed passengers." : "No trips to remove.";
      toast.showError(msg);
      return;
    }
    if (!confirm(`Remove all ${removableTrips.length} trip${removableTrips.length !== 1 ? "s" : ""} with 0 confirmed passengers?`)) return;
    setDeleting(true);
    try {
      const ids = removableTrips.map((t) => t.id);
      const res = await fetch(`/api/admin/vessels/${boatId}/trips`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_ids: ids }),
      });
      let data: { error?: string; deleted?: number; skipped?: number; errors?: string[] };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.statusText || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const msg = data.error ?? "Bulk delete failed";
        toast.showError(msg);
        alert(msg);
        return;
      }
      const { deleted = 0, skipped = 0, errors } = data;
      setSelected(new Set());
      if ((errors?.length ?? 0) > 0) {
        const errMsg = `Removed ${deleted} trip(s). ${errors!.length} failed. ${errors![0] ?? ""}`;
        toast.showError(errMsg);
        alert(errMsg);
        router.refresh();
      } else {
        const msg2 = skipped > 0
          ? `Removed ${deleted} trip(s). ${skipped} had confirmed passengers and were skipped.`
          : `Removed ${deleted} trip(s) successfully`;
        toast.showSuccess(msg2);
        window.location.reload();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove trips.";
      toast.showError(msg);
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={deleteSelected}
          disabled={deleting || selected.size === 0}
          className="min-h-[44px] rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 touch-manipulation"
        >
          {deleting ? "Removing…" : `Remove selected (${selected.size})`}
        </button>
        <button
          type="button"
          onClick={deleteAll}
          disabled={deleting || removableTrips.length === 0}
          className="min-h-[44px] rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 touch-manipulation"
        >
          {deleting ? "Removing…" : `Remove all (${removableTrips.length})`}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-teal-200 bg-white">
        <table className="min-w-full divide-y divide-teal-100 text-sm">
          <thead>
            <tr className="bg-[#0c7b93]/10">
              <th className="w-10 px-2 py-2">
                {removableTrips.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allRemovableSelected}
                    onChange={toggleAllRemovable}
                    className="h-4 w-4 rounded border-teal-300 text-[#0c7b93] focus:ring-[#0c7b93]"
                    aria-label="Select all removable"
                  />
                )}
              </th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Route</th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Date</th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Time</th>
              <th className="px-4 py-2 text-left font-semibold text-[#134e4a]">Status</th>
              <th className="px-4 py-2 text-right font-semibold text-[#134e4a]" title="Booked / total seats">Booked</th>
              <th className="px-4 py-2 text-center font-semibold text-[#134e4a]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-100">
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="w-10 px-2 py-2">
                  {t.confirmedCount === 0 ? (
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      className="h-4 w-4 rounded border-teal-300 text-[#0c7b93] focus:ring-[#0c7b93]"
                    />
                  ) : null}
                </td>
                <td className="px-4 py-2 text-[#134e4a]">{t.routeLabel}</td>
                <td className="px-4 py-2 text-[#134e4a]">{t.departureDate}</td>
                <td className="px-4 py-2 text-[#134e4a]">{t.departureTime}</td>
                <td className="px-4 py-2 text-[#134e4a]">{t.status}</td>
                <td className="px-4 py-2 text-right text-[#134e4a]">{t.onlineQuota - t.avail} / {t.onlineQuota}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewBookingsTrip({ id: t.id, routeLabel: t.routeLabel, departureDate: t.departureDate, departureTime: t.departureTime })}
                      className="rounded px-2 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50"
                    >
                      View
                    </button>
                    <DeleteTripButton boatId={boatId} tripId={t.id} confirmedCount={t.confirmedCount} />
                  </div>
                </td>
              </tr>
            ))}
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
    </div>
  );
}
