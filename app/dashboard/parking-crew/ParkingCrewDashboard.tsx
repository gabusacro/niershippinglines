"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

type Booking = {
  id: string; reference: string; status: string;
  park_date_start: string; park_date_end: string; total_days: number;
  vehicle_count: number; vehicles: { vehicle_type: string; plate_number: string; make_model: string | null; color: string | null }[];
  customer_full_name: string; lot_snapshot_name: string | null;
  checked_in_at: string | null; checked_out_at: string | null;
};
type LotInfo = { id: string; name: string; total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number };
type AvailInfo = { booked_car: number; booked_motorcycle: number; booked_van: number };

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

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
function getWeekRange() {
  const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - today.getDay());
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}
function getMonthRange() {
  const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
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

// ── QR Scanner ───────────────────────────────────────────────────────────────
function QRScanner({ onScan, onClose }: { onScan: (ref: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let jsQR: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js";
    script.onload = () => {
      // @ts-ignore
      jsQR = window.jsQR;
      setLoaded(true);
      startCamera();
    };
    script.onerror = () => setError("Failed to load scanner library.");
    document.head.appendChild(script);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
      } catch { setError("Camera permission denied. Please allow camera access."); }
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { document.head.removeChild(script); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    function tick() {
      const video = videoRef.current;
      // @ts-ignore
      const jsQR = window.jsQR;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && jsQR && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) {
          // Parking references start with TRV-PRK-
          if (code.data.startsWith("TRV-PRK-") || code.data.length >= 6) {
            streamRef.current?.getTracks().forEach(t => t.stop());
            onScan(code.data.trim());
            return;
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [loaded, onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white font-bold text-sm">🔍 Scan Parking QR</p>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl">×</button>
      </div>

      {/* Camera */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Scan frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-56 h-56">
            {/* Dimmed corners */}
            <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
            {/* Corner markers */}
            {[["top-0 left-0", "border-t-4 border-l-4 rounded-tl-xl"], ["top-0 right-0", "border-t-4 border-r-4 rounded-tr-xl"], ["bottom-0 left-0", "border-b-4 border-l-4 rounded-bl-xl"], ["bottom-0 right-0", "border-b-4 border-r-4 rounded-br-xl"]].map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 border-[#0c7b93] ${cls}`} />
            ))}
            {/* Scan line animation */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="w-full h-0.5 bg-[#0c7b93] opacity-80 animate-bounce" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-8 left-4 right-4 rounded-xl bg-red-500/90 px-4 py-3 text-sm text-white font-semibold text-center">
            {error}
          </div>
        )}
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
      </div>

      <div className="px-4 py-4 bg-black/80 text-center">
        <p className="text-white/70 text-xs">Point camera at the passenger's QR code</p>
        <p className="text-white/50 text-xs mt-1">Or type the reference number manually in the search box</p>
      </div>
    </div>
  );
}

// ── Cash Walk-in Form ─────────────────────────────────────────────────────────
function CashWalkInForm({ lotId, lotName, onClose, onSuccess }: {
  lotId: string; lotName: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [plate, setPlate]     = useState("");
  const [vtype, setVtype]     = useState("car");
  const [days, setDays]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function handleSubmit() {
    if (!plate.trim()) { setMsg("Plate number is required."); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/parking/crew/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: lotId, plate_number: plate.trim().toUpperCase(), vehicle_type: vtype, total_days: days, payment_method: "cash" }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Walk-in failed."); return; }
      setMsg(`✅ Walk-in created! Ref: ${d.reference}`);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch { setMsg("Network error."); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-bold uppercase">Cash Walk-in</p>
            <h2 className="text-lg font-black text-white">{lotName}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Record a cash payment for a walk-in vehicle. This will create a confirmed booking immediately.</p>
          <div>
            <label className={labelCls}>Vehicle Type</label>
            <select value={vtype} onChange={e => setVtype(e.target.value)} className={inputCls}>
              <option value="car">🚗 Car</option>
              <option value="motorcycle">🏍️ Motorcycle</option>
              <option value="van">🚐 Van</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Plate Number *</label>
            <input type="text" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" className={inputCls} style={{ textTransform: "uppercase" }} />
          </div>
          <div>
            <label className={labelCls}>Number of Days</label>
            <input type="number" min={1} max={45} value={days} onChange={e => setDays(parseInt(e.target.value) || 1)} className={inputCls} />
          </div>
          {msg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {msg}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "💵 Create Walk-in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ParkingCrewDashboard() {
  const [period, setPeriod]       = useState<"today" | "week" | "month">("today");
  const [search, setSearch]       = useState("");
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [lot, setLot]             = useState<LotInfo | null>(null);
  const [avail, setAvail]         = useState<AvailInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showScanner, setShowScanner]   = useState(false);
  const [showWalkIn, setShowWalkIn]     = useState(false);
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoLabel, setPhotoLabel]     = useState("arrival");
  const [photoNotes, setPhotoNotes]     = useState("");
  const [photoPlate, setPhotoPlate]     = useState("");
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [photoSuccess, setPhotoSuccess]         = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = getTodayManila();
      let startDate = today, endDate = today;
      if (period === "week")  { const r = getWeekRange();  startDate = r.start; endDate = r.end; }
      if (period === "month") { const r = getMonthRange(); startDate = r.start; endDate = r.end; }
      const params = new URLSearchParams({ start: startDate, end: endDate });
      if (search.trim()) params.set("search", search.trim());
      const [bRes, lRes] = await Promise.all([
        fetch(`/api/parking/crew/bookings?${params}`),
        fetch("/api/parking/crew/lot"),
      ]);
      if (bRes.ok) { const d = await bRes.json(); setBookings(d.bookings ?? []); }
      if (lRes.ok) { const d = await lRes.json(); setLot(d.lot); setAvail(d.availability); }
    } catch {} finally { setLoading(false); }
  }, [period, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCheckIn(bookingId: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/parking/crew/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId, action: "check_in" }) });
      const data = await res.json();
      if (!res.ok) { setActionMsg(data.error ?? "Check-in failed."); return; }
      setActionMsg("✅ Vehicle checked in successfully.");
      await fetchData(); setSelected(null);
    } catch { setActionMsg("Network error."); }
    finally { setActionLoading(false); }
  }

  async function handleCheckOut(bookingId: string) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/parking/crew/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId, action: "check_out" }) });
      const data = await res.json();
      if (!res.ok) { setActionMsg(data.error ?? "Check-out failed."); return; }
      setActionMsg("✅ Vehicle checked out successfully.");
      await fetchData(); setSelected(null);
    } catch { setActionMsg("Network error."); }
    finally { setActionLoading(false); }
  }

  // Handle QR scan — look up booking by reference
  async function handleQRScan(ref: string) {
    setShowScanner(false);
    setSearch(ref);
    setActionMsg(`🔍 Looking up ${ref}…`);
    try {
      const res = await fetch(`/api/admin/parking/checkin-lookup?q=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (data && data.id) {
        setSelected(data);
        setActionMsg(null);
      } else {
        setActionMsg(`No booking found for: ${ref}`);
      }
    } catch { setActionMsg("Network error during QR lookup."); }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]; if (!raw) return;
    setPhotoCompressing(true);
    try { setPhotoFile(await compressToWebP(raw)); } catch { setPhotoFile(raw); }
    finally { setPhotoCompressing(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  async function handlePhotoUpload() {
    if (!photoFile || !selected || !photoPlate) return;
    setPhotoUploading(true); setPhotoSuccess(false);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("reservation_id", selected.id);
      fd.append("vehicle_plate", photoPlate);
      fd.append("label", photoLabel);
      if (photoNotes.trim()) fd.append("notes", photoNotes.trim());
      const res = await fetch("/api/parking/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setActionMsg(data.error ?? "Photo upload failed."); return; }
      setPhotoFile(null); setPhotoNotes(""); setPhotoSuccess(true);
    } catch { setActionMsg("Network error during photo upload."); }
    finally { setPhotoUploading(false); }
  }

  const totalCar  = lot?.total_slots_car        ?? 0;
  const totalMoto = lot?.total_slots_motorcycle ?? 0;
  const totalVan  = lot?.total_slots_van        ?? 0;
  const availCar  = totalCar  - (avail?.booked_car        ?? 0);
  const availMoto = totalMoto - (avail?.booked_motorcycle ?? 0);
  const availVan  = totalVan  - (avail?.booked_van        ?? 0);
  const totalAll  = totalCar + totalMoto + totalVan;
  const availAll  = availCar + availMoto + availVan;
  const pctFull   = totalAll > 0 ? Math.round(((totalAll - availAll) / totalAll) * 100) : 0;

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Parking Crew</p>
          <h1 className="mt-1 text-2xl font-black text-white">🚘 {lot?.name ?? "Parking Crew"}</h1>
          <p className="text-sm text-white/70 mt-0.5">Scan QR · Check in/out · Upload photos</p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href="/dashboard" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">← Dashboard</Link>
            <button onClick={() => setShowScanner(true)} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors">
              📷 Scan QR
            </button>
            {lot && (
              <button onClick={() => setShowWalkIn(true)} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
                💵 Cash Walk-in
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">

        {/* Live capacity */}
        {lot && (
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-[#134e4a]">Live Capacity</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${pctFull >= 90 ? "bg-red-100 text-red-700" : pctFull >= 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {pctFull}% full
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[{ emoji: "🚗", label: "Cars", avail: availCar, total: totalCar }, { emoji: "🏍️", label: "Motorcycles", avail: availMoto, total: totalMoto }, { emoji: "🚐", label: "Vans", avail: availVan, total: totalVan }].map(s => (
                <div key={s.label} className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className={`font-black text-lg ${s.avail === 0 ? "text-red-600" : "text-[#0c7b93]"}`}>{s.avail}/{s.total}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-2.5 rounded-full ${pctFull >= 80 ? "bg-red-400" : pctFull >= 50 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pctFull}%` }} />
            </div>
          </div>
        )}

        {/* Period + search */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["today", "week", "month"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${period === p ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plate or reference…"
            className="flex-1 min-w-[180px] rounded-xl border-2 border-teal-100 bg-white px-3 py-1.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
        </div>

        {actionMsg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${actionMsg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
            {actionMsg}
          </div>
        )}

        {/* Bookings list */}
        {loading ? (
          <div className="text-center py-12"><div className="text-4xl animate-pulse mb-3">🚘</div><p className="text-sm text-[#0f766e]">Loading…</p></div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-10 text-center"><div className="text-4xl mb-3">✅</div><p className="font-bold text-[#134e4a]">No bookings for this period</p></div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => (
              <button key={b.id} onClick={() => { setSelected(b); setActionMsg(null); setPhotoSuccess(false); setPhotoFile(null); setPhotoPlate(b.vehicles?.[0]?.plate_number ?? ""); }}
                className="w-full text-left rounded-2xl border-2 border-teal-100 bg-white p-4 hover:border-[#0c7b93] hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-black text-[#0c7b93]">{b.reference}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>{b.status.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#134e4a]">{b.customer_full_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(b.park_date_start)} → {formatDate(b.park_date_end)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {b.vehicles?.map((v, i) => <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}</span>)}
                    </div>
                  </div>
                  <span className="text-xs text-[#0c7b93] group-hover:translate-x-1 transition-transform mt-1">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Booking detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 shrink-0 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
              <div>
                <p className="text-xs text-white/60 font-bold uppercase">Booking</p>
                <h2 className="text-lg font-black text-white font-mono">{selected.reference}</h2>
                <p className="text-sm text-white/70">{selected.customer_full_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm rounded-xl bg-teal-50 border border-teal-200 p-3">
                <div><p className="text-xs text-gray-400 mb-0.5">Check-in</p><p className="font-semibold text-[#134e4a]">{formatDate(selected.park_date_start)}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Check-out</p><p className="font-semibold text-[#134e4a]">{formatDate(selected.park_date_end)}</p></div>
              </div>
              <div className="space-y-2">
                {selected.vehicles?.map((v, i) => (
                  <div key={i} className="rounded-xl border border-teal-100 bg-white px-3 py-2.5 flex items-center gap-2">
                    <span className="text-lg">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"}</span>
                    <div><p className="font-mono font-bold text-[#134e4a]">{v.plate_number}</p>{v.make_model && <p className="text-xs text-gray-400">{v.make_model}{v.color ? ` · ${v.color}` : ""}</p>}</div>
                  </div>
                ))}
              </div>

              {selected.status === "confirmed" && !selected.checked_in_at && (
                <button onClick={() => handleCheckIn(selected.id)} disabled={actionLoading}
                  className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
                  {actionLoading ? "Processing…" : "🚘 Check In Vehicle"}
                </button>
              )}
              {selected.status === "checked_in" && (
                <button onClick={() => handleCheckOut(selected.id)} disabled={actionLoading}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {actionLoading ? "Processing…" : "🏁 Check Out Vehicle"}
                </button>
              )}
              {selected.status === "overstay" && (
                <>
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-800 font-semibold">⚠️ Overstay — collect payment before checkout</div>
                  <button onClick={() => handleCheckOut(selected.id)} disabled={actionLoading}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {actionLoading ? "Processing…" : "🏁 Check Out (Overstay)"}
                  </button>
                </>
              )}

              {actionMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${actionMsg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {actionMsg}
                </div>
              )}

              {/* Photo upload */}
              <div className="rounded-xl border-2 border-teal-100 p-4 space-y-3">
                <h3 className="text-sm font-black text-[#134e4a]">📸 Upload Condition Photo</h3>
                {photoSuccess && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-semibold">✅ Photo uploaded!</div>}
                <div>
                  <label className={labelCls}>Vehicle Plate</label>
                  <select value={photoPlate} onChange={e => setPhotoPlate(e.target.value)} className={inputCls}>
                    {selected.vehicles?.map((v, i) => <option key={i} value={v.plate_number}>{VEHICLE_EMOJI[v.vehicle_type]} {v.plate_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Label</label>
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
      )}

      {/* QR Scanner */}
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      {/* Cash walk-in form */}
      {showWalkIn && lot && (
        <CashWalkInForm lotId={lot.id} lotName={lot.name} onClose={() => setShowWalkIn(false)} onSuccess={fetchData} />
      )}
    </div>
  );
}
