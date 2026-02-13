"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function PassengerRestrictionActions({
  profileId,
  bookingWarnings,
  isBlocked,
}: {
  profileId: string;
  bookingWarnings: number;
  isBlocked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function doAction(action: "warn" | "block" | "unblock" | "clear_warnings") {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/passenger-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast.showSuccess(data.message ?? "Done");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {!isBlocked && bookingWarnings < 2 && (
        <button
          type="button"
          onClick={() => doAction("warn")}
          disabled={!!loading}
          className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {loading === "warn" ? "…" : bookingWarnings === 0 ? "Issue first warning" : "Issue second warning"}
        </button>
      )}
      {!isBlocked && (
        <button
          type="button"
          onClick={() => confirm("Block this passenger from making new online bookings?") && doAction("block")}
          disabled={!!loading}
          className="rounded-lg border border-red-600 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          {loading === "block" ? "…" : "Block from booking"}
        </button>
      )}
      {isBlocked && (
        <button
          type="button"
          onClick={() => doAction("unblock")}
          disabled={!!loading}
          className="rounded-lg border border-teal-600 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50"
        >
          {loading === "unblock" ? "…" : "Unblock"}
        </button>
      )}
      {(bookingWarnings > 0 || isBlocked) && (
        <button
          type="button"
          onClick={() => doAction("clear_warnings")}
          disabled={!!loading}
          className="rounded-lg border border-gray-500 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {loading === "clear_warnings" ? "…" : "Clear warnings"}
        </button>
      )}
    </div>
  );
}
