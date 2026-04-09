"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcknowledgePaymentButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleAck() {
    if (!confirm("Confirm you received this payment from admin?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vessel-owner/acknowledge-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        ✓ Received
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAck}
        disabled={loading}
        className="inline-flex items-center rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Saving…" : "✓ Acknowledge Receipt"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}