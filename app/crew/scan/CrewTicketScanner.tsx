"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/components/ui/ActionToast";

function hasGetUserMedia() {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

type ScanResult = {
  valid: boolean;
  refunded?: boolean;
  refund_blocked?: boolean;
  reference: string;
  ticket_number?: string;
  passenger_index?: number;
  passenger_name: string;
  status: string;
  refund_status?: string;
  refund_note?: string | null;
  refund_gcash_reference?: string | null;
  trip: { date?: string; time?: string; vessel?: string; route?: string } | null;
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved — awaiting GCash transfer",
  processed: "Processed — GCash sent",
  rejected: "Rejected",
};

export function CrewTicketScanner() {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const validateTicket = useCallback(async (payload: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/crew/validate-ticket?payload=${encodeURIComponent(payload)}`);
      const data = await res.json();

      // ⭐ Refunded or refund-blocked — show the void card instead of a toast
      if (!res.ok && (data.refunded || data.refund_blocked)) {
        setResult(data as ScanResult);
        return;
      }

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
      const body = result.ticket_number
        ? { ticket_number: result.ticket_number, action }
        : { reference: result.reference, passenger_index: result.passenger_index ?? 0, action };

      const res = await fetch("/api/crew/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.showError(data.error ?? "Check-in failed");
        return;
      }
      toast.showSuccess(`Passenger ${action === "checked_in" ? "checked in" : "boarded"} successfully`);
      setResult((prev) => prev ? { ...prev, status: data.status } : null);
    } catch {
      toast.showError("Check-in failed");
    } finally {
      setLoading(false);
    }
  }, [result, toast]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const tempId = "qr-scanner-temp";
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement("div");
        tempEl.id = tempId;
        tempEl.style.display = "none";
        document.body.appendChild(tempEl);
      }
      const scanner = new Html5Qrcode(tempId);
      try {
        const decoded = await scanner.scanFile(file, false);
        validateTicket(decoded);
      } catch {
        toast.showError("No QR code found in the photo. Try again with better lighting.");
      } finally {
        scanner.clear();
      }
    } catch {
      toast.showError("Could not read the image.");
    } finally {
      setLoading(false);
    }
  }, [validateTicket, toast]);

  const initScanner = useCallback(() => {
    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          toast.showError("No camera found.");
          setStarting(false);
          return;
        }
        const qrboxSize = Math.min(280, typeof window !== "undefined" ? window.innerWidth - 48 : 250);
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        html5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 4, qrbox: { width: qrboxSize, height: qrboxSize }, aspectRatio: 1.0 },
            (decodedText) => {
              html5QrCode.stop().catch(() => {});
              setScanning(false);
              setStarting(false);
              validateTicket(decodedText);
            },
            () => {}
          )
          .then(() => { setStarting(false); setScanning(true); })
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
      .catch(() => {
        setStarting(false);
        toast.showError("Could not access camera. Use HTTPS and allow camera permission.");
      });
  }, [validateTicket, toast]);

  useEffect(() => {
    if (!starting) return;
    const raf = requestAnimationFrame(() => { initScanner(); });
    return () => cancelAnimationFrame(raf);
  }, [starting, initScanner]);

  const startScan = useCallback(() => {
    setResult(null);
    if (!hasGetUserMedia()) {
      fileInputRef.current?.click();
      return;
    }
    setStarting(true);
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

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

      {(starting || scanning) && (
        <div className="space-y-2">
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

      {/* ⭐ REFUNDED — Void card */}
      {result && result.refunded && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🚫</span>
            <div>
              <h3 className="text-lg font-bold text-red-900">TICKET VOID — REFUNDED</h3>
              <p className="text-xs font-medium text-red-700">Do not allow boarding</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-mono font-bold text-red-800">{result.reference}</p>
            {result.ticket_number && (
              <p className="text-xs font-mono text-red-700">Ticket #: {result.ticket_number}</p>
            )}
            <p className="text-red-900"><span className="font-semibold">Passenger:</span> {result.passenger_name}</p>
            {result.refund_status && (
              <p className="text-red-800"><span className="font-semibold">Refund status:</span> {REFUND_STATUS_LABELS[result.refund_status] ?? result.refund_status}</p>
            )}
            {result.refund_gcash_reference && (
              <p className="text-red-800"><span className="font-semibold">GCash ref:</span> <span className="font-mono">{result.refund_gcash_reference}</span></p>
            )}
            {result.refund_note && (
              <div className="mt-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2">
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Admin note</p>
                <p className="mt-0.5 text-sm text-red-900">{result.refund_note}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-4 w-full rounded-xl border-2 border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-100 touch-manipulation"
          >
            Scan another
          </button>
        </div>
      )}

      {/* ⭐ REFUND IN PROGRESS — Cannot board yet */}
      {result && result.refund_blocked && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⛔</span>
            <div>
              <h3 className="text-lg font-bold text-amber-900">BOARDING BLOCKED</h3>
              <p className="text-xs font-medium text-amber-700">Active refund request on this booking</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-mono font-bold text-amber-800">{result.reference}</p>
            {result.ticket_number && (
              <p className="text-xs font-mono text-amber-700">Ticket #: {result.ticket_number}</p>
            )}
            <p className="text-amber-900"><span className="font-semibold">Passenger:</span> {result.passenger_name}</p>
            {result.refund_status && (
              <p className="text-amber-800">
                <span className="font-semibold">Refund status:</span> {REFUND_STATUS_LABELS[result.refund_status] ?? result.refund_status}
              </p>
            )}
            {result.refund_note && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Admin note</p>
                <p className="mt-0.5 text-sm text-amber-900">{result.refund_note}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-amber-700">
            Contact admin to resolve the refund before this passenger can board.
          </p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-3 w-full rounded-xl border-2 border-amber-300 px-4 py-2 font-semibold text-amber-800 hover:bg-amber-100 touch-manipulation"
          >
            Scan another
          </button>
        </div>
      )}

      {/* ✅ Valid ticket */}
      {result && result.valid && (
        <div className="rounded-xl border-2 border-teal-200 bg-teal-50/50 p-4">
          <h3 className="text-lg font-semibold text-[#134e4a]">Ticket validated</h3>
          <p className="mt-1 font-mono font-bold text-[#0c7b93]">{result.reference}</p>
          {result.ticket_number && (
            <p className="text-xs font-mono text-[#0f766e]">Ticket #: {result.ticket_number}</p>
          )}
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
