"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function RefundBookingButton({
  bookingId,
  totalAmountCents,
}: {
  bookingId: string;
  totalAmountCents: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState<"weather_disturbance" | "vessel_cancellation">("weather_disturbance");
  const [gcashRef, setGcashRef] = useState("");
  const [loading, setLoading] = useState(false);

  const amount = (totalAmountCents / 100).toLocaleString();

  async function handleRefund() {
    if (!confirm(`Refund ₱${amount} for this booking? Per policy: only for weather disturbance or vessel cancellation.`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, gcash_reference: gcashRef.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      toast.showSuccess("Refund processed");
      setShow(false);
      setReason("weather_disturbance");
      setGcashRef("");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not process refund.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="rounded-xl border-2 border-amber-500 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
      >
        {show ? "Cancel" : "Refund"}
      </button>
      {show && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs text-amber-800 mb-2">
            Per policy: Refunds only for weather disturbance or vessel cancellation.
          </p>
          <label className="block text-sm font-semibold text-amber-900 mb-1">Reason (required):</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as "weather_disturbance" | "vessel_cancellation")}
            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm mb-3"
          >
            <option value="weather_disturbance">Weather disturbance</option>
            <option value="vessel_cancellation">Vessel cancellation by operator</option>
          </select>
          <label className="block text-sm font-semibold text-amber-900 mb-1">GCash transaction reference:</label>
          <input
            type="text"
            value={gcashRef}
            onChange={(e) => setGcashRef(e.target.value)}
            placeholder="Optional — for traceability"
            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefund}
              disabled={loading}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Processing…" : "Confirm refund"}
            </button>
            <button
              type="button"
              onClick={() => { setShow(false); setGcashRef(""); }}
              className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
