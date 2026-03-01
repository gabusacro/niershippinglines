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

type IdVerification = {
  id: string;
  discount_type: string;
  status: "pending" | "verified" | "rejected" | string;
  image_url: string | null;
  expires_at: string | null;
  uploaded_at: string | null;
  admin_note: string | null;
  is_expired: boolean;
};

type ScanResult = {
  valid: boolean;
  refunded?: boolean;
  refund_blocked?: boolean;
  reference: string;
  ticket_number?: string;
  passenger_index?: number;
  passenger_name: string;
  fare_type?: string;
  status: string;
  refund_status?: string;
  refund_note?: string | null;
  refund_gcash_reference?: string | null;
  passenger_gender?: string | null;
  passenger_birthdate?: string | null;
  passenger_nationality?: string | null;
  trip: { date?: string; time?: string; vessel?: string; route?: string } | null;
  id_required?: boolean;
  id_verification?: IdVerification | null;
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved — awaiting GCash transfer",
  processed: "Processed — GCash sent",
  rejected: "Rejected",
};

const FARE_TYPE_LABELS: Record<string, string> = {
  adult: "Adult",
  senior: "Senior Citizen",
  pwd: "PWD",
  student: "Student",
  child: "Child",
  infant: "Infant",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed:       { label: "✓ Confirmed",    className: "bg-green-100 text-green-800 border-green-300" },
    checked_in:      { label: "✓ Checked in",   className: "bg-teal-100 text-teal-800 border-teal-300" },
    boarded:         { label: "✓ Boarded",       className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    pending_payment: { label: "⏳ Pending payment", className: "bg-amber-100 text-amber-800 border-amber-300" },
    refunded:        { label: "↩ Refunded",      className: "bg-red-100 text-red-800 border-red-300" },
    cancelled:       { label: "✕ Cancelled",     className: "bg-slate-100 text-slate-700 border-slate-300" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${s.className}`}>
      {s.label}
    </span>
  );
}

function IdVerificationPanel({ idVerification, fareType }: {
  idVerification: IdVerification | null | undefined;
  fareType?: string;
}) {
  const [imgExpanded, setImgExpanded] = useState(false);

  if (!fareType || !["senior","pwd","student","child"].includes(fareType)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">Regular passenger — no discount ID required.</p>
      </div>
    );
  }

  if (!idVerification) {
    return (
      <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
        <p className="text-sm font-bold text-red-800">⚠ No ID on file</p>
        <p className="text-xs text-red-700 mt-1">
          This passenger has not uploaded a {FARE_TYPE_LABELS[fareType] ?? fareType} ID.
          Please verify their physical ID before allowing the discount fare.
        </p>
      </div>
    );
  }

  const statusConfig = {
    verified: { label: "✓ Verified",      bg: "bg-green-50",  border: "border-green-300",  text: "text-green-800"  },
    pending:  { label: "⏳ Pending review", bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-800"  },
    rejected: { label: "✕ Rejected",       bg: "bg-red-50",    border: "border-red-300",    text: "text-red-800"    },
  }[idVerification.status] ?? { label: idVerification.status, bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700" };

  const uploadedDate = idVerification.uploaded_at
    ? new Date(idVerification.uploaded_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
    : null;
  const expiresDate = idVerification.expires_at
    ? new Date(idVerification.expires_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className={`rounded-xl border-2 ${statusConfig.border} ${statusConfig.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#134e4a]">
          🪪 {FARE_TYPE_LABELS[fareType] ?? fareType} ID
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${statusConfig.border} ${statusConfig.text} bg-white`}>
          {statusConfig.label}
        </span>
      </div>

      {/* ID Image */}
      {idVerification.image_url && (
        <div>
          {idVerification.is_expired && (
            <p className="text-xs font-bold text-red-700 mb-1">⚠ This ID has expired — verify current physical ID</p>
          )}
          {imgExpanded ? (
            <div className="space-y-2">
              <img
                src={idVerification.image_url}
                alt="Passenger ID"
                className="w-full rounded-lg border border-slate-200 object-contain max-h-64"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <button
                type="button"
                onClick={() => setImgExpanded(false)}
                className="text-xs text-blue-600 underline"
              >
                Hide ID image
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setImgExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
            >
              👁 View uploaded ID photo
            </button>
          )}
        </div>
      )}

      {!idVerification.image_url && (
        <p className="text-xs text-slate-500 italic">No image available — verify physical ID.</p>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        {uploadedDate && <p>Uploaded: <strong>{uploadedDate}</strong></p>}
        {expiresDate && (
          <p className={idVerification.is_expired ? "text-red-700 font-semibold" : ""}>
            Expires: <strong>{expiresDate}</strong>
            {idVerification.is_expired && " ⚠"}
          </p>
        )}
      </div>

      {/* Admin note */}
      {idVerification.admin_note && (
        <p className="text-xs text-slate-600 italic border-t border-slate-200 pt-2">
          Note: {idVerification.admin_note}
        </p>
      )}

      {/* Status guidance for crew */}
      {idVerification.status === "pending" && (
        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
          <p className="text-xs text-amber-800 font-semibold">ID pending admin verification.</p>
          <p className="text-xs text-amber-700 mt-0.5">Ask passenger to show their physical ID to confirm discount eligibility.</p>
        </div>
      )}
      {idVerification.status === "rejected" && (
        <div className="rounded-lg border border-red-200 bg-white px-3 py-2">
          <p className="text-xs text-red-800 font-semibold">ID was rejected by admin.</p>
          <p className="text-xs text-red-700 mt-0.5">Verify their physical ID carefully before allowing discount fare.</p>
        </div>
      )}
    </div>
  );
}

export function CrewTicketScanner() {
  const [scanning,  setScanning]  = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [result,    setResult]    = useState<ScanResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const scannerRef  = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      const body = result.ticket_number
        ? { ticket_number: result.ticket_number, action }
        : { reference: result.reference, passenger_index: result.passenger_index ?? 0, action };

      const res = await fetch("/api/crew/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.showError(data.error ?? "Check-in failed"); return; }
      toast.showSuccess(`Passenger ${action === "checked_in" ? "checked in" : "boarded"} successfully`);
      setResult(prev => prev ? { ...prev, status: data.status } : null);
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
    // First explicitly request camera permission before initialising Html5Qrcode
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        // Stop the test stream immediately — we just needed permission
        stream.getTracks().forEach(t => t.stop());

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
            const msg = err instanceof Error ? err.message : String(err);
            toast.showError("Camera error: " + msg + " — Try allowing camera in browser settings.");
          });
      })
      .catch((err: unknown) => {
        setStarting(false);
        setScanning(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|not allowed|permission/i.test(msg)) {
          toast.showError("Camera permission denied. Tap the camera icon in your browser address bar and allow access, then try again.");
        } else {
          toast.showError("Could not access camera: " + msg);
        }
      });
  }, [validateTicket, toast]);

  useEffect(() => {
    if (!starting) return;
    const raf = requestAnimationFrame(() => { initScanner(); });
    return () => cancelAnimationFrame(raf);
  }, [starting, initScanner]);

  const startScan = useCallback(() => {
    setResult(null);
    setStarting(true);
  }, []);

  const stopScan = useCallback(() => {
    if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
    setScanning(false);
    setStarting(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const canCheckIn = result?.valid && !["checked_in","boarded"].includes(result.status);
  const canBoard   = result?.valid && result.status === "checked_in";
  const isBoarded  = result?.status === "boarded";

  return (
    <div className="space-y-4">

      {/* Scan button */}
      {!scanning && !starting && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={startScan}
            disabled={loading}
            className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
          >
            {loading ? "Validating…" : "📷 Scan QR Code"}
          </button>
        </div>
      )}

      {/* Starting state */}
      {starting && (
        <div className="flex items-center justify-center rounded-xl border-2 border-teal-200 bg-teal-50 py-8">
          <p className="text-sm text-[#0f766e] animate-pulse">Starting camera…</p>
        </div>
      )}

      {/* Camera view — always in DOM so Html5Qrcode can find it, hidden when not scanning */}
      <div className={scanning ? "space-y-3" : "hidden"}>
        <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-teal-300" />
        <button
          type="button"
          onClick={stopScan}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Stop scanning
        </button>
      </div>

      {/* Loading */}
      {loading && !scanning && (
        <div className="flex items-center justify-center rounded-xl border-2 border-teal-100 bg-teal-50 py-6">
          <p className="text-sm text-[#0f766e] animate-pulse">Validating ticket…</p>
        </div>
      )}

      {/* ── SCAN RESULT ─────────────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-3">

          {/* Header — valid or blocked */}
          {result.refunded ? (
            <div className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3">
              <p className="font-bold text-red-800 text-lg">↩ REFUNDED TICKET</p>
              <p className="text-sm text-red-700 mt-1">This ticket has been refunded. Do not allow boarding.</p>
            </div>
          ) : result.refund_blocked ? (
            <div className="rounded-xl border-2 border-orange-400 bg-orange-50 px-4 py-3">
              <p className="font-bold text-orange-800 text-lg">⚠ REFUND IN PROGRESS</p>
              <p className="text-sm text-orange-700 mt-1">
                Refund status: <strong>{REFUND_STATUS_LABELS[result.refund_status ?? ""] ?? result.refund_status}</strong>.
                Contact admin before allowing boarding.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-green-300 bg-green-50 px-4 py-3">
              <p className="font-bold text-green-800 text-lg">✓ VALID TICKET</p>
            </div>
          )}

          {/* Passenger info */}
          <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[#0f766e] tracking-wide mb-1">Passenger</p>
              <p className="text-xl font-bold text-[#134e4a]">{result.passenger_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                  {FARE_TYPE_LABELS[result.fare_type ?? "adult"] ?? result.fare_type ?? "Adult"}
                </span>
                <StatusBadge status={result.status} />
              </div>
            </div>

            {/* Passenger details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 border-t border-teal-100 pt-2">
              {result.passenger_gender && <p>Gender: <strong>{result.passenger_gender}</strong></p>}
              {result.passenger_birthdate && <p>Birthdate: <strong>{result.passenger_birthdate}</strong></p>}
              {result.passenger_nationality && <p>Nationality: <strong>{result.passenger_nationality}</strong></p>}
              {result.reference && <p>Ref: <strong className="font-mono">{result.reference}</strong></p>}
              {result.ticket_number && <p>Ticket: <strong className="font-mono text-xs">{result.ticket_number}</strong></p>}
            </div>

            {/* Trip info */}
            {result.trip && (
              <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#134e4a]">
                {result.trip.route  && <p>Route: <strong>{result.trip.route}</strong></p>}
                {result.trip.vessel && <p>Vessel: <strong>{result.trip.vessel}</strong></p>}
                {result.trip.date   && <p>Date: <strong>{result.trip.date}</strong></p>}
                {result.trip.time   && <p>Time: <strong>{result.trip.time}</strong></p>}
              </div>
            )}
          </div>

          {/* ── ID Verification Panel ─────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase text-[#0f766e] tracking-wide mb-1">Discount ID</p>
            <IdVerificationPanel
              idVerification={result.id_verification}
              fareType={result.fare_type}
            />
          </div>

          {/* ── Check-in / Board actions ──────────────────────────────────────── */}
          {result.valid && (
            <div className="space-y-2">
              {isBoarded ? (
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center">
                  <p className="font-bold text-emerald-800">✓ Already boarded</p>
                </div>
              ) : (
                <>
                  {canCheckIn && (
                    <button
                      type="button"
                      onClick={() => handleCheckIn("checked_in")}
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {loading ? "Processing…" : "✓ Check In Passenger"}
                    </button>
                  )}
                  {canBoard && (
                    <button
                      type="button"
                      onClick={() => handleCheckIn("boarded")}
                      disabled={loading}
                      className="w-full min-h-[48px] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loading ? "Processing…" : "🚢 Mark as Boarded"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setResult(null)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Scan another ticket
          </button>
        </div>
      )}
    </div>
  );
}
