"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

type Props = {
  bookingId: string;
  reference: string;
  /** When set (logged-in passenger), show Warning and Spam. When null (guest), only Delete. */
  profileId: string | null;
};

export function PendingPaymentActions({ bookingId, reference, profileId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function doRestriction(action: "warn" | "spam") {
    if (!profileId) return;
    setLoading(action);
    try {
      const res = await fetch("/api/admin/passenger-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.showSuccess(data.message ?? "Done");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function doDelete() {
    if (!confirm(`Delete booking ${reference}? This will remove the booking and release the trip seats.`)) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.showSuccess(data.message ?? "Booking deleted.");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {profileId && (
        <>
          <button
            type="button"
            onClick={() => doRestriction("warn")}
            disabled={!!loading}
            className="rounded-lg border-2 border-amber-600 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {loading === "warn" ? "…" : "Warning"}
          </button>
          <button
            type="button"
            onClick={() => confirm("Restrict this passenger from booking for 15 days? They will see a message to contact support.") && doRestriction("spam")}
            disabled={!!loading}
            className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {loading === "spam" ? "…" : "Spam"}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={doDelete}
        disabled={!!loading}
        className="rounded-lg border-2 border-gray-600 bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-50"
      >
        {loading === "delete" ? "…" : "Delete"}
      </button>
    </div>
  );
}
