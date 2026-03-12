"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  guideId: string;
  todayPH: string;
}

type ScannedBooking = {
  id: string;
  reference: string;
  customer_name: string;
  tour_title: string;
  total_pax: number;
  schedule_date: string;
  current_status: string | null;
};

export default function TourGuideScanner({ guideId, todayPH }: Props) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [scannedBooking, setScannedBooking] = useState<ScannedBooking | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "tour-guide-qr-scanner";

  const actionColors: Record<string, string> = {
    picked_up:   "bg-blue-600 hover:bg-blue-700",
    on_tour:     "bg-emerald-600 hover:bg-emerald-700",
    dropped_off: "bg-teal-600 hover:bg-teal-700",
    no_show:     "bg-red-500 hover:bg-red-600",
  };

  const actionLabels: Record<string, string> = {
    picked_up:   "✅ Picked Up",
    on_tour:     "🚐 On Tour",
    dropped_off: "📍 Dropped Off",
    no_show:     "❌ No Show",
  };

  const statusLabels: Record<string, string> = {
    assigned:    "Waiting",
    picked_up:   "Picked Up",
    on_tour:     "On Tour",
    dropped_off: "Dropped Off",
    no_show:     "No Show",
  };

  // Lookup booking by reference (no marking yet)
  async function lookupBooking(ref: string) {
    const refToUse = ref.trim().toUpperCase();
    if (!refToUse) return;
    setLoading(true);
    setScannedBooking(null);
    setResult(null);
    try {
      const res = await fetch("/api/tour-guide/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: refToUse, guide_id: guideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setScannedBooking(data.booking);
      await stopCamera();
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  // Mark status after seeing guest info
  async function markStatus(action: string) {
    if (!scannedBooking) return;
    setMarking(true);
    setResult(null);
    try {
      const res = await fetch("/api/tour-guide/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: scannedBooking.reference,
          guide_id: guideId,
          action,
          today: todayPH,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mark failed");
      setResult({ success: true, message: data.message });
      setScannedBooking(null);
      setReference("");
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setMarking(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    setCameraOpen(true);
    setResult(null);
    setScannedBooking(null);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let raw = decodedText.trim().toUpperCase();
          if (raw.includes("TRV-TOUR-")) {
            const match = raw.match(/TRV-TOUR-[A-Z0-9]+/);
            if (match) raw = match[0];
          }
          if (raw.startsWith("TRV-")) {
            lookupBooking(raw);
          }
        },
        undefined
      );
    } catch {
      setCameraError("Camera access denied. Please allow camera permission and try again.");
      setCameraOpen(false);
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
      <h2 className="font-bold text-blue-900 mb-1">Scan Guest QR Code</h2>
      <p className="text-xs text-blue-600 mb-4">
        Scan the guest&apos;s voucher QR code, then choose their status.
      </p>

      {/* Camera */}
      {cameraOpen && (
        <div className="mb-4">
          <div id={scannerDivId} className="rounded-xl overflow-hidden" />
          <button onClick={stopCamera}
            className="mt-2 w-full rounded-xl bg-gray-800 text-white text-xs font-semibold py-2 hover:bg-gray-700">
            Close Camera
          </button>
        </div>
      )}

      {cameraError && (
        <p className="text-xs text-red-600 mb-3 font-semibold">{cameraError}</p>
      )}

      {/* Input row */}
      {!scannedBooking && (
        <div className="flex gap-2">
          {!cameraOpen && (
            <button onClick={startCamera}
              className="px-4 py-3 rounded-xl bg-white border-2 border-blue-200 text-blue-700 text-sm font-bold hover:border-blue-400 transition-colors"
              title="Open camera scanner">
              📷
            </button>
          )}
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookupBooking(reference)}
            placeholder="TRV-TOUR-XXXXXX"
            className="flex-1 rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-blue-500 bg-white"
          />
          <button
            onClick={() => lookupBooking(reference)}
            disabled={loading || !reference.trim()}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 transition-colors">
            {loading ? "..." : "Find"}
          </button>
        </div>
      )}

      {/* Guest info card — shown after scan */}
      {scannedBooking && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-white p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono text-xs text-emerald-600 font-bold">{scannedBooking.reference}</p>
              <p className="font-bold text-[#134e4a] text-lg">{scannedBooking.customer_name}</p>
              <p className="text-sm text-gray-500">{scannedBooking.tour_title}</p>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
              {scannedBooking.total_pax} guest{scannedBooking.total_pax > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <span>📅 {scannedBooking.schedule_date}</span>
            {scannedBooking.current_status && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                Current: {statusLabels[scannedBooking.current_status] ?? scannedBooking.current_status}
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Mark as:</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(actionLabels).map((a) => (
              <button
                key={a}
                onClick={() => markStatus(a)}
                disabled={marking}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 ${actionColors[a]}`}>
                {marking ? "..." : actionLabels[a]}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setScannedBooking(null); setReference(""); }}
            className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 font-semibold">
            Cancel — Scan different guest
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={
          "mt-4 rounded-xl px-4 py-3 " +
          (result.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")
        }>
          <p className={"text-sm font-bold " + (result.success ? "text-emerald-700" : "text-red-600")}>
            {result.success ? "✅ " : "❌ "}{result.message}
          </p>
          {result.success && (
            <button
              onClick={() => { setResult(null); setReference(""); }}
              className="mt-2 text-xs text-emerald-600 hover:underline font-semibold">
              Scan next guest →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
