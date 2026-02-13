"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

const REASON_OPTIONS = [
  { value: "weather_disturbance", label: "Weather disturbance" },
  { value: "vessel_cancellation", label: "Vessel cancellation" },
] as const;

export function RequestRefundButton({
  reference,
  refundRequestedAt,
}: {
  reference: string;
  refundRequestedAt: string | null | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const requested = !!refundRequestedAt;

  if (requested) {
    return (
      <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
        <h2 className="text-base font-semibold text-amber-900">Refund request submitted</h2>
        <p className="mt-2 text-sm text-amber-800">
          We have received your refund request and will review it. Refunds are processed only for weather disturbance or
          vessel cancellation. Check this page for updates.
        </p>
        <p className="mt-2 text-xs text-amber-700">
          If you have questions, contact us at the ticket booth or through our official channels.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.showError("Please select a reason.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/booking/request-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, reason, notes: notes.slice(0, 500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      toast.showSuccess(data.message ?? "Refund request submitted.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-[#0c7b93] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5 transition-colors"
        >
          Request refund
        </button>
      ) : (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">Request a refund</h2>
          <p className="mt-2 text-sm text-amber-800">
            Refunds are only processed for <strong>weather disturbance</strong> or <strong>vessel cancellation</strong>.
            Our team will review your request.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="refund-reason" className="block text-sm font-medium text-amber-900">
                Reason *
              </label>
              <select
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select a reason</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="refund-notes" className="block text-sm font-medium text-amber-900">
                Additional notes (optional)
              </label>
              <textarea
                id="refund-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. Trip was cancelled due to storm."
                className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 placeholder:text-amber-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Submitting…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-xl border border-amber-400 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
