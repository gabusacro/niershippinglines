"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  tripId: string;
  currentStatus: "pending" | "paid" | "failed";
  currentReference?: string | null;
}

export function MarkTripPaidButton({ tripId, currentStatus, currentReference }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"manual" | "gcash" | "bank">("gcash");
  const [reference, setReference] = useState(currentReference ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMarkPaid = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/trip-payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId, payment_method: method, payment_reference: reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark as paid.");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!confirm("Revert this payment to Pending?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trip-payments/mark-paid", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (currentStatus === "paid") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
          ✓ Paid
        </span>
        <button onClick={handleUndo} disabled={loading}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors">
          undo
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 transition-colors">
        ⏳ Mark Paid
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-teal-100 p-6">
            <h3 className="text-base font-bold text-[#134e4a]">Mark Trip as Paid</h3>
            <p className="mt-1 text-xs text-[#0f766e]">Record that you've transferred the gross fare to the vessel owner.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#134e4a]">Payment Method</label>
                <div className="mt-1.5 flex gap-2">
                  {(["gcash", "bank", "manual"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMethod(m)}
                      className={`flex-1 rounded-lg border-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                        method === m
                          ? "border-[#0c7b93] bg-[#0c7b93] text-white"
                          : "border-teal-200 text-[#134e4a] hover:bg-teal-50"
                      }`}>
                      {m === "gcash" ? "GCash" : m === "bank" ? "Bank" : "Manual"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#134e4a]">
                  {method === "gcash" ? "GCash Reference No." : method === "bank" ? "Bank Reference No." : "Notes (optional)"}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method === "gcash" ? "e.g. 1234567890" : method === "bank" ? "e.g. TRF-XXXXX" : "Optional note"}
                  className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={handleMarkPaid} disabled={loading}
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                {loading ? "Saving…" : "✓ Confirm Paid"}
              </button>
              <button onClick={() => setOpen(false)} disabled={loading}
                className="flex-1 rounded-xl border-2 border-teal-200 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
