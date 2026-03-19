"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parking/cancel/${bookingId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Cancel failed."); setConfirming(false); return; }
      router.push("/dashboard/parking");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="w-full rounded-2xl border-2 border-red-200 bg-red-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-red-800">Cancel this booking?</p>
        <p className="text-xs text-red-700">This cannot be undone. Your booking will be marked cancelled and the slot released.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} disabled={loading}
            className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Keep Booking
          </button>
          <button onClick={handleCancel} disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="rounded-xl border-2 border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
      Cancel Booking
    </button>
  );
}
