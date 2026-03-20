"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Vehicle = {
  vehicle_type: string; plate_number: string;
  make_model: string | null; color: string | null;
  or_cr_number: string; driver_id_type: string; driver_id_number: string;
  or_cr_path: string | null; id_photo_path: string | null;
};

type Reservation = {
  id: string; reference: string; status: string; payment_status: string;
  payment_proof_path: string | null; gcash_transaction_reference: string | null;
  park_date_start: string; park_date_end: string; total_days: number;
  vehicle_count: number; vehicles: Vehicle[];
  total_amount_cents: number; parking_fee_cents: number;
  platform_fee_cents: number; processing_fee_cents: number;
  lot_snapshot_name: string | null; lot_snapshot_distance: string | null;
  customer_full_name: string; customer_email: string; customer_mobile: string | null;
  admin_notes: string | null; created_at: string;
  overstay_days: number; overstay_fee_cents: number;
};

const STATUS_TABS = [
  { value: "pending_payment", label: "Pending",   color: "bg-amber-100 text-amber-800 border-amber-300"    },
  { value: "confirmed",       label: "Confirmed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "checked_in",      label: "Checked In",color: "bg-blue-100 text-blue-800 border-blue-300"       },
  { value: "overstay",        label: "Overstay",  color: "bg-red-100 text-red-800 border-red-300"          },
  { value: "completed",       label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-300"       },
  { value: "all",             label: "All",       color: "bg-gray-100 text-gray-700 border-gray-300"       },
];

const STATUS_BADGE: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed:       "bg-emerald-100 text-emerald-800",
  checked_in:      "bg-blue-100 text-blue-800",
  overstay:        "bg-red-100 text-red-800",
  completed:       "bg-gray-100 text-gray-600",
  cancelled:       "bg-gray-100 text-gray-400",
};

const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };
const TYPE_BADGE: Record<string, string> = {
  car: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  motorcycle: "bg-amber-50 text-amber-800 border border-amber-200",
  van: "bg-blue-50 text-blue-800 border border-blue-200",
};

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });
}

// ── Signed URL preview ────────────────────────────────────────────────────────
async function getSignedUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/parking/signed-url?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    return data.url ?? null;
  } catch { return null; }
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function ReservationDetail({ r, onClose, onAction }: {
  r: Reservation;
  onClose: () => void;
  onAction: (id: string, action: string, notes?: string) => Promise<void>;
}) {
  const [notes, setNotes]           = useState(r.admin_notes ?? "");
  const [acting, setActing]         = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [photoUrls, setPhotoUrls]   = useState<Record<string, string>>({});

  // Fetch signed URLs for docs
  useEffect(() => {
    const paths: Record<string, string> = {};
    r.vehicles.forEach(v => {
      if (v.or_cr_path)    paths[`orcr_${v.plate_number}`]    = v.or_cr_path;
      if (v.id_photo_path) paths[`idphoto_${v.plate_number}`] = v.id_photo_path;
    });
    if (r.payment_proof_path) paths["gcash"] = r.payment_proof_path;

    Promise.all(
      Object.entries(paths).map(async ([key, path]) => {
        const url = await getSignedUrl(path);
        return [key, url] as [string, string | null];
      })
    ).then(results => {
      const map: Record<string, string> = {};
      results.forEach(([key, url]) => { if (url) map[key] = url; });
      setPhotoUrls(map);
    });
  }, [r]);

  async function doAction(action: string) {
    setActing(true); setActionError(null);
    try {
      await onAction(r.id, action, notes);
      onClose();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Action failed.");
    } finally { setActing(false); setConfirming(null); }
  }

  const isPending   = r.status === "pending_payment";
  const hasProof    = !!r.payment_proof_path;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", paddingTop: "2rem", paddingBottom: "2rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl mx-4">

        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-bold uppercase tracking-wide">Parking Booking</p>
            <h2 className="text-xl font-black text-white font-mono">{r.reference}</h2>
            <p className="text-sm text-white/70">{r.lot_snapshot_name} · {r.lot_snapshot_distance}</p>
            <p className="text-xs text-white/50 mt-0.5">{r.customer_full_name} · {r.customer_email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
              {r.status.replace("_", " ")}
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-lg">×</button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 text-sm rounded-xl bg-teal-50 border border-teal-200 p-4">
            <div><p className="text-xs text-gray-400 mb-0.5">Check-in</p><p className="font-semibold text-[#134e4a]">{formatDate(r.park_date_start)}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Check-out</p><p className="font-semibold text-[#134e4a]">{formatDate(r.park_date_end)}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Duration</p><p className="font-semibold text-[#134e4a]">{r.total_days} day{r.total_days > 1 ? "s" : ""}</p></div>
          </div>

          {/* Vehicles */}
          <div className="rounded-xl border-2 border-teal-100 overflow-hidden">
            <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">{r.vehicle_count} Vehicle{r.vehicle_count > 1 ? "s" : ""}</div>
            {r.vehicles.map((v, i) => (
              <div key={i} className={`px-4 py-4 border-b border-teal-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-teal-50/30"}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_BADGE[v.vehicle_type] ?? ""}`}>{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.vehicle_type}</span>
                  <span className="font-bold text-[#134e4a] font-mono text-sm">{v.plate_number}</span>
                  {v.make_model && <span className="text-xs text-gray-400">{v.make_model}</span>}
                  {v.color && <span className="text-xs text-gray-400">· {v.color}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 mb-3">
                  <div><span className="text-gray-400">OR/CR: </span>{v.or_cr_number}</div>
                  <div><span className="text-gray-400">ID: </span>{v.driver_id_type} · {v.driver_id_number}</div>
                </div>
                {/* Doc links */}
                <div className="flex flex-wrap gap-2">
                  {photoUrls[`orcr_${v.plate_number}`] && (
                    <a href={photoUrls[`orcr_${v.plate_number}`]} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors">
                      📄 View OR/CR Photo ↗
                    </a>
                  )}
                  {photoUrls[`idphoto_${v.plate_number}`] && (
                    <a href={photoUrls[`idphoto_${v.plate_number}`]} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
                      🪪 View ID Photo ↗
                    </a>
                  )}
                  {!v.or_cr_path    && <span className="text-xs text-red-500">⚠ No OR/CR photo</span>}
                  {!v.id_photo_path && <span className="text-xs text-red-500">⚠ No ID photo</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Payment */}
          <div className="rounded-xl border-2 border-teal-200 overflow-hidden">
            <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">Payment</div>
            <div className="px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Parking fee</span><span className="font-semibold">{peso(r.parking_fee_cents)}</span></div>
              <div className="flex justify-between text-xs text-gray-400"><span>Platform fee</span><span>{peso(r.platform_fee_cents)}</span></div>
              <div className="flex justify-between text-xs text-gray-400"><span>Processing fee</span><span>{peso(r.processing_fee_cents)}</span></div>
              <div className="flex justify-between pt-2 border-t-2 border-teal-200"><span className="font-black text-[#134e4a]">Total</span><span className="font-black text-lg text-[#0c7b93]">{peso(r.total_amount_cents)}</span></div>
            </div>
            {/* GCash proof */}
            <div className="px-4 pb-4">
              {hasProof ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                    📱 GCash screenshot submitted
                    {r.gcash_transaction_reference && <span className="ml-2 font-mono font-bold">Ref: {r.gcash_transaction_reference}</span>}
                  </div>
                  {photoUrls["gcash"] && (
                    <a href={photoUrls["gcash"]} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
                      📸 View GCash Screenshot ↗
                    </a>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">⚠ No GCash screenshot uploaded</div>
              )}
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <label className="text-xs font-bold text-[#134e4a] uppercase tracking-wide block mb-2">Admin Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add notes about this booking (visible to customer)..."
              className="w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none resize-none" />
            <button onClick={() => doAction("notes")} disabled={acting || !notes.trim()}
              className="mt-2 rounded-xl border-2 border-teal-200 px-4 py-2 text-xs font-semibold text-[#134e4a] hover:bg-teal-50 disabled:opacity-50 transition-colors">
              Save Notes
            </button>
          </div>

          {actionError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>}

          {/* Actions */}
          {isPending && (
            <div className="space-y-3">
              {confirming === "approve" && (
                <div className="rounded-xl bg-emerald-50 border-2 border-emerald-200 p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-3">Confirm approval? This will lock the slot and mark payment as confirmed.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(null)} disabled={acting} className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                    <button onClick={() => doAction("approve")} disabled={acting}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {acting ? "Approving…" : "Yes, Approve"}
                    </button>
                  </div>
                </div>
              )}
              {confirming === "reject" && (
                <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4">
                  <p className="text-sm font-semibold text-red-800 mb-1">Confirm rejection?</p>
                  <p className="text-xs text-red-700 mb-3">Booking will be cancelled. Add a note above to explain why.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(null)} disabled={acting} className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                    <button onClick={() => doAction("reject")} disabled={acting}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {acting ? "Rejecting…" : "Yes, Reject"}
                    </button>
                  </div>
                </div>
              )}
              {!confirming && (
                <div className="flex gap-3">
                  <button onClick={() => setConfirming("reject")} disabled={acting}
                    className="flex-1 rounded-xl border-2 border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    ✕ Reject Booking
                  </button>
                  <button onClick={() => setConfirming("approve")} disabled={acting || !hasProof}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    ✓ Approve &amp; Confirm
                  </button>
                </div>
              )}
              {!hasProof && (
                <p className="text-xs text-amber-700 text-center">⚠ Cannot approve — no GCash screenshot uploaded yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminParkingReservationsPage() {
  const [activeTab, setActiveTab]     = useState("pending_payment");
  const [search, setSearch]           = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Reservation | null>(null);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: activeTab, page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/parking/reservations?${params}`);
      const data = await res.json();
      setReservations(data.reservations ?? []);
      setTotal(data.total ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [activeTab, page, search]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);
  useEffect(() => { setPage(1); }, [activeTab, search]);

  async function handleAction(id: string, action: string, notes?: string) {
    const res = await fetch("/api/admin/parking/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservation_id: id, action, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Action failed.");
    await fetchReservations();
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Admin — Pay Parking</p>
          <h1 className="mt-1 text-2xl font-black text-white">📋 Reservations</h1>
          <p className="text-sm text-white/70 mt-0.5">Review documents, verify GCash payment, approve or reject bookings.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/admin/parking" className="text-xs text-white/60 hover:text-white/90">← Back to Parking</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {/* Search */}
        <div className="mb-4">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by reference, name, or email…"
            className="w-full max-w-md rounded-xl border-2 border-teal-100 bg-white px-4 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${activeTab === tab.value ? tab.color + " shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {tab.label}
              {tab.value === "pending_payment" && total > 0 && activeTab === "pending_payment" && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5">{total}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16"><div className="text-4xl animate-pulse mb-3">📋</div><p className="text-sm text-[#0f766e]">Loading…</p></div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-[#134e4a]">No {activeTab.replace("_", " ")} bookings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map(r => (
              <button key={r.id} onClick={() => setSelected(r)}
                className="w-full text-left rounded-2xl border-2 border-teal-100 bg-white p-5 hover:border-[#0c7b93] hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-black text-[#0c7b93]">{r.reference}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                      {!r.payment_proof_path && r.status === "pending_payment" && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">⚠ No payment proof</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#134e4a]">{r.customer_full_name}</p>
                    <p className="text-xs text-gray-400">{r.customer_email}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      <span>{r.lot_snapshot_name}</span>
                      <span>·</span>
                      <span>{formatDate(r.park_date_start)} → {formatDate(r.park_date_end)}</span>
                      <span>·</span>
                      <span>{r.vehicle_count} vehicle{r.vehicle_count > 1 ? "s" : ""}</span>
                    </div>
                    {/* Plates preview */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.vehicles?.map((v, i) => (
                        <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-lg text-[#0c7b93]">{peso(r.total_amount_cents)}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                    <p className="text-xs text-[#0c7b93] group-hover:translate-x-1 transition-transform mt-1">View details →</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 disabled:opacity-50">
              ← Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages} · {total} total</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 disabled:opacity-50">
              Next →
            </button>
          </div>
        )}
      </div>

      {selected && (
        <ReservationDetail
          r={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
