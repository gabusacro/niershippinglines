"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ParkingQRScanner = dynamic(
  () => import("@/components/parking/ParkingQRScanner"),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────
type Lot = {
  id: string; name: string; address: string; distance_from_port: string | null;
  total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number;
  accepts_car: boolean; accepts_motorcycle: boolean; accepts_van: boolean;
  car_rate_cents: number | null; motorcycle_rate_cents: number | null; van_rate_cents: number | null;
  is_active: boolean; is_24hrs: boolean;
} | null;

type CrewMember = { id: string; crew_id: string; full_name: string; email: string; avatar_url: string | null };
type Avail = { booked_car: number; booked_motorcycle: number; booked_van: number };
type Booking = {
  id: string; reference: string; status: string;
  park_date_start: string; park_date_end: string; total_days: number;
  vehicle_count: number;
  vehicles: {
    vehicle_type: string; plate_number: string;
    make_model?: string | null; color?: string | null;
    or_cr_path?: string | null; id_photo_path?: string | null;
  }[];
  customer_full_name: string;
  parking_fee_cents: number; commission_cents: number;
  checked_in_at: string | null; checked_out_at: string | null; checked_in_by_name: string | null;
  payment_proof_path: string | null;
  gcash_transaction_reference: string | null;
};


type PendingExtension = {
  id: string; reference: string; reservation_id: string;
  reservation_reference: string; customer_full_name: string;
  additional_days: number; new_end_date: string;
  total_amount_cents: number; payment_status: string; created_at: string;
};

interface Props {
  ownerId: string; ownerName: string; ownerEmail: string; avatarUrl: string | null;
  lot: Lot; crew: CrewMember[]; availability: Avail;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };
const STATUS_BADGE: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed:       "bg-emerald-100 text-emerald-800",
  checked_in:      "bg-blue-100 text-blue-800",
  overstay:        "bg-red-100 text-red-800",
  completed:       "bg-gray-100 text-gray-600",
};
const PHOTO_LABELS = [
  { value: "arrival",   label: "Arrival condition" },
  { value: "departure", label: "Departure condition" },
  { value: "damage",    label: "Damage noted" },
  { value: "other",     label: "Other" },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
function getRange(period: string) {
  const today = getTodayManila();
  if (period === "today") return { start: today, end: today };
  if (period === "week") {
    const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - d.getDay());
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] };
  }
  const d = new Date();
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0],
    end:   new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}
async function compressToWebP(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400; let { width, height } = img;
      if (width > MAX || height > MAX) { if (width > height) { height = Math.round((height / width) * MAX); width = MAX; } else { width = Math.round((width / height) * MAX); height = MAX; } }
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const tryQ = (q: number) => { c.toBlob((blob) => { if (!blob) { resolve(file); return; } if (blob.size > 3 * 1024 * 1024 && q > 0.55) { tryQ(q - 0.15); return; } resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: Date.now() })); }, "image/webp", q); };
      tryQ(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; img.src = url;
  });
}

// ── Booking Detail Modal ──────────────────────────────────────────────────────
// ── Signed URL helper (reuses admin endpoint — already allows owner/crew) ────
async function getSignedUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/parking/signed-url?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    return data.url ?? null;
  } catch { return null; }
}

// ── Booking Detail Modal ──────────────────────────────────────────────────────
function BookingDetailModal({ selected, onClose, onCheckIn, onCheckOut, actionLoading, actionMsg, onRefresh }: {
  selected: Booking; onClose: () => void;
  onCheckIn: (id: string) => void; onCheckOut: (id: string) => void;
  actionLoading: boolean; actionMsg: string | null;
  onRefresh: () => void;
}) {
  const [photoFile, setPhotoFile]               = useState<File | null>(null);
  const [photoLabel, setPhotoLabel]             = useState("arrival");
  const [photoNotes, setPhotoNotes]             = useState("");
  const [photoPlate, setPhotoPlate]             = useState(selected.vehicles?.[0]?.plate_number ?? "");
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [photoSuccess, setPhotoSuccess]         = useState(false);
  const [photoErr, setPhotoErr]                 = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Payment doc signed URLs
  const [photoUrls, setPhotoUrls]       = useState<Record<string, string>>({});
  const [urlsLoading, setUrlsLoading]   = useState(true);

  // Approve/reject state
  const [confirming, setConfirming]     = useState<"approve" | "reject" | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMsg, setApproveMsg]     = useState<string | null>(null);
  const [approveErr, setApproveErr]     = useState<string | null>(null);

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  // Fetch signed URLs for OR/CR, ID photos, and GCash screenshot
  useEffect(() => {
    async function loadUrls() {
      setUrlsLoading(true);
      const paths: Record<string, string> = {};

      selected.vehicles?.forEach(v => {
        if (v.or_cr_path)    paths[`orcr_${v.plate_number}`]    = v.or_cr_path;
        if (v.id_photo_path) paths[`idphoto_${v.plate_number}`] = v.id_photo_path;
      });
      if (selected.payment_proof_path) paths["gcash"] = selected.payment_proof_path;

      const results = await Promise.all(
        Object.entries(paths).map(async ([key, path]) => {
          const url = await getSignedUrl(path);
          return [key, url] as [string, string | null];
        })
      );
      const map: Record<string, string> = {};
      results.forEach(([key, url]) => { if (url) map[key] = url; });
      setPhotoUrls(map);
      setUrlsLoading(false);
    }
    loadUrls();
  }, [selected]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]; if (!raw) return;
    setPhotoCompressing(true);
    try { setPhotoFile(await compressToWebP(raw)); } catch { setPhotoFile(raw); }
    finally { setPhotoCompressing(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  async function handlePhotoUpload() {
    if (!photoFile || !photoPlate) return;
    setPhotoUploading(true); setPhotoSuccess(false); setPhotoErr(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("reservation_id", selected.id);
      fd.append("vehicle_plate", photoPlate);
      fd.append("label", photoLabel);
      if (photoNotes.trim()) fd.append("notes", photoNotes.trim());
      const res = await fetch("/api/parking/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setPhotoErr(data.error ?? "Photo upload failed."); return; }
      setPhotoFile(null); setPhotoNotes(""); setPhotoSuccess(true);
    } catch { setPhotoErr("Network error."); }
    finally { setPhotoUploading(false); }
  }

  async function handleApproveAction(action: "approve" | "reject") {
    setApproveLoading(true); setApproveErr(null); setApproveMsg(null);
    try {
      const res = await fetch("/api/parking/owner/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: selected.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { setApproveErr(data.error ?? "Action failed."); return; }
      setApproveMsg(action === "approve" ? "✅ Booking approved & payment confirmed!" : "✅ Booking rejected.");
      setConfirming(null);
      onRefresh();
      setTimeout(() => onClose(), 1500);
    } catch { setApproveErr("Network error."); }
    finally { setApproveLoading(false); }
  }

  const isPending  = selected.status === "pending_payment";
  const hasProof   = !!selected.payment_proof_path;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 shrink-0 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-bold uppercase">Booking Detail</p>
            <h2 className="text-lg font-black text-white font-mono">{selected.reference}</h2>
            <p className="text-sm text-white/70">{selected.customer_full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[selected.status] ?? "bg-gray-100 text-gray-600"}`}>
              {selected.status.replace("_", " ")}
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm rounded-xl bg-teal-50 border border-teal-200 p-4">
            <div><p className="text-xs text-gray-400 mb-0.5">Check-in date</p><p className="font-semibold text-[#134e4a]">{selected.park_date_start}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Check-out date</p><p className="font-semibold text-[#134e4a]">{selected.park_date_end}</p></div>
            {selected.checked_in_at && (
              <div className="col-span-2 border-t border-teal-100 pt-2">
                <p className="text-xs text-blue-600">✅ Checked in at {new Date(selected.checked_in_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            )}
          </div>

          {/* Vehicles + docs */}
          <div className="rounded-xl border-2 border-teal-100 overflow-hidden">
            <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">
              {selected.vehicles?.length ?? 0} Vehicle{(selected.vehicles?.length ?? 0) > 1 ? "s" : ""}
            </div>
            {selected.vehicles?.map((v, i) => (
              <div key={i} className="px-4 py-3 border-b border-teal-50 last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"}</span>
                  <span className="font-mono font-bold text-[#134e4a]">{v.plate_number}</span>
                  {v.make_model && <span className="text-xs text-gray-400">{v.make_model}{v.color ? ` · ${v.color}` : ""}</span>}
                </div>
                {/* OR/CR and ID doc links */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {urlsLoading ? (
                    <span className="text-xs text-gray-400 animate-pulse">Loading documents…</span>
                  ) : (
                    <>
                      {photoUrls[`orcr_${v.plate_number}`] ? (
                        <a href={photoUrls[`orcr_${v.plate_number}`]} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors">
                          📄 View OR/CR Photo ↗
                        </a>
                      ) : (
                        <span className="text-xs text-red-500">⚠ No OR/CR photo</span>
                      )}
                      {photoUrls[`idphoto_${v.plate_number}`] ? (
                        <a href={photoUrls[`idphoto_${v.plate_number}`]} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
                          🪪 View ID Photo ↗
                        </a>
                      ) : (
                        <span className="text-xs text-red-500">⚠ No ID photo</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* GCash Payment */}
          <div className="rounded-xl border-2 border-teal-200 overflow-hidden">
            <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">Payment</div>
            <div className="px-4 py-3">
              {hasProof ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                    📱 GCash screenshot submitted
                    {selected.gcash_transaction_reference && (
                      <span className="ml-2 font-mono font-bold">Ref: {selected.gcash_transaction_reference}</span>
                    )}
                  </div>
                  {urlsLoading ? (
                    <span className="text-xs text-gray-400 animate-pulse">Loading screenshot…</span>
                  ) : photoUrls["gcash"] ? (
                    <a href={photoUrls["gcash"]} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
                      📸 View GCash Screenshot ↗
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  ⚠ No GCash screenshot uploaded yet
                </div>
              )}
            </div>
          </div>

          {/* Approve / Reject for pending_payment */}
          {isPending && (
            <div className="space-y-3">
              {approveMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {approveMsg}
                </div>
              )}
              {approveErr && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {approveErr}
                </div>
              )}
              {confirming === "approve" && (
                <div className="rounded-xl bg-emerald-50 border-2 border-emerald-200 p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-3">Confirm approval? This will lock the slot and mark payment as confirmed.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(null)} disabled={approveLoading}
                      className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={() => handleApproveAction("approve")} disabled={approveLoading}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {approveLoading ? "Approving…" : "Yes, Approve"}
                    </button>
                  </div>
                </div>
              )}
              {confirming === "reject" && (
                <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4">
                  <p className="text-sm font-semibold text-red-800 mb-1">Confirm rejection?</p>
                  <p className="text-xs text-red-700 mb-3">Booking will be cancelled.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(null)} disabled={approveLoading}
                      className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={() => handleApproveAction("reject")} disabled={approveLoading}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {approveLoading ? "Rejecting…" : "Yes, Reject"}
                    </button>
                  </div>
                </div>
              )}
              {!confirming && (
                <div className="flex gap-3">
                  <button onClick={() => setConfirming("reject")} disabled={approveLoading}
                    className="flex-1 rounded-xl border-2 border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    ✕ Reject Booking
                  </button>
                  <button onClick={() => setConfirming("approve")} disabled={approveLoading || !hasProof}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    ✓ Approve & Confirm
                  </button>
                </div>
              )}
              {!hasProof && (
                <p className="text-xs text-amber-700 text-center">⚠ Cannot approve — no GCash screenshot uploaded yet</p>
              )}
            </div>
          )}

          {/* Check in / out actions */}
          {actionMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${actionMsg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {actionMsg}
            </div>
          )}
          {selected.status === "confirmed" && !selected.checked_in_at && (
            <button onClick={() => onCheckIn(selected.id)} disabled={actionLoading}
              className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
              {actionLoading ? "Processing…" : "🚘 Check In Vehicle"}
            </button>
          )}
          {selected.status === "checked_in" && (
            <button onClick={() => onCheckOut(selected.id)} disabled={actionLoading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {actionLoading ? "Processing…" : "🏁 Check Out Vehicle"}
            </button>
          )}
          {selected.status === "overstay" && (
            <div className="space-y-2">
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-800 font-semibold">
                ⚠️ Overstay — collect additional payment before checkout
              </div>
              <button onClick={() => onCheckOut(selected.id)} disabled={actionLoading}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {actionLoading ? "Processing…" : "🏁 Check Out (Overstay)"}
              </button>
            </div>
          )}

          {/* Upload condition photo */}
          <div className="rounded-xl border-2 border-teal-100 p-4 space-y-3">
            <h3 className="text-sm font-black text-[#134e4a]">📸 Upload Condition Photo</h3>
            {photoSuccess && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-semibold">✅ Photo uploaded!</div>}
            {photoErr    && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{photoErr}</div>}
            <div>
              <label className={labelCls}>Vehicle Plate</label>
              <select value={photoPlate} onChange={e => setPhotoPlate(e.target.value)} className={inputCls}>
                {selected.vehicles?.map((v, i) => <option key={i} value={v.plate_number}>{VEHICLE_EMOJI[v.vehicle_type]} {v.plate_number}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Photo Label</label>
              <select value={photoLabel} onChange={e => setPhotoLabel(e.target.value)} className={inputCls}>
                {PHOTO_LABELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes (optional)</label>
              <input type="text" value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} placeholder="e.g. Minor scratch on bumper" className={inputCls} />
            </div>
            <div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} capture="environment" />
              <button type="button" onClick={() => photoRef.current?.click()} disabled={photoCompressing}
                className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm font-semibold flex items-center gap-2 ${photoCompressing ? "border-teal-200 bg-teal-50 text-teal-500 cursor-wait" : photoFile ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-dashed border-teal-200 bg-white text-[#0f766e] hover:border-[#0c7b93]"}`}>
                {photoCompressing ? <><span className="animate-spin">⏳</span><span className="text-xs">Compressing…</span></> : photoFile ? <><span className="text-emerald-500 shrink-0">✓</span><span className="truncate text-xs flex-1">{photoFile.name}</span><span className="text-xs text-emerald-600 shrink-0">Change</span></> : <><span>📸</span><span className="text-xs">Take or upload photo</span></>}
              </button>
            </div>
            <button onClick={handlePhotoUpload} disabled={!photoFile || photoUploading || !photoPlate}
              className="w-full rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
              {photoUploading ? "Uploading…" : "Upload Photo"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Manage Lot Tab ────────────────────────────────────────────────────────────
function ManageLotTab({ lot, onSaved }: { lot: NonNullable<Lot>; onSaved: () => void }) {
  const [slots, setSlots] = useState({
    total_slots_car:        lot.total_slots_car,
    total_slots_motorcycle: lot.total_slots_motorcycle,
    total_slots_van:        lot.total_slots_van,
  });
  const [accepts, setAccepts] = useState({
    accepts_car:        lot.accepts_car,
    accepts_motorcycle: lot.accepts_motorcycle,
    accepts_van:        lot.accepts_van,
  });
  const [rates, setRates] = useState({
    car_rate_cents:        lot.car_rate_cents ?? 0,
    motorcycle_rate_cents: lot.motorcycle_rate_cents ?? 0,
    van_rate_cents:        lot.van_rate_cents ?? 0,
  });
  const [is24hrs, setIs24hrs]   = useState(lot.is_24hrs);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);
  const [isError, setIsError]   = useState(false);

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/parking/owner/lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lot.id,
          ...slots,
          ...accepts,
          car_rate_cents:        accepts.accepts_car        ? rates.car_rate_cents        : null,
          motorcycle_rate_cents: accepts.accepts_motorcycle ? rates.motorcycle_rate_cents : null,
          van_rate_cents:        accepts.accepts_van        ? rates.van_rate_cents        : null,
          is_24hrs: is24hrs,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Save failed."); setIsError(true); return; }
      setMsg("✅ Lot settings saved successfully!");
      setIsError(false);
      onSaved();
    } catch { setMsg("Network error."); setIsError(true); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">

      {/* Info banner */}
      <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs text-teal-700">
        ℹ️ Changes to slot counts and rates take effect immediately for new bookings. Active bookings are not affected.
      </div>

      {/* Operating hours */}
      <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 space-y-3">
        <h3 className="text-sm font-black text-[#134e4a]">⏰ Operating Hours</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`relative w-11 h-6 rounded-full transition-colors ${is24hrs ? "bg-[#0c7b93]" : "bg-gray-200"}`}
            onClick={() => setIs24hrs(v => !v)}>
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${is24hrs ? "translate-x-5" : ""}`} />
          </div>
          <span className="text-sm font-semibold text-[#134e4a]">Open 24 hours</span>
        </label>
      </div>

      {/* Vehicle slots & rates */}
      {[
        { type: "car",        emoji: "🚗", label: "Cars",        acceptKey: "accepts_car"        as const, slotKey: "total_slots_car"        as const, rateKey: "car_rate_cents"        as const },
        { type: "motorcycle", emoji: "🏍️", label: "Motorcycles", acceptKey: "accepts_motorcycle" as const, slotKey: "total_slots_motorcycle" as const, rateKey: "motorcycle_rate_cents" as const },
        { type: "van",        emoji: "🚐", label: "Vans",        acceptKey: "accepts_van"        as const, slotKey: "total_slots_van"        as const, rateKey: "van_rate_cents"        as const },
      ].map(v => (
        <div key={v.type} className={`rounded-2xl border-2 bg-white p-5 space-y-4 transition-opacity ${accepts[v.acceptKey] ? "border-teal-100 opacity-100" : "border-gray-100 opacity-60"}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#134e4a]">{v.emoji} {v.label}</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${accepts[v.acceptKey] ? "bg-[#0c7b93]" : "bg-gray-200"}`}
                onClick={() => setAccepts(a => ({ ...a, [v.acceptKey]: !a[v.acceptKey] }))}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${accepts[v.acceptKey] ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-xs font-semibold text-gray-500">{accepts[v.acceptKey] ? "Accepting" : "Not accepting"}</span>
            </label>
          </div>

          {accepts[v.acceptKey] && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Total Slots</label>
                <input type="number" min={0} max={500}
                  value={slots[v.slotKey]}
                  onChange={e => setSlots(s => ({ ...s, [v.slotKey]: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Rate per day (₱)</label>
                <input type="number" min={0}
                  value={(rates[v.rateKey] / 100).toFixed(0)}
                  onChange={e => setRates(r => ({ ...r, [v.rateKey]: Math.round(parseFloat(e.target.value) * 100) || 0 }))}
                  className={inputCls} />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Save message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-800"}`}>
          {msg}
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
        {saving ? "Saving…" : "💾 Save Lot Settings"}
      </button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ParkingOwnerDashboard({ ownerId, ownerName, ownerEmail, avatarUrl, lot, crew, availability }: Props) {
  const [period, setPeriod]                       = useState<"today"|"week"|"month">("today");
  const [bookings, setBookings]                   = useState<Booking[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState<PendingExtension[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [showScanner, setShowScanner]             = useState(false);
  const [scanMsg, setScanMsg]                     = useState<string | null>(null);
  const [tab, setTab]                             = useState<"bookings"|"crew"|"revenue"|"lot">("bookings");
  const [extLoading, setExtLoading]               = useState<string | null>(null);
  const [selected, setSelected]                   = useState<Booking | null>(null);
  const [actionLoading, setActionLoading]         = useState(false);
  const [actionMsg, setActionMsg]                 = useState<string | null>(null);

  const totalCar   = lot?.total_slots_car        ?? 0;
  const totalMoto  = lot?.total_slots_motorcycle ?? 0;
  const totalVan   = lot?.total_slots_van        ?? 0;
  const availCar   = totalCar  - (availability.booked_car        ?? 0);
  const availMoto  = totalMoto - (availability.booked_motorcycle ?? 0);
  const availVan   = totalVan  - (availability.booked_van        ?? 0);
  const totalSlots = totalCar + totalMoto + totalVan;
  const occupied   = (availability.booked_car ?? 0) + (availability.booked_motorcycle ?? 0) + (availability.booked_van ?? 0);
  const pctFull    = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;

  const fetchBookings = useCallback(async () => {
    if (!lot) return;
    setLoading(true);
    try {
      const { start, end } = getRange(period);
      const res = await fetch(`/api/parking/owner/bookings?lot_id=${lot.id}&start=${start}&end=${end}`);
      if (res.ok) {
        const d = await res.json();
        setBookings(d.bookings ?? []);
        setPendingExtensions(d.pendingExtensions ?? []);
      }
    } finally { setLoading(false); }
  }, [lot, period]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleCheckIn(bookingId: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/parking/crew/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId, action: "check_in" }) });
      const data = await res.json();
      if (!res.ok) { setActionMsg(data.error ?? "Check-in failed."); return; }
      setActionMsg("✅ Vehicle checked in successfully.");
      await fetchBookings();
      setSelected(prev => prev ? { ...prev, status: "checked_in", checked_in_at: new Date().toISOString() } : null);
    } catch { setActionMsg("Network error."); }
    finally { setActionLoading(false); }
  }

  async function handleCheckOut(bookingId: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/parking/crew/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId, action: "check_out" }) });
      const data = await res.json();
      if (!res.ok) { setActionMsg(data.error ?? "Check-out failed."); return; }
      setActionMsg("✅ Vehicle checked out.");
      await fetchBookings(); setSelected(null);
    } catch { setActionMsg("Network error."); }
    finally { setActionLoading(false); }
  }

  async function handleExtensionAction(extensionId: string, action: "approve" | "reject") {
    setExtLoading(extensionId);
    try {
      const res = await fetch("/api/parking/owner/extensions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extension_id: extensionId, action }) });
      if (res.ok) { setPendingExtensions(prev => prev.filter(e => e.id !== extensionId)); await fetchBookings(); }
    } finally { setExtLoading(null); }
  }

  async function handleQRScan(ref: string) {
    setShowScanner(false);
    setScanMsg(`🔍 Looking up ${ref}…`);
    try {
      const res = await fetch(`/api/parking/lookup?q=${encodeURIComponent(ref)}`);
      const d = await res.json();
      if (d?.id) { setSelected(d); setActionMsg(null); setScanMsg(null); }
      else { setScanMsg(`❌ No booking found for: ${ref}`); setTimeout(() => setScanMsg(null), 5000); }
    } catch { setScanMsg("❌ Network error."); setTimeout(() => setScanMsg(null), 5000); }
  }

  const totalRevenue    = bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).reduce((s, b) => s + (b.parking_fee_cents ?? 0), 0);
  const totalCommission = bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).reduce((s, b) => s + (b.commission_cents ?? 0), 0);
  const netRevenue      = totalRevenue - totalCommission;
  const checkedIn       = bookings.filter(b => b.status === "checked_in").length;
  const pending         = bookings.filter(b => b.status === "pending_payment").length;

  const tabCls = (t: string) => `rounded-xl px-4 py-2 text-xs font-bold border transition-all ${tab === t ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={ownerName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-black text-white border-2 border-white/20">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Parking Owner</p>
              <h1 className="mt-0.5 text-2xl font-black text-white leading-tight">{ownerName}</h1>
              <p className="text-sm text-white/60 mt-0.5">{ownerEmail}</p>
              {lot && <p className="mt-1 text-sm font-semibold text-white/80">🅿️ {lot.name}</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setShowScanner(true)} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors">📷 Scan QR</button>
            <Link href="/account" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">👤 My Account</Link>
            <Link href="/dashboard/parking-crew" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">🚘 Check-in View</Link>
          </div>
          {scanMsg && <div className="mt-3 rounded-xl bg-white/15 px-4 py-2.5 text-sm text-white font-semibold">{scanMsg}</div>}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">

        {!lot ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="font-black text-amber-900 text-lg">No lot assigned yet</h2>
            <p className="text-sm text-amber-700 mt-2">Ask your admin to assign a parking lot to your account.</p>
          </div>
        ) : (
          <>
            {/* Pending extensions */}
            {pendingExtensions.length > 0 && (
              <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 overflow-hidden">
                <div className="px-5 py-3 bg-purple-100 border-b border-purple-200">
                  <h2 className="text-sm font-black text-purple-900">📅 Pending Extend Stay Payments ({pendingExtensions.length})</h2>
                  <p className="text-xs text-purple-700 mt-0.5">Verify GCash payment then approve or reject.</p>
                </div>
                <div className="divide-y divide-purple-100">
                  {pendingExtensions.map((ext) => (
                    <div key={ext.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-mono text-xs font-black text-purple-700">{ext.reference}</p>
                          <p className="text-xs text-purple-600">for booking {ext.reservation_reference}</p>
                          <p className="text-sm font-semibold text-[#134e4a] mt-0.5">{ext.customer_full_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">+{ext.additional_days} day{ext.additional_days > 1 ? "s" : ""} · New end: {fmt(ext.new_end_date)} · {peso(ext.total_amount_cents)}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleExtensionAction(ext.id, "reject")} disabled={extLoading === ext.id}
                            className="rounded-xl border-2 border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                            {extLoading === ext.id ? "…" : "Reject"}
                          </button>
                          <button onClick={() => handleExtensionAction(ext.id, "approve")} disabled={extLoading === ext.id}
                            className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                            {extLoading === ext.id ? "…" : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live capacity */}
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-[#134e4a]">Live Capacity — {lot.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${pctFull >= 90 ? "bg-red-100 text-red-700" : pctFull >= 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {occupied}/{totalSlots} occupied
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[{e:"🚗",l:"Cars",a:availCar,t:totalCar},{e:"🏍️",l:"Motos",a:availMoto,t:totalMoto},{e:"🚐",l:"Vans",a:availVan,t:totalVan}].map(s => (
                  <div key={s.l} className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                    <div className="text-xl mb-1">{s.e}</div>
                    <p className={`font-black text-lg ${s.a === 0 ? "text-red-600" : "text-[#0c7b93]"}`}>{s.a}/{s.t}</p>
                    <p className="text-xs text-gray-400">{s.l} free</p>
                  </div>
                ))}
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-2.5 rounded-full transition-all ${pctFull >= 80 ? "bg-red-400" : pctFull >= 50 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pctFull}%` }} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Checked In", val: checkedIn,       color: "text-blue-600",    bg: "bg-blue-50 border-blue-200"       },
                { label: "Pending",    val: pending,          color: "text-amber-600",   bg: "bg-amber-50 border-amber-200"     },
                { label: "Net Revenue",val: peso(netRevenue), color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border-2 ${s.bg} p-4 text-center`}>
                  <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setTab("bookings")} className={tabCls("bookings")}>📋 Bookings</button>
              <button onClick={() => setTab("crew")}     className={tabCls("crew")}>👷 Crew ({crew.length})</button>
              <button onClick={() => setTab("revenue")}  className={tabCls("revenue")}>💰 Revenue</button>
              <button onClick={() => setTab("lot")}      className={tabCls("lot")}>🅿️ Manage Lot</button>
            </div>

            {/* Bookings tab */}
            {tab === "bookings" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(["today","week","month"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${period === p ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <div className="text-center py-10"><div className="text-4xl animate-pulse mb-3">🅿️</div><p className="text-sm text-gray-400">Loading…</p></div>
                ) : bookings.length === 0 ? (
                  <div className="rounded-2xl border-2 border-teal-100 bg-white p-8 text-center"><p className="text-sm text-gray-400">No bookings for this period</p></div>
                ) : (
                  bookings.map(b => (
                    <button key={b.id} onClick={() => { setSelected(b); setActionMsg(null); }}
                      className="w-full text-left rounded-2xl border-2 border-teal-100 bg-white p-4 hover:border-[#0c7b93] hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="font-mono font-black text-[#0c7b93] text-sm">{b.reference}</span>
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>{b.status.replace("_"," ")}</span>
                        </div>
                        <span className="text-xs text-[#0c7b93] group-hover:translate-x-1 transition-transform mt-1">→</span>
                      </div>
                      <p className="text-sm font-semibold text-[#134e4a]">{b.customer_full_name}</p>
                      <p className="text-xs text-gray-400">{fmt(b.park_date_start)} → {fmt(b.park_date_end)}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.vehicles?.map((v, i) => (
                          <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}
                          </span>
                        ))}
                      </div>
                      {b.checked_in_at && (
                        <p className="text-xs text-blue-600 mt-1">✅ Checked in {new Date(b.checked_in_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Crew tab */}
            {tab === "crew" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-xs text-teal-700">
                  To add or remove crew, ask your admin to update assignments in the Parking Lots management page.
                </div>
                {crew.length === 0 ? (
                  <div className="rounded-2xl border-2 border-teal-100 bg-white p-8 text-center"><p className="text-sm text-gray-400">No crew assigned yet</p></div>
                ) : (
                  crew.map(c => (
                    <div key={c.crew_id} className="rounded-2xl border-2 border-teal-100 bg-white p-4 flex items-center gap-3">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.full_name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-sm font-black text-[#0c7b93]">{c.full_name.charAt(0).toUpperCase()}</div>
                      )}
                      <div>
                        <p className="font-semibold text-[#134e4a] text-sm">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                      <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">Parking Crew</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Revenue tab */}
            {tab === "revenue" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(["today","week","month"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${period === p ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-black text-[#134e4a]">Revenue Breakdown</h3>
                  <p className="text-xs text-gray-400">Only confirmed/checked-in/completed bookings are counted.</p>
                  {[
                    { label: "Gross parking fees", val: totalRevenue,     note: "Before commission" },
                    { label: "Commission deducted", val: -totalCommission, note: "Platform commission" },
                    { label: "Your net revenue",    val: netRevenue,       note: "What you keep", bold: true },
                  ].map(r => (
                    <div key={r.label} className={`flex justify-between items-center py-2.5 border-b border-teal-50 last:border-0 ${r.bold ? "font-black" : ""}`}>
                      <div>
                        <p className={`text-sm ${r.bold ? "text-[#134e4a]" : "text-gray-600"}`}>{r.label}</p>
                        <p className="text-xs text-gray-400">{r.note}</p>
                      </div>
                      <p className={`text-sm font-bold ${r.val < 0 ? "text-red-600" : r.bold ? "text-emerald-600 text-base" : "text-[#134e4a]"}`}>
                        {r.val < 0 ? `-${peso(-r.val)}` : peso(r.val)}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    ℹ️ Platform fee and processing fee go to Travela Siargao directly.
                  </div>
                </div>
                <div className="space-y-2">
                  {bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).map(b => (
                    <div key={b.id} className="rounded-xl border border-teal-100 bg-white px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="font-mono text-xs font-black text-[#0c7b93]">{b.reference}</p>
                        <p className="text-xs text-gray-400">{fmt(b.park_date_start)} · {b.vehicle_count} vehicle{b.vehicle_count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{peso((b.parking_fee_cents ?? 0) - (b.commission_cents ?? 0))}</p>
                        <p className="text-xs text-gray-400">net</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manage Lot tab */}
            {tab === "lot" && (
              <ManageLotTab lot={lot} onSaved={fetchBookings} />
            )}
          </>
        )}
      </div>

      {selected && (


<BookingDetailModal
  selected={selected} onClose={() => setSelected(null)}
  onCheckIn={handleCheckIn} onCheckOut={handleCheckOut}
  actionLoading={actionLoading} actionMsg={actionMsg}
  onRefresh={fetchBookings}
/>
      )}
      {showScanner && (
        <ParkingQRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
