"use client";

import { useState } from "react";
import Link from "next/link";

type PendingPackage = {
  id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  joiner_price_cents: number | null;
  private_price_cents: number | null;
  private_is_negotiable: boolean;
  pickup_time_label: string | null;
  end_time_label: string | null;
  duration_label: string | null;
  meeting_point: string | null;
  cancellation_policy: string | null;
  accepts_joiners: boolean;
  accepts_private: boolean;
  approval_status: string;
  operator_name: string;
  created_at: string;
};

interface Props {
  pendingPackages: PendingPackage[];
  markupCents: number;
}

export default function AdminPackagesApprovalClient({ pendingPackages, markupCents }: Props) {
  const [packages, setPackages] = useState(pendingPackages);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/tours/packages/${id}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        setPackages(prev => prev.filter(p => p.id !== id));
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/tours/packages/${id}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", note: rejectNote }),
      });
      if (res.ok) {
        setPackages(prev => prev.filter(p => p.id !== id));
        setRejectingId(null);
        setRejectNote("");
        setActionId(null);
      }
    } finally {
      setProcessing(null);
    }
  }

  if (packages.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-bold text-amber-900">⏳ Pending Approval ({packages.length})</h2>
        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
          Operator Packages
        </span>
      </div>

      <div className="space-y-4">
        {packages.map(pkg => (
          <div key={pkg.id} className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="font-bold text-[#134e4a]">{pkg.title}</p>
                <p className="text-xs text-amber-700 font-semibold mt-0.5">
                  By: {pkg.operator_name} · Submitted {new Date(pkg.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                {pkg.short_description && (
                  <p className="text-xs text-gray-500 mt-1">{pkg.short_description}</p>
                )}
              </div>
              <div className="flex gap-2">
                {pkg.accepts_joiners && pkg.joiner_price_cents && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Guest pays</p>
                    <p className="text-sm font-bold text-emerald-700">
                      ₱{((pkg.joiner_price_cents + markupCents) / 100).toLocaleString()}/pax
                    </p>
                    <p className="text-xs text-gray-400">
                      Operator: ₱{(pkg.joiner_price_cents / 100).toLocaleString()} + ₱{(markupCents / 100)} markup
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Package details */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              {pkg.duration_label && (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-400">Duration: </span>
                  <span className="font-semibold text-gray-700">{pkg.duration_label}</span>
                </div>
              )}
              {pkg.meeting_point && (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-400">Meeting: </span>
                  <span className="font-semibold text-gray-700">{pkg.meeting_point}</span>
                </div>
              )}
              {pkg.pickup_time_label && (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-400">Pickup: </span>
                  <span className="font-semibold text-gray-700">{pkg.pickup_time_label}</span>
                </div>
              )}
              {pkg.accepts_private && (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-400">Private: </span>
                  <span className="font-semibold text-gray-700">
                    {pkg.private_is_negotiable ? "Negotiable" : pkg.private_price_cents ? `₱${(pkg.private_price_cents / 100).toLocaleString()}` : "—"}
                  </span>
                </div>
              )}
            </div>

            {pkg.cancellation_policy && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 mb-3">
                <p className="text-xs font-semibold text-blue-700">Cancellation Policy:</p>
                <p className="text-xs text-blue-600 mt-0.5">{pkg.cancellation_policy}</p>
              </div>
            )}

            {/* Reject note input */}
            {rejectingId === pkg.id && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-red-700 mb-1">
                  Rejection reason (required — operator will see this):
                </label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please add more details to the description..."
                  className="w-full rounded-xl border-2 border-red-200 px-3 py-2 text-xs focus:outline-none focus:border-red-400 resize-none"
                  autoFocus
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {rejectingId !== pkg.id ? (
                <>
                  <button
                    onClick={() => handleApprove(pkg.id)}
                    disabled={processing === pkg.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                    {processing === pkg.id ? "..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => { setRejectingId(pkg.id); setRejectNote(""); }}
                    className="px-4 py-2 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors">
                    ❌ Reject
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleReject(pkg.id)}
                    disabled={processing === pkg.id || !rejectNote.trim()}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                    {processing === pkg.id ? "..." : "Confirm Reject"}
                  </button>
                  <button
                    onClick={() => { setRejectingId(null); setRejectNote(""); }}
                    className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
