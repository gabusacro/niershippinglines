"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Booking = {
  id: string; reference: string; status: string;
  park_date_end: string; total_days: number;
  rate_cents_per_vehicle_per_day: number; vehicle_count: number;
  lot_snapshot_name: string | null;
};

function peso(cents: number) { return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`; }
function formatDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0];
}
async function compressToWebP(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400; let { width, height } = img;
      if (width > MAX || height > MAX) { if (width > height) { height = Math.round((height / width) * MAX); width = MAX; } else { width = Math.round((width / height) * MAX); height = MAX; } }
      const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const tryQ = (q: number) => { c.toBlob((blob) => { if (!blob) { resolve(file); return; } if (blob.size > 3 * 1024 * 1024 && q > 0.55) { tryQ(q - 0.15); return; } resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: Date.now() })); }, "image/webp", q); };
      tryQ(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; img.src = url;
  });
}

export default function ExtendStayPage() {
  const { id } = useParams<{ id: string }>();

  const [booking, setBooking]     = useState<Booking | null>(null);
  const [platformFee, setPlatformFee] = useState(3500);
  const [maxDays, setMaxDays]     = useState(45);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [additionalDays, setAdditionalDays] = useState(1);
  const [gcashFile, setGcashFile]           = useState<File | null>(null);
  const [gcashRef, setGcashRef]             = useState("");
  const [compressing, setCompressing]       = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [successRef, setSuccessRef]         = useState<string | null>(null);
  const [newEndDate, setNewEndDate]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, sRes] = await Promise.all([
          fetch(`/api/parking/booking/${id}`),
          fetch("/api/parking/settings"),
        ]);
        if (!bRes.ok) { setFetchError("Booking not found."); return; }
        const b = await bRes.json();
        if (!["confirmed", "checked_in"].includes(b.status)) { setFetchError("Only confirmed or checked-in bookings can be extended."); return; }
        setBooking(b);
        if (sRes.ok) { const s = await sRes.json(); setPlatformFee(s.platform_fee_cents ?? 3500); setMaxDays(s.max_parking_days ?? 45); }
      } catch { setFetchError("Network error."); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]; if (!raw) return;
    setCompressing(true);
    try { setGcashFile(await compressToWebP(raw)); } catch { setGcashFile(raw); }
    finally { setCompressing(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleSubmit() {
    if (!gcashFile || !booking) return;
    setError(null); setSubmitting(true);
    try {
      const gf = new FormData(); gf.append("gcash_proof", gcashFile); if (gcashRef.trim()) gf.append("gcash_ref", gcashRef.trim());
      const gr = await fetch("/api/parking/upload-gcash", { method: "POST", body: gf });
      const gd = await gr.json();
      if (!gr.ok) { setError(gd.error ?? "Screenshot upload failed."); return; }

      const res = await fetch("/api/parking/extend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: booking.id, additional_days: additionalDays, gcash_proof_path: gd.path, gcash_transaction_reference: gcashRef.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Extension failed."); return; }
      setSuccessRef(data.reference);
      setNewEndDate(data.new_end_date);
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  const maxAdditional = booking ? maxDays - booking.total_days : 0;
  const parkingFee    = booking ? booking.rate_cents_per_vehicle_per_day * booking.vehicle_count * additionalDays : 0;
  const total         = parkingFee + platformFee;
  const previewEnd    = booking ? addDaysToDate(booking.park_date_end, additionalDays) : "";

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20";
  const labelCls = "text-xs font-semibold text-[#134e4a] block mb-1";

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f6f0" }}><div className="text-center"><div className="text-4xl animate-pulse mb-3">📅</div><p className="text-sm text-[#0f766e]">Loading…</p></div></div>;

  if (fetchError || !booking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f6f0" }}>
      <div className="text-center"><div className="text-4xl mb-3">❌</div><p className="font-bold text-[#134e4a]">{fetchError ?? "Not found"}</p><Link href="/dashboard/parking" className="mt-4 inline-block text-sm text-[#0c7b93] hover:underline">← Back to my bookings</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Extend Stay</p>
          <h1 className="mt-1 text-2xl font-black text-white">📅 Extend Parking</h1>
          <p className="text-sm text-white/70 mt-0.5">{booking.lot_snapshot_name}</p>
          <p className="font-mono text-xs text-white/50 mt-1">{booking.reference}</p>
          <div className="mt-4"><Link href={`/dashboard/parking/${booking.id}`} className="text-xs text-white/60 hover:text-white/90">← Back to booking</Link></div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 space-y-5">

        {successRef ? (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-black text-emerald-900 text-lg mb-2">Extension Submitted!</h2>
            <p className="text-sm text-emerald-800 mb-1">Extension reference: <strong className="font-mono">{successRef}</strong></p>
            <p className="text-sm text-emerald-700 mb-1">New check-out: <strong>{formatDate(newEndDate)}</strong></p>
            <p className="text-xs text-emerald-600 mb-5">Admin will verify payment and confirm the extension.</p>
            <Link href={`/dashboard/parking/${booking.id}`} className="inline-block rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">Back to My Booking →</Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
              <h2 className="text-sm font-black text-[#134e4a] mb-3">Current Booking</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400 mb-0.5">Current check-out</p><p className="font-semibold text-[#134e4a]">{formatDate(booking.park_date_end)}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Days booked so far</p><p className="font-semibold text-[#134e4a]">{booking.total_days} day{booking.total_days > 1 ? "s" : ""}</p></div>
              </div>
            </div>

            {maxAdditional <= 0 ? (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                <p className="font-bold text-amber-800">Maximum stay reached</p>
                <p className="text-sm text-amber-700 mt-1">You&apos;ve reached the {maxDays}-day limit. Contact admin for further assistance.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 space-y-4">
                  <h2 className="text-sm font-black text-[#134e4a]">Add More Days</h2>
                  <div>
                    <label className={labelCls}>Additional Days (max {maxAdditional})</label>
                    <input type="number" min={1} max={maxAdditional} value={additionalDays}
                      onChange={e => setAdditionalDays(Math.max(1, Math.min(maxAdditional, parseInt(e.target.value) || 1)))}
                      className={inputCls} />
                  </div>
                  <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm">
                    <p className="text-xs text-gray-400 mb-1">New check-out date</p>
                    <p className="font-bold text-[#134e4a]">{formatDate(previewEnd)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-teal-200 bg-white overflow-hidden">
                  <div className="bg-teal-50 px-5 py-2 text-xs font-bold text-[#134e4a] uppercase">Extension Cost</div>
                  <div className="px-5 py-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Parking fee ({booking.vehicle_count} vehicle{booking.vehicle_count > 1 ? "s" : ""} × {additionalDays} day{additionalDays > 1 ? "s" : ""})</span><span className="font-semibold">{peso(parkingFee)}</span></div>
                    <div className="flex justify-between text-xs text-gray-400"><span>Platform Service Fee</span><span>{peso(platformFee)}</span></div>
                    <p className="text-xs text-emerald-600">✓ No commission on extensions</p>
                    <div className="flex justify-between pt-2 border-t-2 border-teal-200"><span className="font-black text-[#134e4a]">Total to Pay</span><span className="font-black text-xl text-[#0c7b93]">{peso(total)}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 space-y-4">
                  <h2 className="text-sm font-black text-[#134e4a]">Pay via GCash</h2>
                  <p className="text-xs text-[#0f766e]">Send <strong>{peso(total)}</strong> to the same GCash number, then upload your screenshot.</p>
                  <div>
                    <label className={labelCls}>GCash Screenshot <span className="text-red-500">*</span></label>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={compressing}
                      className={`w-full rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all flex items-center gap-2 ${compressing ? "border-teal-200 bg-teal-50 text-teal-500 cursor-wait" : gcashFile ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-dashed border-teal-200 bg-white text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50"}`}>
                      {compressing ? <><span className="animate-spin">⏳</span><span className="text-xs">Compressing…</span></> : gcashFile ? <><span className="text-emerald-500 shrink-0">✓</span><span className="truncate text-xs flex-1">{gcashFile.name}</span><span className="text-xs text-emerald-600 shrink-0">Change</span></> : <><span>📸</span><span className="text-xs flex-1">Upload GCash screenshot</span><span className="ml-auto text-xs text-teal-400 shrink-0">Required</span></>}
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>GCash Reference No. <span className="text-gray-400">(optional)</span></label>
                    <input type="text" value={gcashRef} onChange={e => setGcashRef(e.target.value)} placeholder="e.g. 9012345678" className={inputCls} />
                  </div>
                </div>

                {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

                <button onClick={handleSubmit} disabled={!gcashFile || submitting}
                  className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {submitting ? "Submitting…" : `Submit Extension — ${peso(total)}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
