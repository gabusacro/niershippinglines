"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ActionToast";

interface DeleteTripButtonProps {
  /** When provided, uses vessel trips DELETE (same path as vessel delete). Required on vessel page. */
  boatId?: string;
  tripId: string;
  confirmedCount: number;
  /** Past trips: always allow remove (no-shows do not block) */
  isPastTrip?: boolean;
}

export function DeleteTripButton({ boatId, tripId, confirmedCount, isPastTrip }: DeleteTripButtonProps) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  if (!isPastTrip && confirmedCount > 0) {
    return (
      <span className="text-xs text-amber-700" title={`${confirmedCount} confirmed passenger(s)`}>
        {confirmedCount} confirmed
      </span>
    );
  }

  const handleDelete = async () => {
    if (!tripId) return;
    if (!confirm("Remove this trip? No confirmed passengers.")) return;
    setDeleting(true);
    try {
      const url = boatId
        ? `/api/admin/vessels/${boatId}/trips`
        : `/api/admin/trips/${tripId}`;
      const options: RequestInit = boatId
        ? { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trip_ids: [tripId] }) }
        : { method: "DELETE" };
      const res = await fetch(url, options);
      let data: { error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.statusText || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        if (res.status === 404) {
          toast.showSuccess("Trip already removed");
          window.location.reload();
          return;
        }
        const msg = data.error ?? `Delete failed (${res.status})`;
        toast.showError(msg);
        alert(msg);
        return;
      }
      toast.showSuccess("Trip removed successfully");
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove trip.";
      toast.showError(msg);
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {deleting ? "…" : "Remove"}
    </button>
  );
}
