"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

const REASON_OPTIONS = [
  { value: "weather_disturbance", label: "Weather disturbance" },
  { value: "vessel_cancellation", label: "Vessel cancellation" },
] as const;

type RefundStatus = "pending" | "under_review" | "approved" | "rejected" | "processed" | null | undefined;

function AdminNoteBox({ note }: { note: string }) {
  return (
    <div className="mt-2 rounded-lg border border-current/20 bg-white/50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Note from admin</p>
      <p className="mt-0.5 text-sm">{note}</p>
    </div>
  );
}

function RefundStatusBanner({ refundStatus, refundAdminNotes }: { refundStatus: RefundStatus; refundAdminNotes?: string | null }) {
  if (refundStatus === "pending") {
    return (
      <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <h2 className="text-base font-semibold text-amber-900">Refund request submitted</h2>
        </div>
        <p className="mt-2 text-sm text-amber-800">We have received your refund request and our team will review it shortly.</p>
        <p className="mt-2 text-xs font-medium text-amber-700">Status: Waiting for review</p>
        {refundAdminNotes && <AdminNoteBox note={refundAdminNotes} />}
      </div>
    );
  }
  if (refundStatus === "under_review") {
    return (
      <div className="mt-6 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-base font-semibold text-blue-900">Refund under review</h2>
        </div>
        <p className="mt-2 text-sm text-blue-800">Our team is currently reviewing your refund request. We will update you once a decision has been made.</p>
        <p className="mt-2 text-xs font-medium text-blue-700">Status: Under review</p>
        {refundAdminNotes && <AdminNoteBox note={refundAdminNotes} />}
      </div>
    );
  }
  if (refundStatus === "approved") {
    return (
      <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <h2 className="text-base font-semibold text-emerald-900">Refund approved</h2>
        </div>
        <p className="mt-2 text-sm text-emerald-800">Your refund has been approved. Our team will process the transfer shortly — check the note below for details.</p>
        <p className="mt-2 text-xs font-medium text-emerald-700">Status: Approved — transfer in progress</p>
        {refundAdminNotes && <AdminNoteBox note={refundAdminNotes} />}
      </div>
    );
  }
  if (refundStatus === "processed") {
    return (
      <div className="mt-6 rounded-xl border-2 border-teal-200 bg-teal-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">💸</span>
          <h2 className="text-base font-semibold text-teal-900">Refund sent</h2>
        </div>
        <p className="mt-2 text-sm text-teal-800">Your refund has been processed and sent. Please check the note below for transfer details.</p>
        <p className="mt-2 text-xs font-medium text-teal-700">Status: Processed — check transfer details below</p>
        {refundAdminNotes && <AdminNoteBox note={refundAdminNotes} />}
      </div>
    );
  }
  if (refundStatus === "rejected") {
    return (
      <div className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">❌</span>
          <h2 className="text-base font-semibold text-red-900">Refund request rejected</h2>
        </div>
        <p className="mt-2 text-sm text-red-800">Unfortunately your refund request was not approved. Please visit the ticket booth or contact us for more information.</p>
        <p className="mt-2 text-xs font-medium text-red-700">Status: Rejected</p>
        {refundAdminNotes && <AdminNoteBox note={refundAdminNotes} />}
      </div>
    );
  }
  return null;
}

export function RequestRefundButton({
  reference,
  refundRequestedAt,
  refundStatus,
  refundAdminNotes,
}: {
  reference: string;
  refundRequestedAt: string | null | undefined;
  refundStatus?: RefundStatus;
  refundAdminNotes?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const requested = !!refundRequestedAt;

  if (requested) {
    return <RefundStatusBanner refundStatus={refundStatus} refundAdminNotes={refundAdminNotes} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { toast.showError("Please select a reason."); return; }
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
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-[#0c7b93] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5 transition-colors">
          Request refund
        </button>
      ) : (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">Request a refund</h2>
          <p className="mt-2 text-sm text-amber-800">
            Refunds are only processed for <strong>weather disturbance</strong> or <strong>vessel cancellation</strong>. Our team will review your request.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="refund-reason" className="block text-sm font-medium text-amber-900">Reason *</label>
              <select id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} required
                className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 focus:border-amber-500 focus:outline-none">
                <option value="">Select a reason</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="refund-notes" className="block text-sm font-medium text-amber-900">Additional notes (optional)</label>
              <textarea id="refund-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500}
                placeholder="e.g. Trip was cancelled due to storm."
                className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 placeholder:text-amber-500 focus:border-amber-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                {loading ? "Submitting…" : "Submit request"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={loading}
                className="rounded-xl border border-amber-400 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
