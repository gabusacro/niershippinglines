"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/components/ui/ActionToast";

export function CrewTicketScanner() {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    reference: string;
    passenger_name: string;
    status: string;
    trip: { date?: string; time?: string; vessel?: string; route?: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const toast = useToast();

  const validateTicket = useCallback(async (payload: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/crew/validate-ticket?payload=${encodeURIComponent(payload)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.showError(data.error ?? "Invalid ticket");
        return;
      }
      setResult(data);
    } catch {
      toast.showError("Could not validate ticket");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleCheckIn = useCallback(async (action: "checked_in" | "boarded") => {
    if (!result?.reference) return;
    setLoading(true);
    try {
      const res = await fetch("/api/crew/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: result.reference, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.showError(data.error ?? "Check-in failed");
        return;
      }
      toast.showSuccess(`Ticket ${action === "checked_in" ? "checked in" : "boarded"} successfully`);
      setResult((prev) => prev ? { ...prev, status: data.status } : null);
    } catch {
      toast.showError("Check-in failed");
    } finally {
      setLoading(false);
    }
  }, [result?.reference, toast]);

  // KEY FIX: initScanner is called from a useEffect that watches `starting`.
  // This guarantees the #qr-reader div is actually mounted in the DOM before
  // we try to hand it to Html5Qrcode.
  const initScanner = useCallback(() => {
    const scannerId = "qr-reader";

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          toast.showError("No camera found. Use a device with a camera.");
          setStarting(false);
          return;
        }

        // Prefer back/environment camera for QR scanning
        const backCam = cameras.find(
          (c) =>
            /back|environment|rear/i.test(c.label)
        );
        const cam = backCam ?? cameras[cameras.length - 1];

        const qrboxSize = Math.min(
          280,
          typeof window !== "undefined" ? window.innerWidth - 48 : 250
        );

        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            // Use facingMode instead of cam.id for better iOS/Android compat
            { facingMode: "environment" },
            {
              fps: 4,
              qrbox: { width: qrboxSize, height: qrboxSize },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              html5QrCode.stop().catch(() => {});
              setScanning(false);
              setStarting(false);
              validateTicket(decodedText);
            },
            () => {} // ignore per-frame errors
          )
          .then(() => {
            setStarting(false);
            setScanning(true);
          })
          .catch((err: unknown) => {
            setStarting(false);
            setScanning(false);
            scannerRef.current = null;
            const msg = err instanceof Error ? err.message : "Could not start camera";
            const hint = /secure|https|permission|denied|not allowed/i.test(msg)
              ? " Make sure you're on HTTPS and have allowed camera access."
              : " Allow camera permission and try again.";
            toast.showError(msg + hint);
          });
      })
      .catch((err: unknown) => {
        setStarting(false);
        const msg = err instanceof Error ? err.message : "";
        const hint = /permission|denied/i.test(msg)
          ? "Camera permission denied. Allow camera in browser settings."
          : "Could not access camera. Use HTTPS and allow camera permission.";
        toast.showError(hint);
      });
  }, [validateTicket, toast]);

  // When `starting` flips to true, the #qr-reader div mounts on the next
  // render. The useEffect below fires after that render, so the element is
  // guaranteed to exist when initScanner runs.
  useEffect(() => {
    if (!starting) return;
    // One extra rAF to let the browser paint the div before we grab it
    const raf = requestAnimationFrame(() => {
      initScanner();
    });
    return () => cancelAnimationFrame(raf);
  }, [starting, initScanner]);

  const startScan = useCallback(() => {
    setResult(null);
    setStarting(true); // triggers useEffect above after render
  }, []);

  const stopScan = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
    setStarting(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  return (
    <div className="space-y-4">
      {/* Scan button — only when idle */}
      {!scanning && !starting && (
        <button
          type="button"
          onClick={startScan}
          disabled={loading}
          className="w-full rounded-xl bg-[#0c7b93] px-6 py-4 text-lg font-semibold text-white hover:bg-[#0a6b7d] disabled:opacity-50 touch-manipulation"
          style={{ minHeight: 52 }}
        >
          {loading ? "Validating…" : "Scan ticket QR code"}
        </button>
      )}

      {/* Camera area — rendered whenever starting OR scanning so the div
          is always in the DOM when Html5Qrcode needs it */}
      {(starting || scanning) && (
        <div className="space-y-2">
          {/* #qr-reader must be visible with real dimensions before
              Html5Qrcode.start() is called — min-height guarantees this */}
          <div
            id="qr-reader"
            className="overflow-hidden rounded-xl border-2 border-teal-300 w-full bg-black"
            style={{ minHeight: 280, width: "100%" }}
          />

          {starting && (
            <p className="text-center text-sm text-[#0f766e] font-medium py-1">
              Starting camera… allow access if prompted.
            </p>
          )}

          <button
            type="button"
            onClick={stopScan}
            className="w-full rounded-xl border-2 border-red-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50 touch-manipulation"
          >
            Cancel scan
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-xl border-2 border-teal-200 bg-teal-50/50 p-4">
          <h3 className="text-lg font-semibold text-[#134e4a]">Ticket validated</h3>
          <p className="mt-1 font-mono font-bold text-[#0c7b93]">{result.reference}</p>
          <p className="mt-1 text-[#134e4a]">{result.passenger_name}</p>
          {result.trip && (
            <p className="mt-1 text-sm text-[#0f766e]">
              {result.trip.route} · {result.trip.vessel} · {result.trip.date} {result.trip.time}
            </p>
          )}
          <p className="mt-2 text-sm">
            <span className="font-semibold text-amber-800">Status:</span> {result.status}
          </p>
          {(result.status === "confirmed" || result.status === "checked_in") && (
            <div className="mt-4 flex gap-2">
              {result.status === "confirmed" && (
                <button
                  type="button"
                  onClick={() => handleCheckIn("checked_in")}
                  disabled={loading}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 touch-manipulation"
                >
                  Check in
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCheckIn("boarded")}
                disabled={loading}
                className="rounded-lg bg-[#0c7b93] px-4 py-2 font-semibold text-white hover:bg-[#0a6b7d] disabled:opacity-50 touch-manipulation"
              >
                Mark boarded
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setResult(null); }}
            className="mt-3 text-sm font-semibold text-[#0c7b93] hover:underline"
          >
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}
