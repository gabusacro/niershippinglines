"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function AcknowledgeRefundButton({ reference, acknowledged }: { reference: string; acknowledged: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [localAcknowledged, setLocalAcknowledged] = useState(acknowledged);

  if (localAcknowledged) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
        <span className="text-emerald-700">✓ Acknowledged</span>
      </div>
    );
  }

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/acknowledge-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.showSuccess("Thank you for confirming receipt of your refund.");
      setLocalAcknowledged(true);
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not acknowledge.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleAcknowledge}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Confirming…" : "I acknowledge I received the refund"}
      </button>
    </div>
  );
}
