"use client";

import { useState } from "react";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";

interface DeleteVesselButtonProps {
  vesselId: string;
  vesselName: string;
  tripCount?: number;
  bookedCount?: number;
}

export function DeleteVesselButton({
  vesselId,
  vesselName,
  tripCount = 0,
  bookedCount = 0,
}: DeleteVesselButtonProps) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const msg =
      tripCount > 0
        ? bookedCount > 0
          ? `"${vesselName}" has ${tripCount} trip${tripCount !== 1 ? "s" : ""} with ${bookedCount} confirmed passenger${bookedCount !== 1 ? "s" : ""}. Manage trips to reassign them first.`
          : `"${vesselName}" has ${tripCount} trip${tripCount !== 1 ? "s" : ""} with 0 confirmed passengers. Delete vessel and cancel its empty trips?`
        : `Delete vessel "${vesselName}"?`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/vessels/${vesselId}`, { method: "DELETE" });
      let data: { error?: string; trip_count?: number; booked_count?: number };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.statusText || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const errMsg =
          data.trip_count != null && data.booked_count != null
            ? `Cannot delete: ${data.trip_count} trips (including past), ${data.booked_count} confirmed passengers. See Manage trips → Past trips.`
            : data.error ?? `Delete failed (${res.status})`;
        toast.showError(errMsg);
        alert(errMsg);
        return;
      }
      toast.showSuccess("Vessel deleted successfully");
      window.location.href = ROUTES.adminVessels;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete.";
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
      className="min-h-[44px] shrink-0 rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 touch-manipulation"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
