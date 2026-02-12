"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

interface ReconcileWalkInButtonProps {
  tripId: string;
  walkInNoNames: number;
}

/** When there are walk-in passengers counted but not listed by name, allow resetting trip walk_in_booked to match named passengers only (Coast Guard compliant). */
export function ReconcileWalkInButton({ tripId, walkInNoNames }: ReconcileWalkInButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (walkInNoNames <= 0) return null;

  const handleReconcile = async () => {
    if (!confirm("Reset walk-in count to named passengers only? The " + walkInNoNames + " count-only passengers will be removed from the manifest. Coast Guard will only see listed names.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconcile_walk_in: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset");
      toast.showSuccess("Walk-in count reset to named passengers only. Manifest is now Coast Guard compliant.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 print:hidden">
      <p className="text-sm text-amber-900">
        <strong>{walkInNoNames} walk-in passenger{walkInNoNames !== 1 ? "s" : ""}</strong> are counted but not listed by name above. Coast Guard requires every passenger to be named.
      </p>
      <button
        type="button"
        onClick={handleReconcile}
        disabled={loading}
        className="mt-3 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Resetting…" : "Reset walk-in count to named passengers only"}
      </button>
    </div>
  );
}
