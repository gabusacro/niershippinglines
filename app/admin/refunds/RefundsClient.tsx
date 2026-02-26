"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type RefundStatus = "requested" | "under_review" | "approved" | "rejected" | "processed";
type RefundType = "full" | "partial" | "voucher";

interface RefundItem {
  id: string;
  booking_id: string;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  passenger_count: number;
  booking_total_cents: number;
  vessel_name: string | null;
  route_name: string | null;
  departure_date: string | null;
  amount_cents: number;
  reason: string;
  status: RefundStatus;
  refund_type: RefundType;
  policy_basis: string | null;
  requested_by_name: string;
  requested_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  processed_at: string | null;
  processed_by_name: string | null;
  gcash_reference: string | null;
  rejection_reason: string | null;
  affected_ticket_numbers: string[] | null;
  admin_notes: string | null;
}

interface Props {
  initialItems: RefundItem[];
  currentUserId: string;
}

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

const STATUS_COLORS: Record<RefundStatus, string> = {
  requested: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  processed: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Requested",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  processed: "Processed",
};

const POLICY_LABELS: Record<string, string> = {
  weather: "Weather",
  vessel_unable: "Vessel Unable",
  schedule_change: "Schedule Change",
  other: "Other",
};

export function RefundsClient({ initialItems, currentUserId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filterStatus, setFilterStatus] = useState<RefundStatus | "all">("requested");
  const [selected, setSelected] = useState<RefundItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Action modal state
  const [actionType, setActionType] = useState<"approve" | "reject" | "process" | "review" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const reload = async () => {
    const res = await fetch("/api/admin/refunds");
    const data = await res.json();
    if (Array.isArray(data)) setItems(data);
  };

  const handleAction = async () => {
    if (!selected || !actionType) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = { action: actionType };
      if (actionType === "reject") {
        if (!rejectionReason.trim()) { setError("Rejection reason is required."); setLoading(false); return; }
        body.rejection_reason = rejectionReason.trim();
      }
      if (actionType === "process") {
        body.gcash_reference = gcashRef.trim() || null;
      }
      if (actionType === "approve") {
        if (refundAmount) body.amount_cents = Math.round(parseFloat(refundAmount) * 100);
      }
      if (adminNotes.trim()) body.admin_notes = adminNotes.trim();

      const res = await fetch(`/api/admin/refunds/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      setSuccess(`Refund ${actionType === "review" ? "marked as under review" : actionType + "d"} successfully.`);
      setActionType(null);
      setSelected(null);
      setRejectionReason("");
      setGcashRef("");
      setAdminNotes("");
      setRefundAmount("");
      await reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterStatus === "all" ? items : items.filter((i) => i.status === filterStatus);

  const counts = {
    all: items.length,
    requested: items.filter((i) => i.status === "requested").length,
    under_review: items.filter((i) => i.status === "under_review").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    processed: items.filter((i) => i.status === "processed").length,
  };

  return (
    <div className="mt-6 space-y-4">
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
          ✅ {success}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["requested", "under_review", "approved", "processed", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filterStatus === s
                ? "bg-[#0c7b93] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s as RefundStatus]}
            {counts[s] > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                filterStatus === s ? "bg-white/20 text-white" : "bg-white text-gray-600"
              }`}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Refunds table */}
      <div className="overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#0f766e]">
            No refunds with status &quot;{filterStatus}&quot;.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Booking</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Passenger</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Trip</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Requested</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[#134e4a]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-teal-50/40">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-bold text-[#0c7b93]">{item.booking_reference}</p>
                    <p className="text-xs text-[#0f766e]">{item.refund_type} · {item.policy_basis ? POLICY_LABELS[item.policy_basis] ?? item.policy_basis : "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#134e4a]">{item.customer_name}</p>
                    <p className="text-xs text-[#0f766e]">{item.passenger_count} pax</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#134e4a]">{item.vessel_name ?? "—"}</p>
                    <p className="text-xs text-[#0f766e]">{item.departure_date ?? item.route_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-[#134e4a]">{peso(item.amount_cents)}</p>
                    <p className="text-xs text-[#0f766e]">of {peso(item.booking_total_cents)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.gcash_reference && (
                      <p className="mt-0.5 text-xs text-[#0f766e]">GCash: {item.gcash_reference}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#0f766e]">
                    {formatDate(item.requested_at)}
                    <p className="text-[#0f766e]/70">by {item.requested_by_name}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setSelected(item); setActionType(null); setError(""); setSuccess(""); setRefundAmount((item.amount_cents / 100).toString()); }}
                      className="rounded-lg bg-[#0c7b93]/10 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/20 transition-colors"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail / Action Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) { setSelected(null); setActionType(null); setError(""); } }}>
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-100 bg-white px-5 py-4">
              <h2 className="text-base font-bold text-[#134e4a]">Refund — {selected.booking_reference}</h2>
              <button type="button" onClick={() => { setSelected(null); setActionType(null); setError(""); }}
                className="rounded-lg p-1.5 text-[#0f766e] hover:bg-teal-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Booking info */}
              <div className="rounded-lg border border-teal-100 bg-teal-50/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Passenger</span>
                  <span className="font-medium text-[#134e4a]">{selected.customer_name} ({selected.passenger_count} pax)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Email</span>
                  <span className="text-[#134e4a]">{selected.customer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Vessel</span>
                  <span className="text-[#134e4a]">{selected.vessel_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Departure</span>
                  <span className="text-[#134e4a]">{selected.departure_date ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Booking total</span>
                  <span className="font-semibold text-[#134e4a]">{peso(selected.booking_total_cents)}</span>
                </div>
              </div>

              {/* Refund details */}
              <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-700">Refund amount</span>
                  <span className="font-bold text-amber-900">{peso(selected.amount_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Type</span>
                  <span className="text-amber-900 capitalize">{selected.refund_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Policy basis</span>
                  <span className="text-amber-900">{selected.policy_basis ? POLICY_LABELS[selected.policy_basis] ?? selected.policy_basis : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Status</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                </div>
                {selected.reason && (
                  <div>
                    <p className="text-amber-700">Reason</p>
                    <p className="mt-0.5 text-amber-900">{selected.reason}</p>
                  </div>
                )}
                {selected.rejection_reason && (
                  <div>
                    <p className="text-red-600">Rejection reason</p>
                    <p className="mt-0.5 text-red-700">{selected.rejection_reason}</p>
                  </div>
                )}
                {selected.gcash_reference && (
                  <div className="flex justify-between">
                    <span className="text-amber-700">GCash ref</span>
                    <span className="font-mono text-amber-900">{selected.gcash_reference}</span>
                  </div>
                )}
                {selected.admin_notes && (
                  <div>
                    <p className="text-amber-700">Admin notes</p>
                    <p className="mt-0.5 text-amber-900">{selected.admin_notes}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="text-xs text-[#0f766e] space-y-0.5">
                {selected.requested_at && <p>📋 Requested {formatDate(selected.requested_at)} by {selected.requested_by_name}</p>}
                {selected.approved_at && <p>✅ Approved {formatDate(selected.approved_at)} by {selected.approved_by_name}</p>}
                {selected.processed_at && <p>💸 Processed {formatDate(selected.processed_at)} by {selected.processed_by_name}</p>}
              </div>

              {/* Link to booking */}
              <Link href={`/admin/bookings/${selected.booking_id}`} className="block text-xs font-semibold text-[#0c7b93] hover:underline">
                View full booking →
              </Link>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              {/* Action buttons */}
              {!actionType && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-teal-100">
                  {["requested", "under_review"].includes(selected.status) && (
                    <>
                      {selected.status === "requested" && (
                        <button type="button" onClick={() => setActionType("review")}
                          className="rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-200">
                          Mark Under Review
                        </button>
                      )}
                      <button type="button" onClick={() => setActionType("approve")}
                        className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-200">
                        Approve
                      </button>
                      <button type="button" onClick={() => setActionType("reject")}
                        className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200">
                        Reject
                      </button>
                    </>
                  )}
                  {selected.status === "approved" && (
                    <button type="button" onClick={() => setActionType("process")}
                      className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]">
                      Mark as Processed (GCash sent)
                    </button>
                  )}
                  {selected.status === "processed" && (
                    <p className="text-sm text-[#0f766e]">✅ This refund has been fully processed.</p>
                  )}
                  {selected.status === "rejected" && (
                    <p className="text-sm text-red-600">❌ This refund was rejected.</p>
                  )}
                </div>
              )}

              {/* Review action */}
              {actionType === "review" && (
                <div className="space-y-3 border-t border-teal-100 pt-3">
                  <p className="text-sm font-semibold text-[#134e4a]">Mark as Under Review</p>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Admin notes (optional)</label>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
                      placeholder="Internal notes..."
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAction} disabled={loading}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {loading ? "Saving…" : "Confirm"}
                    </button>
                    <button type="button" onClick={() => setActionType(null)}
                      className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Approve action */}
              {actionType === "approve" && (
                <div className="space-y-3 border-t border-teal-100 pt-3">
                  <p className="text-sm font-semibold text-[#134e4a]">Approve Refund</p>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Refund amount (₱)</label>
                    <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                    <p className="mt-0.5 text-xs text-[#0f766e]">Default is full requested amount. Adjust for partial.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Admin notes (optional)</label>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
                      placeholder="Internal notes..."
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAction} disabled={loading}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {loading ? "Saving…" : "Approve Refund"}
                    </button>
                    <button type="button" onClick={() => setActionType(null)}
                      className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reject action */}
              {actionType === "reject" && (
                <div className="space-y-3 border-t border-teal-100 pt-3">
                  <p className="text-sm font-semibold text-[#134e4a]">Reject Refund</p>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Rejection reason <span className="text-red-500">*</span></label>
                    <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} required
                      placeholder="e.g. Booking is past refund eligibility period..."
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAction} disabled={loading || !rejectionReason.trim()}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {loading ? "Saving…" : "Reject Refund"}
                    </button>
                    <button type="button" onClick={() => setActionType(null)}
                      className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Process action */}
              {actionType === "process" && (
                <div className="space-y-3 border-t border-teal-100 pt-3">
                  <p className="text-sm font-semibold text-[#134e4a]">Mark as Processed</p>
                  <p className="text-sm text-[#0f766e]">Confirm you have sent <strong>{peso(selected.amount_cents)}</strong> via GCash to the passenger.</p>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">GCash reference number (optional)</label>
                    <input type="text" value={gcashRef} onChange={(e) => setGcashRef(e.target.value)}
                      placeholder="e.g. 0946XXXXXXX or transaction ref"
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Admin notes (optional)</label>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2}
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAction} disabled={loading}
                      className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                      {loading ? "Saving…" : "Confirm Processed"}
                    </button>
                    <button type="button" onClick={() => setActionType(null)}
                      className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
