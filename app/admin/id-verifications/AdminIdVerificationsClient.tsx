"use client";

import { useState, useEffect, useCallback } from "react";

type IdRecord = {
  id: string;
  passenger_name: string;
  discount_type: string;
  verification_status: string;
  id_image_url: string | null;
  uploaded_at: string | null;
  expires_at: string | null;
  renewal_requested_at: string | null;
  renewal_notified_at: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  profile_id: string | null;
  profile_email?: string | null;
  booking_reference?: string | null;
};

type Filter = "all" | "pending" | "verified" | "rejected" | "expiring" | "renewal_needed";

const DISCOUNT_LABELS: Record<string, string> = {
  senior: "Senior Citizen",
  pwd: "PWD",
  student: "Student",
  child: "Child",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:  { label: "Pending",  badge: "bg-amber-100 text-amber-800 border-amber-300" },
  verified: { label: "Verified", badge: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-800 border-red-300" },
};

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 30; // within 30 days
}
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function AdminIdVerificationsClient() {
  const [records, setRecords] = useState<IdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<IdRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [renewalMessage, setRenewalMessage] = useState("");
  const [imgExpanded, setImgExpanded] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/id-verifications");
      const data = await res.json();
      if (res.ok) setRecords(data.records ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.passenger_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.profile_email?.toLowerCase().includes(search.toLowerCase()) ||
      r.booking_reference?.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (filter === "pending")        return r.verification_status === "pending";
    if (filter === "verified")       return r.verification_status === "verified";
    if (filter === "rejected")       return r.verification_status === "rejected";
    if (filter === "expiring")       return isExpiringSoon(r.expires_at);
    if (filter === "renewal_needed") return !!r.renewal_requested_at;
    return true;
  });

  const counts = {
    all:            records.length,
    pending:        records.filter(r => r.verification_status === "pending").length,
    verified:       records.filter(r => r.verification_status === "verified").length,
    rejected:       records.filter(r => r.verification_status === "rejected").length,
    expiring:       records.filter(r => isExpiringSoon(r.expires_at)).length,
    renewal_needed: records.filter(r => !!r.renewal_requested_at).length,
  };

  async function doAction(action: "verify" | "reject" | "request_renewal") {
    if (!selected) return;
    setActionLoading(true);
    setSuccessMsg(""); setErrorMsg("");
    try {
      const res = await fetch("/api/admin/id-verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          action,
          admin_note: adminNote || null,
          rejection_reason: action === "reject" ? (rejectionReason || "Please resubmit a clear, valid ID.") : null,
          renewal_message: action === "request_renewal" ? (renewalMessage || "Your ID has expired. Please upload a new one.") : null,
          profile_id: selected.profile_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "Action failed"); return; }
      setSuccessMsg(
        action === "verify" ? "ID verified successfully." :
        action === "reject" ? "ID rejected. Passenger notified." :
        "Renewal request sent to passenger."
      );
      setSelected(null);
      setAdminNote(""); setRejectionReason(""); setRenewalMessage("");
      fetchRecords();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">ID Verifications</h1>
          <p className="text-sm text-[#0f766e] mt-0.5">
            Review uploaded discount IDs for Senior, PWD, Student, and Child passengers.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRecords}
          className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50"
        >
          ↻ Refresh
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3">
          <p className="text-sm font-semibold text-green-800">✓ {successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">⚠ {errorMsg}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["pending","verified","rejected","expiring","renewal_needed","all"] as Filter[]).map(f => {
          const labels: Record<Filter, string> = {
            pending: "Pending",
            verified: "Verified",
            rejected: "Rejected",
            expiring: "Expiring Soon",
            renewal_needed: "Renewal Needed",
            all: "All",
          };
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-[#0c7b93] border-[#0c7b93] text-white"
                  : "border-teal-200 text-[#0f766e] hover:bg-teal-50"
              }`}
            >
              {labels[f]} ({counts[f]})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, email, or booking reference…"
        className="w-full rounded-xl border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
      />

      {/* Records list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-[#0f766e] animate-pulse">Loading ID verifications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-6 py-8 text-center">
          <p className="text-sm text-[#0f766e]">No records found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => {
            const expired = isExpired(record.expires_at);
            const expiring = isExpiringSoon(record.expires_at);
            const statusCfg = STATUS_CONFIG[record.verification_status] ?? STATUS_CONFIG.pending;
            return (
              <div
                key={record.id}
                className={`rounded-xl border-2 bg-white p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === record.id ? "border-[#0c7b93] shadow-md" :
                  expired ? "border-red-200" :
                  expiring ? "border-amber-200" :
                  "border-teal-100"
                }`}
                onClick={() => {
                  setSelected(selected?.id === record.id ? null : record);
                  setAdminNote(record.admin_note ?? "");
                  setRejectionReason(record.rejection_reason ?? "");
                  setRenewalMessage("");
                  setImgExpanded(false);
                  setSuccessMsg(""); setErrorMsg("");
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#134e4a]">{record.passenger_name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                        {DISCOUNT_LABELS[record.discount_type] ?? record.discount_type}
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusCfg.badge}`}>
                        {statusCfg.label}
                      </span>
                      {expired && (
                        <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">
                          Expired
                        </span>
                      )}
                      {expiring && !expired && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          Expiring soon
                        </span>
                      )}
                      {record.renewal_requested_at && (
                        <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          Renewal requested
                        </span>
                      )}
                    </div>
                    {record.profile_email && (
                      <p className="text-xs text-slate-500">{record.profile_email}</p>
                    )}
                    {record.booking_reference && (
                      <p className="text-xs text-slate-400 font-mono">Ref: {record.booking_reference}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-400 space-y-0.5">
                    {record.uploaded_at && (
                      <p>Uploaded: {new Date(record.uploaded_at).toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })}</p>
                    )}
                    {record.expires_at && (
                      <p className={expired ? "text-red-600 font-semibold" : expiring ? "text-amber-600 font-semibold" : ""}>
                        Expires: {new Date(record.expires_at).toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expanded panel */}
                {selected?.id === record.id && (
                  <div className="mt-4 space-y-4 border-t border-teal-100 pt-4" onClick={e => e.stopPropagation()}>

                    {/* ID Image */}
                    {record.id_image_url ? (
                      <div>
                        <p className="text-xs font-semibold text-[#0f766e] mb-2">Uploaded ID</p>
                        {imgExpanded ? (
                          <div className="space-y-2">
                            <img
                              src={record.id_image_url}
                              alt="Passenger ID"
                              className="w-full max-h-96 rounded-xl border border-slate-200 object-contain"
                              onError={e => { (e.target as HTMLImageElement).alt = "Image failed to load"; }}
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setImgExpanded(false)} className="text-xs text-blue-600 underline">Hide</button>
                              <a href={record.id_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Open in new tab ↗</a>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setImgExpanded(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            👁 View ID photo
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No image uploaded.</p>
                    )}

                    {/* Admin note */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0f766e] mb-1">
                        Admin note (optional — visible to crew on scan)
                      </label>
                      <textarea
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        rows={2}
                        placeholder="e.g. Verified OSCA ID #12345"
                        className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93] resize-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {/* Verify */}
                      <button
                        type="button"
                        onClick={() => doAction("verify")}
                        disabled={actionLoading || record.verification_status === "verified"}
                        className="min-h-[44px] rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
                      >
                        {actionLoading ? "Processing…" : "✓ Verify ID"}
                      </button>

                      {/* Reject */}
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={e => setRejectionReason(e.target.value)}
                          placeholder="Rejection reason (optional)"
                          className="w-full rounded-lg border border-red-200 px-3 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-red-400"
                        />
                        <button
                          type="button"
                          onClick={() => doAction("reject")}
                          disabled={actionLoading}
                          className="w-full min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
                        >
                          ✕ Reject ID
                        </button>
                      </div>

                      {/* Request renewal */}
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={renewalMessage}
                          onChange={e => setRenewalMessage(e.target.value)}
                          placeholder="Renewal message (optional)"
                          className="w-full rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => doAction("request_renewal")}
                          disabled={actionLoading}
                          className="w-full min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          🔄 Request Renewal
                        </button>
                      </div>
                    </div>

                    {errorMsg && (
                      <p className="text-xs font-semibold text-red-700">⚠ {errorMsg}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
