"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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
  const [scanning, setScanning] = useState(false);
  const [debugVal, setDebugVal] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const actionLabels = {
    picked_up:   "Mark as Picked Up",
    on_tour:     "Mark as On Tour",
    dropped_off: "Mark as Dropped Off",
    no_show:     "Mark as No Show",
  };

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
      closeCamera();
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
    setScanning(false);
  }, [stopCamera]);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if ("BarcodeDetector" in window) {
      // @ts-expect-error BarcodeDetector not in TS types yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      detector.detect(canvas).then((barcodes: Array<{ rawValue: string }>) => {
        if (barcodes.length > 0) {
          const rawOriginal = barcodes[0].rawValue;
          console.log("QR RAW VALUE:", rawOriginal);
          setDebugVal(rawOriginal); // show on screen for mobile debugging

          let raw = rawOriginal.trim().toUpperCase();

          // Extract reference from full URL if needed
          if (raw.includes("TRV-TOUR-")) {
            const match = raw.match(/TRV-TOUR-[A-Z0-9]+/);
            if (match) raw = match[0];
          }

          if (raw.startsWith("TRV-")) {
            setReference(raw);
            handleSubmit(raw);
            return;
          }
        }
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }).catch(() => {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      });
    } else {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [handleSubmit]);

  async function openCamera() {
    setCameraError(null);
    setCameraOpen(true);
    setScanning(true);
    setDebugVal("BarcodeDetector: " + ("BarcodeDetector" in window ? "YES" : "NO"));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permission and try again.");
      setScanning(false);
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
      <h2 className="font-bold text-blue-900 mb-1">Scan / Enter Booking Reference</h2>
      <p className="text-xs text-blue-600 mb-4">
        Use camera to scan QR code or type the booking reference manually.
      </p>

      {/* Action selector */}
      <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
        {(Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map((a) => (
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

      {/* Camera viewfinder */}
      {cameraOpen && (
        <div className="mb-4 relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full rounded-xl" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-4 border-white/70 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
            </div>
          </div>

          <button
            onClick={closeCamera}
            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
            Close Camera
          </button>

          {scanning && !debugVal && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs font-semibold">
              Point camera at QR code...
            </p>
          )}

          {/* Debug — shows raw QR value on screen */}
          {debugVal && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-yellow-300 text-xs font-bold px-2 break-all">
              QR: {debugVal}
            </p>
          )}
        </div>
      )}

      {cameraError && (
        <p className="text-xs text-red-600 mb-3 font-semibold">{cameraError}</p>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        {!cameraOpen && (
          <button
            onClick={openCamera}
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
