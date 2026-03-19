"use client";

import { useState, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type ParkingLot = {
  id: string;
  name: string;
  slug: string;
  address: string;
  description: string | null;
  distance_from_port: string | null;
  total_slots_car: number;
  total_slots_motorcycle: number;
  total_slots_van: number;
  car_rate_cents: number | null;
  motorcycle_rate_cents: number | null;
  van_rate_cents: number | null;
  accepts_car: boolean;
  accepts_motorcycle: boolean;
  accepts_van: boolean;
  is_24hrs: boolean;
  available_car: number;
  available_motorcycle: number;
  available_van: number;
};

type Settings = {
  carRate: number;
  motorcycleRate: number;
  vanRate: number | null;
  platformFee: number;
  processingFee: number;
  commission: number;
  maxDays: number;
  requiredDocs: string;
  gcashNumber: string;
  gcashName: string;
};

type Props = { lots: ParkingLot[]; settings: Settings };

type VehicleForm = {
  vehicle_type: string;
  plate_number: string;
  make_model: string;
  color: string;
  or_cr_number: string;
  driver_id_type: string;
  driver_id_number: string;
  or_cr_file: File | null;
  id_photo_file: File | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function getRate(lot: ParkingLot, type: string, settings: Settings): number | null {
  if (type === "car")        return lot.car_rate_cents        ?? settings.carRate;
  if (type === "motorcycle") return lot.motorcycle_rate_cents ?? settings.motorcycleRate;
  if (type === "van")        return lot.van_rate_cents        ?? settings.vanRate;
  return null;
}
function getAvailable(lot: ParkingLot, type: string): number {
  if (type === "car")        return lot.available_car;
  if (type === "motorcycle") return lot.available_motorcycle;
  if (type === "van")        return lot.available_van;
  return 0;
}
function getTotal(lot: ParkingLot, type: string): number {
  if (type === "car")        return lot.total_slots_car;
  if (type === "motorcycle") return lot.total_slots_motorcycle;
  if (type === "van")        return lot.total_slots_van;
  return 0;
}
function getTodayLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
function getAcceptedTypes(lot: ParkingLot) {
  return [
    lot.accepts_car        && { value: "car",        label: "Car",        emoji: "🚗" },
    lot.accepts_motorcycle && { value: "motorcycle", label: "Motorcycle", emoji: "🏍️" },
    lot.accepts_van        && { value: "van",        label: "Van",        emoji: "🚐" },
  ].filter(Boolean) as { value: string; label: string; emoji: string }[];
}

const ID_TYPES = [
  { value: "driver_license", label: "Driver's License" },
  { value: "umid",           label: "UMID" },
  { value: "passport",       label: "Passport" },
  { value: "philsys",        label: "PhilSys / National ID" },
  { value: "prc",            label: "PRC ID" },
  { value: "voter_id",       label: "Voter's ID" },
  { value: "other",          label: "Other Government ID" },
];

// ── Photo compression → WebP ──────────────────────────────────────────────────
// Always compress to WebP. If file > 5MB, reduce quality progressively.
async function compressToWebP(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1400;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) { height = Math.round((height / width) * MAX_DIM); width = MAX_DIM; }
        else                { width  = Math.round((width / height) * MAX_DIM); height = MAX_DIM; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      // Try quality 0.85 first, drop to 0.7 if still >3MB, then 0.55
      const tryQuality = (q: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size > 3 * 1024 * 1024 && q > 0.55) {
            tryQuality(q - 0.15);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp", lastModified: Date.now(),
          }));
        }, "image/webp", q);
      };
      tryQuality(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Slot Bar ──────────────────────────────────────────────────────────────────
function SlotBar({ available, total, emoji }: { available: number; total: number; emoji: string }) {
  if (total === 0) return null;
  const pct = Math.max(0, Math.min(100, (available / total) * 100));
  const color = available === 0 ? "bg-red-400" : available <= total * 0.2 ? "bg-amber-400" : "bg-emerald-400";
  const textColor = available === 0 ? "text-red-700" : available <= total * 0.2 ? "text-amber-700" : "text-emerald-700";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5">{emoji}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-16 text-right ${textColor}`}>
        {available === 0 ? "FULL" : `${available}/${total}`}
      </span>
    </div>
  );
}

// ── File Upload Button ────────────────────────────────────────────────────────
function FileUploadButton({ label, file, onChange, accept = "image/*" }: {
  label: string; file: File | null;
  onChange: (f: File | null) => void; accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (raw.size > 20 * 1024 * 1024) {
      alert("File is too large (max 20 MB). Please choose a smaller image.");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressToWebP(raw);
      onChange(compressed);
    } catch {
      onChange(raw);
    } finally {
      setCompressing(false);
      if (ref.current) ref.current.value = "";
    }
  }

  const sizeLabel = file ? (() => {
    const kb = file.size / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  })() : null;

  return (
    <div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <button type="button" onClick={() => ref.current?.click()} disabled={compressing}
        className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 ${
          compressing ? "border-teal-200 bg-teal-50 text-teal-500 cursor-wait"
          : file       ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-dashed border-teal-200 bg-white text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50"
        }`}>
        {compressing ? (
          <><span className="animate-spin text-sm">⏳</span><span className="text-xs">Compressing to WebP…</span></>
        ) : file ? (
          <><span className="text-emerald-500 shrink-0">✓</span><span className="truncate text-xs flex-1">{file.name}</span><span className="text-xs text-emerald-600 shrink-0">{sizeLabel} · Change</span></>
        ) : (
          <><span>📎</span><span className="text-xs flex-1">{label}</span><span className="ml-auto text-xs text-teal-400 shrink-0">Required</span></>
        )}
      </button>
    </div>
  );
}

// ── Urgency Section ───────────────────────────────────────────────────────────
function UrgencySection({ lots }: { lots: ParkingLot[] }) {
  const totalAvailable = lots.reduce((s, l) => s + l.available_car + l.available_motorcycle + l.available_van, 0);
  const totalCapacity  = lots.reduce((s, l) => s + l.total_slots_car + l.total_slots_motorcycle + l.total_slots_van, 0);
  const pctFull        = totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100) : 0;
  const isScarce = pctFull >= 70;
  const isVeryBusy = pctFull >= 50;
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border-2 border-[#0c7b93]/20"
      style={{ background: "linear-gradient(135deg,#0c7b93 0%,#064e3b 100%)" }}>
      <div className="px-6 py-7 text-white">
        {isScarce && (
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 border border-red-400/40 px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
            <span className="text-xs font-bold text-red-200 uppercase tracking-wide">{pctFull}% of slots already taken today</span>
          </div>
        )}
        {!isScarce && isVeryBusy && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
            <span className="text-xs font-bold text-amber-200 uppercase tracking-wide">Slots filling up — book now to secure yours</span>
          </div>
        )}
        {!isVeryBusy && (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">Slots available now — reserve before they&apos;re gone</span>
          </div>
        )}
        <h2 className="text-2xl font-black text-white leading-tight mb-3">
          Don&apos;t get stuck parking<br /><span style={{ color: "#7dd3fc" }}>far from the port.</span>
        </h2>
        <p className="text-white/80 text-sm leading-relaxed mb-5 max-w-lg">
          Parking near Dapa Port fills up fast. Submit your booking with payment — admin approves and locks your slot. <strong className="text-white">Slot is only confirmed after admin approval.</strong>
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {[
            { icon: "📋", title: "Submit everything", desc: "Vehicle docs, ID photo, and GCash payment — all in one form." },
            { icon: "✅", title: "Admin confirms", desc: "We verify your documents and payment. You get a reference number." },
            { icon: "🚶", title: "Walk to the port", desc: "Our lots are 100–300 meters from the port." },
          ].map(p => (
            <div key={p.title} className="rounded-xl bg-white/10 border border-white/20 p-4">
              <div className="text-2xl mb-2">{p.icon}</div>
              <p className="text-sm font-bold text-white mb-1">{p.title}</p>
              <p className="text-xs text-white/70 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        {totalCapacity > 0 && (
          <div className="rounded-xl bg-black/20 border border-white/10 px-4 py-3">
            <div className="flex justify-between text-xs font-semibold text-white/80 mb-2">
              <span>Overall occupancy right now</span>
              <span>{totalCapacity - totalAvailable} of {totalCapacity} slots confirmed</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-3 rounded-full transition-all ${pctFull >= 80 ? "bg-red-400" : pctFull >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${pctFull}%` }} />
            </div>
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>Empty</span>
              <span className="font-bold" style={{ color: pctFull >= 80 ? "#f87171" : pctFull >= 50 ? "#fbbf24" : "#34d399" }}>{pctFull}% full</span>
              <span>Full</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Booking Modal ─────────────────────────────────────────────────────────────
function BookingModal({ lot, settings, onClose }: {
  lot: ParkingLot; settings: Settings; onClose: () => void;
}) {
  const today = getTodayLocal();
  const acceptedTypes = getAcceptedTypes(lot);
  const defaultType = acceptedTypes[0]?.value ?? "car";

  const [vehicles, setVehicles] = useState<VehicleForm[]>([{
    vehicle_type: defaultType, plate_number: "", make_model: "", color: "",
    or_cr_number: "", driver_id_type: "driver_license", driver_id_number: "",
    or_cr_file: null, id_photo_file: null,
  }]);
  const [dateStart, setDateStart]     = useState(today);
  const [days, setDays]               = useState(1);
  const [gcashFile, setGcashFile]     = useState<File | null>(null);
  const [gcashRef, setGcashRef]       = useState("");
  const [gcashCompressing, setGcashCompressing] = useState(false);
  const gcashInputRef = useRef<HTMLInputElement>(null);

  // step: "vehicles" | "payment" | "confirm" | "submitting" | "success"
  const [step, setStep]       = useState<"vehicles" | "payment" | "confirm" | "submitting" | "success">("vehicles");
  const [error, setError]     = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");

  const vehicleCount = vehicles.length;
  const parkingFee   = vehicles.reduce((sum, v) => {
    const rate = getRate(lot, v.vehicle_type, settings) ?? 0;
    return sum + rate * days;
  }, 0);
  const total = parkingFee + settings.platformFee + settings.processingFee;

  function addVehicle() {
    setVehicles(v => [...v, {
      vehicle_type: defaultType, plate_number: "", make_model: "", color: "",
      or_cr_number: "", driver_id_type: "driver_license", driver_id_number: "",
      or_cr_file: null, id_photo_file: null,
    }]);
  }
  function removeVehicle(i: number) { setVehicles(v => v.filter((_, idx) => idx !== i)); }
  function updateVehicle(i: number, field: string, val: string | File | null) {
    setVehicles(v => v.map((veh, idx) => idx === i ? { ...veh, [field]: val } : veh));
  }

  function validateVehicles(): string | null {
    for (const [i, v] of vehicles.entries()) {
      const n = i + 1;
      if (!v.plate_number.trim())     return `Vehicle ${n}: plate number is required.`;
      if (!v.or_cr_number.trim())     return `Vehicle ${n}: OR/CR number is required.`;
      if (!v.driver_id_number.trim()) return `Vehicle ${n}: ID number is required.`;
      if (!v.or_cr_file)              return `Vehicle ${n}: OR/CR photo is required.`;
      if (!v.id_photo_file)           return `Vehicle ${n}: Driver ID photo is required.`;
      if (getAvailable(lot, v.vehicle_type) <= 0)
        return `No available ${v.vehicle_type} slots for this lot.`;
    }
    return null;
  }

  async function handleGcashFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (raw.size > 20 * 1024 * 1024) {
      alert("File is too large (max 20 MB).");
      return;
    }
    setGcashCompressing(true);
    try {
      const compressed = await compressToWebP(raw);
      setGcashFile(compressed);
    } catch {
      setGcashFile(raw);
    } finally {
      setGcashCompressing(false);
      if (gcashInputRef.current) gcashInputRef.current.value = "";
    }
  }

  function handleNextToPayment() {
    setError(null);
    const err = validateVehicles();
    if (err) { setError(err); return; }
    setStep("payment");
  }

  function handleNextToConfirm() {
    setError(null);
    if (!gcashFile) { setError("Please upload your GCash payment screenshot."); return; }
    setStep("confirm");
  }

  async function handleSubmit() {
    setError(null);
    setStep("submitting");

    try {
      // 1. Upload vehicle docs
      const uploadedPaths: { vehicle_index: number; or_cr_path: string; id_photo_path: string }[] = [];

      for (const [i, v] of vehicles.entries()) {
        if (!v.or_cr_file || !v.id_photo_file) continue;
        setUploadProgress(`Uploading docs for vehicle ${i + 1} of ${vehicles.length}…`);

        const formData = new FormData();
        formData.append("or_cr", v.or_cr_file);
        formData.append("id_photo", v.id_photo_file);
        formData.append("vehicle_index", String(i));
        formData.append("plate_number", v.plate_number.toUpperCase());

        const uploadRes = await fetch("/api/parking/upload-docs", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.error ?? "Photo upload failed. Please try again.");
          setStep("vehicles");
          return;
        }
        uploadedPaths.push({ vehicle_index: i, or_cr_path: uploadData.or_cr_path, id_photo_path: uploadData.id_photo_path });
      }

      // 2. Upload GCash screenshot
      setUploadProgress("Uploading payment screenshot…");
      const gcashForm = new FormData();
      gcashForm.append("gcash_proof", gcashFile!);
      if (gcashRef.trim()) gcashForm.append("gcash_ref", gcashRef.trim());

      const gcashRes = await fetch("/api/parking/upload-gcash", { method: "POST", body: gcashForm });
      const gcashData = await gcashRes.json();
      if (!gcashRes.ok) {
        setError(gcashData.error ?? "GCash screenshot upload failed. Please try again.");
        setStep("payment");
        return;
      }

      // 3. Create booking
      setUploadProgress("Creating your booking…");
      const res = await fetch("/api/parking/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id:          lot.id,
          vehicles:        vehicles.map((v, i) => ({
            vehicle_type:     v.vehicle_type,
            plate_number:     v.plate_number.toUpperCase(),
            make_model:       v.make_model || null,
            color:            v.color || null,
            or_cr_number:     v.or_cr_number,
            driver_id_type:   v.driver_id_type,
            driver_id_number: v.driver_id_number,
            or_cr_path:       uploadedPaths[i]?.or_cr_path ?? null,
            id_photo_path:    uploadedPaths[i]?.id_photo_path ?? null,
          })),
          park_date_start:        dateStart,
          total_days:             days,
          gcash_proof_path:       gcashData.path,
          gcash_transaction_reference: gcashRef.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Booking failed. Please try again.");
        setStep("confirm");
        return;
      }
      setReference(data.reference);
      setStep("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep("confirm");
    }
  }

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget && step !== "submitting") onClose(); }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-100 flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-bold uppercase tracking-wide">
              {step === "vehicles"   ? "Step 1 of 3 — Vehicle Details"
               : step === "payment"  ? "Step 2 of 3 — Payment"
               : step === "confirm"  ? "Step 3 of 3 — Review"
               : step === "submitting" ? "Submitting…"
               : "Booking Submitted"}
            </p>
            <h2 className="text-base font-black text-white">{lot.name}</h2>
            <p className="text-xs text-white/70 mt-0.5">📍 {lot.distance_from_port}</p>
          </div>
          {step !== "submitting" && (
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-lg">×</button>
          )}
        </div>

        {/* ── Success ── */}
        {step === "success" && (
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-black text-[#134e4a]">Booking Submitted!</h3>
            <div className="mt-3 inline-block rounded-xl bg-teal-50 border-2 border-teal-200 px-6 py-3">
              <p className="text-xs text-[#0f766e] mb-1">Your reference number</p>
              <span className="font-mono text-xl font-black text-[#0c7b93]">{reference}</span>
            </div>
            <p className="mt-4 text-sm text-gray-600 max-w-xs mx-auto">
              Admin will review your documents and payment. You&apos;ll receive confirmation once approved — your slot is <strong>not yet locked</strong> until then.
            </p>
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-800">
              <p className="font-semibold mb-2">📋 Bring on arrival:</p>
              <ul className="text-xs space-y-1">
                <li>• Original valid government-issued ID</li>
                <li>• Original OR/CR for each vehicle</li>
                <li>• Reference: <strong>{reference}</strong></li>
              </ul>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Link href="/dashboard/parking" onClick={onClose}
                className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                View My Parking Bookings →
              </Link>
              <button onClick={onClose}
                className="w-full rounded-xl border-2 border-teal-200 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Submitting ── */}
        {step === "submitting" && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="text-4xl animate-pulse mb-4">⏳</div>
            <p className="font-bold text-[#134e4a] mb-2">Please wait…</p>
            <p className="text-sm text-[#0f766e]">{uploadProgress || "Processing your booking…"}</p>
            <p className="text-xs text-gray-400 mt-3">Do not close this window</p>
          </div>
        )}

        {/* ── Confirm step ── */}
        {step === "confirm" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-[#134e4a]">Review Your Booking</h3>

            <div className="rounded-xl border-2 border-teal-100 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">
                {vehicles.length} Vehicle{vehicles.length > 1 ? "s" : ""}
              </div>
              {vehicles.map((v, i) => (
                <div key={i} className="px-4 py-3 border-b border-teal-50 last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{getAcceptedTypes(lot).find(t => t.value === v.vehicle_type)?.emoji}</span>
                    <span className="font-semibold text-[#134e4a]">{v.plate_number}</span>
                    {v.make_model && <span className="text-gray-400 text-xs">{v.make_model}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">OR/CR: {v.or_cr_number}</div>
                  <div className="flex gap-2 mt-1">
                    {v.or_cr_file    && <span className="text-xs text-emerald-600">✓ OR/CR photo</span>}
                    {v.id_photo_file && <span className="text-xs text-emerald-600">✓ ID photo</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm flex justify-between">
              <span className="text-[#0f766e]">Check-in</span>
              <span className="font-semibold text-[#134e4a]">{dateStart} · {days} day{days > 1 ? "s" : ""}</span>
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                <span className="text-emerald-800 font-semibold">GCash screenshot uploaded</span>
              </div>
              {gcashRef && <p className="text-xs text-emerald-700 mt-1">Ref: {gcashRef}</p>}
            </div>

            <div className="rounded-xl border-2 border-teal-200 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase">Payment Breakdown</div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Parking fee ({vehicleCount} vehicle{vehicleCount > 1 ? "s" : ""} × {days} day{days > 1 ? "s" : ""})</span>
                  <span className="font-semibold">{peso(parkingFee)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Platform Service Fee</span><span>{peso(settings.platformFee)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Payment Processing Fee</span><span>{peso(settings.processingFee)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-teal-200">
                  <span className="font-black text-[#134e4a]">Total Paid</span>
                  <span className="font-black text-xl text-[#0c7b93]">{peso(total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              ⚠️ Slot is <strong>not locked</strong> until admin confirms. You will be notified once approved.
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => setStep("payment")}
                className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                ← Back
              </button>
              <button onClick={handleSubmit}
                className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                Submit Booking →
              </button>
            </div>
          </div>
        )}

        {/* ── Payment step ── */}
        {step === "payment" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <h3 className="font-bold text-[#134e4a] mb-1">Step 2 — Pay via GCash</h3>
              <p className="text-xs text-[#0f766e]">Send the exact amount below to our GCash, then upload the screenshot.</p>
            </div>

            {/* Amount to pay */}
            <div className="rounded-xl bg-teal-50 border-2 border-teal-200 overflow-hidden">
              <div className="px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Parking fee ({vehicleCount} vehicle{vehicleCount > 1 ? "s" : ""} × {days} day{days > 1 ? "s" : ""})</span>
                  <span className="font-semibold">{peso(parkingFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Platform Service Fee</span><span>{peso(settings.platformFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Payment Processing Fee</span><span>{peso(settings.processingFee)}</span>
                </div>
              </div>
              <div className="flex justify-between font-black text-base px-4 py-3 border-t-2 border-teal-200 bg-teal-100/40">
                <span className="text-[#134e4a]">Total to Send</span>
                <span className="text-[#0c7b93]">{peso(total)}</span>
              </div>
            </div>

            {/* GCash details */}
            {settings.gcashNumber && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
                <p className="text-xs font-bold text-blue-700 uppercase mb-1">Send to GCash</p>
                <p className="font-mono font-black text-blue-900 text-lg">{settings.gcashNumber}</p>
                {settings.gcashName && <p className="text-xs text-blue-700 mt-0.5">{settings.gcashName}</p>}
              </div>
            )}

            {/* Screenshot upload */}
            <div>
              <p className={labelCls}>GCash Payment Screenshot <span className="text-red-500">*</span></p>
              <input ref={gcashInputRef} type="file" accept="image/*" className="hidden" onChange={handleGcashFileChange} />
              <button type="button" onClick={() => gcashInputRef.current?.click()} disabled={gcashCompressing}
                className={`w-full rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all flex items-center gap-2 ${
                  gcashCompressing ? "border-teal-200 bg-teal-50 text-teal-500 cursor-wait"
                  : gcashFile       ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-dashed border-teal-200 bg-white text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50"
                }`}>
                {gcashCompressing ? (
                  <><span className="animate-spin">⏳</span><span className="text-xs">Compressing…</span></>
                ) : gcashFile ? (
                  <><span className="text-emerald-500 shrink-0">✓</span><span className="truncate text-xs flex-1">{gcashFile.name}</span><span className="text-xs text-emerald-600 shrink-0">Change</span></>
                ) : (
                  <><span>📸</span><span className="text-xs flex-1">Upload GCash screenshot</span><span className="ml-auto text-xs text-teal-400 shrink-0">Required</span></>
                )}
              </button>
            </div>

            {/* GCash ref optional */}
            <div>
              <label className={labelCls}>GCash Reference No. <span className="text-gray-400">(optional)</span></label>
              <input type="text" value={gcashRef} onChange={e => setGcashRef(e.target.value)}
                placeholder="e.g. 9012345678" className={inputCls} />
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => setStep("vehicles")}
                className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                ← Back
              </button>
              <button onClick={handleNextToConfirm}
                className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                Review Booking →
              </button>
            </div>
          </div>
        )}

        {/* ── Vehicle entry step ── */}
        {step === "vehicles" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Duration */}
            <div>
              <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide mb-3">📅 Parking Duration</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={dateStart} min={today}
                    onChange={e => setDateStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Days (max {settings.maxDays})</label>
                  <input type="number" min={1} max={settings.maxDays} value={days}
                    onChange={e => setDays(Math.max(1, Math.min(settings.maxDays, parseInt(e.target.value) || 1)))}
                    className={inputCls} />
                </div>
              </div>
            </div>

            {/* Vehicles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">🚗 Vehicles</p>
                <button onClick={addVehicle} type="button" className="text-xs font-bold text-[#0c7b93] hover:underline">
                  + Add vehicle
                </button>
              </div>
              <div className="space-y-4">
                {vehicles.map((v, i) => (
                  <div key={i} className="rounded-xl border-2 border-teal-100 p-4 relative">
                    {vehicles.length > 1 && (
                      <button onClick={() => removeVehicle(i)} type="button"
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs font-semibold">
                        Remove
                      </button>
                    )}
                    <p className="text-xs font-bold text-[#0c7b93] mb-3">Vehicle {i + 1}</p>

                    {/* Type selector */}
                    <div className="mb-3">
                      <label className={labelCls}>Vehicle Type</label>
                      <div className={`grid gap-2 grid-cols-${acceptedTypes.length}`}>
                        {acceptedTypes.map(t => {
                          const avail = getAvailable(lot, t.value);
                          const rate  = getRate(lot, t.value, settings);
                          return (
                            <button key={t.value} type="button"
                              onClick={() => updateVehicle(i, "vehicle_type", t.value)}
                              disabled={avail <= 0}
                              className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                                v.vehicle_type === t.value ? "border-[#0c7b93] bg-teal-50"
                                : avail <= 0 ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                : "border-teal-100 hover:border-teal-300"
                              }`}>
                              <div className="text-lg">{t.emoji}</div>
                              <div className="text-xs font-semibold text-[#134e4a]">{t.label}</div>
                              <div className="text-xs text-[#0f766e]">{rate ? peso(rate) + "/day" : "—"}</div>
                              <div className={`text-xs font-bold mt-0.5 ${avail === 0 ? "text-red-500" : avail <= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                                {avail === 0 ? "Full" : `${avail} left`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Vehicle details */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="col-span-2">
                        <label className={labelCls}>Plate Number *</label>
                        <input type="text" value={v.plate_number}
                          onChange={e => updateVehicle(i, "plate_number", e.target.value.toUpperCase())}
                          placeholder="ABC 1234" className={inputCls} style={{ textTransform: "uppercase" }} />
                      </div>
                      <div>
                        <label className={labelCls}>Make &amp; Model</label>
                        <input type="text" value={v.make_model}
                          onChange={e => updateVehicle(i, "make_model", e.target.value)}
                          placeholder="Toyota Vios" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Color</label>
                        <input type="text" value={v.color}
                          onChange={e => updateVehicle(i, "color", e.target.value)}
                          placeholder="White" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>OR/CR Number *</label>
                        <input type="text" value={v.or_cr_number}
                          onChange={e => updateVehicle(i, "or_cr_number", e.target.value)}
                          placeholder="Registration #" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>ID Type *</label>
                        <select value={v.driver_id_type}
                          onChange={e => updateVehicle(i, "driver_id_type", e.target.value)}
                          className={inputCls}>
                          {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>ID Number *</label>
                        <input type="text" value={v.driver_id_number}
                          onChange={e => updateVehicle(i, "driver_id_number", e.target.value)}
                          placeholder="ID number" className={inputCls} />
                      </div>
                    </div>

                    {/* Photo uploads */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#134e4a]">📎 Document Photos <span className="text-red-500">*</span></p>
                      <p className="text-xs text-gray-400">Photos are automatically compressed to WebP for fast upload.</p>
                      <FileUploadButton
                        label="Upload OR/CR photo (front)"
                        file={v.or_cr_file}
                        onChange={f => updateVehicle(i, "or_cr_file", f)}
                      />
                      <FileUploadButton
                        label={`Upload ${ID_TYPES.find(t => t.value === v.driver_id_type)?.label ?? "ID"} photo`}
                        file={v.id_photo_file}
                        onChange={f => updateVehicle(i, "id_photo_file", f)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live fee preview */}
            <div className="rounded-xl bg-teal-50 border-2 border-teal-200 overflow-hidden">
              <div className="px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#0f766e]">Parking fee ({vehicleCount} vehicle{vehicleCount > 1 ? "s" : ""} × {days} day{days > 1 ? "s" : ""})</span>
                  <span className="font-semibold text-[#134e4a]">{peso(parkingFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Platform Service Fee</span><span>{peso(settings.platformFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Payment Processing Fee</span><span>{peso(settings.processingFee)}</span>
                </div>
              </div>
              <div className="flex justify-between font-black text-base px-4 py-3 border-t-2 border-teal-200 bg-teal-100/40">
                <span className="text-[#134e4a]">Total</span>
                <span className="text-[#0c7b93]">{peso(total)}</span>
              </div>
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button onClick={handleNextToPayment} type="button"
              className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] font-bold text-white text-sm hover:bg-[#085f72] transition-colors shadow-sm">
              Next — Upload Payment →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lot Card ──────────────────────────────────────────────────────────────────
function LotCard({ lot, settings, onBook }: { lot: ParkingLot; settings: Settings; onBook: () => void }) {
  const accepted = getAcceptedTypes(lot);
  const totalAvailable = accepted.reduce((s, t) => s + getAvailable(lot, t.value), 0);
  const totalAll       = accepted.reduce((s, t) => s + getTotal(lot, t.value), 0);
  const isFull = totalAvailable === 0;
  return (
    <div className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md ${isFull ? "border-red-200" : "border-teal-200 hover:border-[#0c7b93]"}`}>
      <div className={`h-1.5 ${isFull ? "bg-red-400" : "bg-gradient-to-r from-[#0c7b93] to-emerald-400"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-black text-[#134e4a] text-base leading-tight">{lot.name}</h3>
            <p className="text-xs text-[#0f766e] mt-0.5">📍 {lot.distance_from_port ?? lot.address}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            isFull ? "bg-red-100 text-red-700"
            : totalAvailable <= totalAll * 0.2 ? "bg-amber-100 text-amber-700"
            : "bg-emerald-100 text-emerald-700"
          }`}>
            {isFull ? "FULL" : `${totalAvailable} avail.`}
          </span>
        </div>
        <div className="space-y-2 mb-4">
          {lot.accepts_car        && lot.total_slots_car        > 0 && <SlotBar available={lot.available_car}        total={lot.total_slots_car}        emoji="🚗" />}
          {lot.accepts_motorcycle && lot.total_slots_motorcycle > 0 && <SlotBar available={lot.available_motorcycle} total={lot.total_slots_motorcycle} emoji="🏍️" />}
          {lot.accepts_van        && lot.total_slots_van        > 0 && <SlotBar available={lot.available_van}        total={lot.total_slots_van}        emoji="🚐" />}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {lot.accepts_car        && <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-[#0c7b93]">🚗 {peso(lot.car_rate_cents ?? settings.carRate)}/day</span>}
          {lot.accepts_motorcycle && <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-[#0c7b93]">🏍️ {peso(lot.motorcycle_rate_cents ?? settings.motorcycleRate)}/day</span>}
          {lot.accepts_van && lot.van_rate_cents && <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-[#0c7b93]">🚐 {peso(lot.van_rate_cents)}/day</span>}
        </div>
        <button onClick={onBook} disabled={isFull}
          className={`w-full min-h-[44px] rounded-xl font-bold text-sm transition-colors ${
            isFull ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#0c7b93] text-white hover:bg-[#085f72] shadow-sm"
          }`}>
          {isFull ? "No slots available" : "Book a Slot →"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ParkingLotsClient({ lots, settings }: Props) {
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 55%,#0891b2 100%)" }}>
        <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ opacity: 0.12 }}>
          <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,20 1440,40 L1440,80 L0,80 Z" fill="white"/>
        </svg>
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <div className="text-5xl">🚗</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Travela Siargao</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white mt-1">Pay Parking</h1>
              <p className="text-white/80 text-sm mt-2 max-w-md">Safe, monitored parking near Dapa Port. Submit docs + GCash payment, admin confirms your slot.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">₱250/day</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">Up to {settings.maxDays} days</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">24/7 monitored</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        {lots.length > 0 && <UrgencySection lots={lots} />}

        <div>
          <h2 className="text-xl font-black text-[#134e4a] mb-1">Available Parking Lots</h2>
          <p className="text-sm text-[#0f766e] mb-5">Confirmed slot counts only — pending bookings don&apos;t hold a slot.</p>
          {lots.length === 0 ? (
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-10 text-center">
              <div className="text-4xl mb-3">🚗</div>
              <p className="font-bold text-[#134e4a]">Parking lots coming soon</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {lots.map(lot => (
                <LotCard key={lot.id} lot={lot} settings={settings} onBook={() => setSelectedLot(lot)} />
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div>
          <h2 className="text-xl font-black text-[#134e4a] mb-5">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { emoji: "📋", title: "Fill the Form", desc: "Pick lot, vehicle type, and dates. Upload your OR/CR and ID photo." },
              { emoji: "💸", title: "Pay via GCash", desc: "Send exact amount and upload your GCash screenshot — all in one form." },
              { emoji: "✅", title: "Admin Approves", desc: "We verify your documents and payment. Slot locked only after approval." },
              { emoji: "🔑", title: "Arrive & Park", desc: "Show your reference number and original docs to the crew on arrival." },
            ].map((s, idx) => (
              <div key={idx} className="rounded-2xl bg-white border-2 border-teal-100 p-5 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-5xl font-black opacity-[0.04] text-[#0c7b93]">{idx + 1}</div>
                <div className="text-3xl mb-3">{s.emoji}</div>
                <h3 className="font-bold text-[#134e4a] text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-[#0f766e] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-bold text-amber-900 mb-3">📋 Required Documents</h2>
          <p className="text-sm text-amber-800 mb-4">{settings.requiredDocs}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: "🪪", label: "Valid Government-Issued ID", sub: "UMID, Driver's License, Passport, PhilSys, etc." },
              { icon: "📄", label: "OR/CR", sub: "Official Receipt & Certificate of Registration." },
            ].map(r => (
              <div key={r.label} className="flex items-start gap-3 rounded-xl bg-white/70 p-3 border border-amber-200">
                <span className="text-2xl shrink-0">{r.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{r.label}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Policy */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-700 mb-3">⚠️ Parking Policy</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Maximum duration is <strong>{settings.maxDays} days</strong>.</li>
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Slot is only locked after admin confirms your payment and documents.</li>
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Rate is locked at booking time once confirmed.</li>
            <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0">•</span>Overstay requires settlement before vehicle exit.</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pb-4">
          <Link href="/#book" className="rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">🚢 Book Ferry Ticket</Link>
          <Link href="/tours" className="rounded-xl border-2 border-teal-200 bg-white px-6 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">🏝️ Explore Tours</Link>
        </div>
      </div>

      {selectedLot && <BookingModal lot={selectedLot} settings={settings} onClose={() => setSelectedLot(null)} />}
    </div>
  );
}
