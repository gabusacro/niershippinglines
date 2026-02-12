"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/components/ui/ActionToast";

export function CrewTicketScanner() {
  const [scanning, setScanning] = useState(false);
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

  const startScan = useCallback(() => {
    const scannerId = "qr-reader";
    const el = document.getElementById(scannerId);
    if (!el) return;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          toast.showError("No camera found");
          return;
        }
        const backCam = cameras.find((c) => c.label.toLowerCase().includes("back"));
        const cam = backCam ?? cameras[0];

        scannerRef.current = new Html5Qrcode(scannerId);
        scannerRef.current
          .start(
            cam.id,
            { fps: 4, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              scannerRef.current?.stop();
              setScanning(false);
              validateTicket(decodedText);
            },
            () => {}
          )
          .then(() => setScanning(true))
          .catch((err: Error) => toast.showError(err.message ?? "Could not start camera"));
      })
      .catch(() => toast.showError("Could not access camera"));
  }, [validateTicket, toast]);

  const stopScan = useCallback(() => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop();
      setScanning(false);
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  return (
    <div className="space-y-4">
      {!scanning ? (
        <button
          type="button"
          onClick={startScan}
          disabled={loading}
          className="w-full rounded-xl bg-[#0c7b93] px-6 py-4 text-lg font-semibold text-white hover:bg-[#0a6b7d] disabled:opacity-50"
        >
          {loading ? "Validating…" : "Scan ticket QR code"}
        </button>
      ) : (
        <div className="space-y-2">
          <div id="qr-reader" className="overflow-hidden rounded-xl border-2 border-teal-300" />
          <button
            type="button"
            onClick={stopScan}
            className="w-full rounded-xl border-2 border-red-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
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
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Check in
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCheckIn("boarded")}
                disabled={loading}
                className="rounded-lg bg-[#0c7b93] px-4 py-2 font-semibold text-white hover:bg-[#0a6b7d] disabled:opacity-50"
              >
                Mark boarded
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-3 text-sm font-semibold text-[#0c7b93] hover:underline"
          >
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}
