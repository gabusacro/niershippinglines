"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  guideId: string;
  todayPH: string;
}

export default function TourGuideScanner({ guideId, todayPH }: Props) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    booking?: {
      reference: string;
      customer_name: string;
      tour_title: string;
      total_pax: number;
    };
  } | null>(null);

  const [action, setAction] = useState<"picked_up" | "on_tour" | "dropped_off" | "no_show">("picked_up");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "tour-guide-qr-scanner";

  const actionColors = {
    picked_up:   "bg-blue-600 hover:bg-blue-700",
    on_tour:     "bg-emerald-600 hover:bg-emerald-700",
    dropped_off: "bg-teal-600 hover:bg-teal-700",
    no_show:     "bg-red-500 hover:bg-red-600",
  };

  async function handleSubmit(ref?: string) {
    const refToUse = (ref ?? reference).trim().toUpperCase();
    if (!refToUse) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tour-guide/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: refToUse,
          guide_id: guideId,
          action,
          today: todayPH,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult({ success: true, message: data.message, booking: data.booking });
      setReference("");
      stopCamera();
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    setCameraOpen(true);
    setResult(null);

    // Wait for div to be in DOM
    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let raw = decodedText.trim().toUpperCase();
          // Extract from full URL if needed
          if (raw.includes("TRV-TOUR-")) {
            const match = raw.match(/TRV-TOUR-[A-Z0-9]+/);
            if (match) raw = match[0];
          }
          if (raw.startsWith("TRV-")) {
            handleSubmit(raw);
          }
        },
        undefined
      );
    } catch (err) {
      setCameraError("Camera access denied. Please allow camera permission and try again.");
      setCameraOpen(false);
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
      <h2 className="font-bold text-blue-900 mb-1">Scan / Enter Booking Reference</h2>
      <p className="text-xs text-blue-600 mb-4">
        Use camera to scan QR code or type the booking reference manually.
      </p>

      {/* Action selector */}
      <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
        {(["picked_up", "on_tour", "dropped_off", "no_show"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={
              "py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors " +
              (action === a
                ? "border-blue-500 bg-blue-100 text-blue-800"
                : "border-gray-200 bg-white text-gray-500 hover:border-blue-300")
            }>
            {a === "picked_up" ? "Picked Up" :
             a === "on_tour" ? "On Tour" :
             a === "dropped_off" ? "Dropped Off" : "No Show"}
          </button>
        ))}
      </div>

      {/* Camera viewfinder — Html5Qrcode renders into this div */}
      {cameraOpen && (
        <div className="mb-4">
          <div id={scannerDivId} className="rounded-xl overflow-hidden" />
          <button
            onClick={stopCamera}
            className="mt-2 w-full rounded-xl bg-gray-800 text-white text-xs font-semibold py-2 hover:bg-gray-700">
            Close Camera
          </button>
        </div>
      )}

      {cameraError && (
        <p className="text-xs text-red-600 mb-3 font-semibold">{cameraError}</p>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        {!cameraOpen && (
          <button
            onClick={startCamera}
            className="px-4 py-3 rounded-xl bg-white border-2 border-blue-200 text-blue-700 text-sm font-bold hover:border-blue-400 transition-colors"
            title="Open camera scanner">
            📷
          </button>
        )}
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="TRV-TOUR-XXXXXX"
          className="flex-1 rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-blue-500 bg-white"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !reference.trim()}
          className={"px-5 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors " + actionColors[action]}>
          {loading ? "..." : "Mark"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={
          "mt-4 rounded-xl px-4 py-3 " +
          (result.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")
        }>
          <p className={"text-sm font-bold " + (result.success ? "text-emerald-700" : "text-red-600")}>
            {result.success ? "✅ " : "❌ "}{result.message}
          </p>
          {result.booking && (
            <div className="mt-2 text-xs text-gray-600 space-y-0.5">
              <p><span className="font-semibold">Tour:</span> {result.booking.tour_title}</p>
              <p><span className="font-semibold">Guest:</span> {result.booking.customer_name}</p>
              <p><span className="font-semibold">Pax:</span> {result.booking.total_pax}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
