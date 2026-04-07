"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import { RESCHEDULE_FEE_PERCENT, RESCHEDULE_GCASH_FEE_CENTS, ADMIN_FEE_CENTS_PER_PASSENGER, GCASH_FEE_CENTS, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";

type Alternative = {
  id: string;
  departure_date: string;
  departure_time: string;
  boat_name: string;
  route_label: string;
  seats_available?: number;
};

function formatTime(t: string) {
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m || "00"} ${am ? "AM" : "PM"}`;
}

function formatDate(d: string) {
  try {
    return new Date(d + "Z").toLocaleDateString("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function RequestRescheduleButton({
  reference,
  totalAmountCents,
  passengerCount,
  canReschedule,
}: {
  reference: string;
  totalAmountCents: number;
  passengerCount: number;
  canReschedule: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [alternativesError, setAlternativesError] = useState<string | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [rescheduleFeeCents, setRescheduleFeeCents] = useState(0);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminFee = ADMIN_FEE_CENTS_PER_PASSENGER * Math.max(1, passengerCount);
  const gcashFee = GCASH_FEE_CENTS;
  const fareCents = Math.max(0, totalAmountCents - adminFee - gcashFee);
  const computedFeeCents = Math.round(fareCents * (RESCHEDULE_FEE_PERCENT / 100)) + RESCHEDULE_GCASH_FEE_CENTS;

  useEffect(() => {
    if (!open || !canReschedule) return;
    setLoading(true);
    setAlternativesError(null);
    fetch(`/api/booking/alternatives?reference=${encodeURIComponent(reference)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setAlternativesError(data.error);
          setAlternatives([]);
        } else {
          setAlternatives(data.alternatives ?? []);
        }
      })
      .catch(() => {
        setAlternativesError("Failed to load options");
        setAlternatives([]);
      })
      .finally(() => setLoading(false));
  }, [open, reference, canReschedule]);

  const handleReschedule = async () => {
    if (!selectedTripId) {
      toast.showError("Select a trip.");
      return;
    }
    setRescheduling(true);
    try {
      const res = await fetch("/api/booking/request-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, trip_id: selectedTripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reschedule failed");

      // Show payment modal instead of just closing
      setRescheduleFeeCents(data.additional_fee_cents ?? computedFeeCents);
      setOpen(false);
      setSelectedTripId("");
      setShowPaymentModal(true);
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not reschedule.");
    } finally {
      setRescheduling(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadProof = async () => {
    if (!proofFile) {
      toast.showError("Please select a screenshot first.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("reference", reference);

      const res = await fetch("/api/booking/upload-reschedule-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.showSuccess("Payment screenshot submitted! Admin will confirm shortly.");
      setShowPaymentModal(false);
      setProofFile(null);
      setProofPreview(null);
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (!canReschedule) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-sm font-semibold text-amber-900">Change schedule</p>
        <p className="mt-1 text-xs text-amber-800">
          Reschedule is available at least <strong>24 hours</strong> before departure. For a smooth experience, we kindly suggest arriving at the port 30 min–1 hour before boarding so you don't miss your sailing.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-[#0c7b93] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5 transition-colors"
          >
            Change schedule
          </button>
        ) : (
          <div className="rounded-xl border-2 border-teal-200 bg-teal-50/30 p-5">
            <h2 className="text-base font-semibold text-[#134e4a]">Change schedule</h2>
            <p className="mt-2 text-sm text-[#0f766e]">
              Reschedule only allowed <strong>24+ hours</strong> before departure. Fee: <strong>{RESCHEDULE_FEE_PERCENT}%</strong> of fare + <strong>₱{RESCHEDULE_GCASH_FEE_CENTS / 100}</strong> Payment Processing Fee (₱{(computedFeeCents / 100).toFixed(0)} for this booking). Pay via GCash then upload screenshot.
            </p>
            <p className="mt-1 text-xs text-[#0f766e]">Subject to seat availability. Same route only.</p>
            {loading ? (
              <p className="mt-4 text-sm text-[#0f766e]">Loading options…</p>
            ) : alternativesError ? (
              <p className="mt-4 text-sm text-amber-700">{alternativesError}</p>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium text-[#134e4a]">Select new trip</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
                >
                  <option value="">— Select date & time —</option>
                  {alternatives.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatDate(a.departure_date)} {formatTime(a.departure_time)} · {a.boat_name} · {a.seats_available != null ? `${a.seats_available} seats` : ""}
                    </option>
                  ))}
                </select>
                {alternatives.length === 0 && !loading && (
                  <p className="mt-2 text-sm text-amber-700">No alternative trips with available seats.</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleReschedule}
                    disabled={!selectedTripId || rescheduling}
                    className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
                  >
                    {rescheduling ? "Processing…" : "Confirm change"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setSelectedTripId(""); }}
                    disabled={rescheduling}
                    className="rounded-xl border-2 border-teal-300 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#134e4a]">Pay Reschedule Fee</h2>
            <p className="mt-1 text-sm text-[#0f766e]">
              Your schedule has been changed. Please pay the reschedule fee via GCash and upload your screenshot below.
            </p>

            {/* Fee breakdown */}
            <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Fee Breakdown</p>
              <div className="flex justify-between text-sm text-amber-800">
                <span>Reschedule fee ({RESCHEDULE_FEE_PERCENT}% of fare)</span>
                <span>₱{((rescheduleFeeCents - RESCHEDULE_GCASH_FEE_CENTS) / 100).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-800">
                <span>Payment Processing Fee</span>
                <span>₱{(RESCHEDULE_GCASH_FEE_CENTS / 100).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-amber-900 border-t border-amber-200 pt-1 mt-1">
                <span>Total to pay</span>
                <span>₱{(rescheduleFeeCents / 100).toFixed(0)}</span>
              </div>
            </div>

            {/* GCash info */}
            {GCASH_NUMBER && (
              <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-sm font-semibold text-[#134e4a]">Send via GCash:</p>
                <p className="text-sm text-[#0f766e] mt-0.5">
                  <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME})
                </p>
                <p className="text-xs text-[#0f766e] mt-1">
                  Put your booking reference <strong>{reference}</strong> in the message.
                </p>
              </div>
            )}

            {/* Screenshot upload */}
            <div className="mt-4">
              <p className="text-sm font-semibold text-[#134e4a]">Upload payment screenshot</p>
              <div
                className="mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-4 cursor-pointer hover:bg-teal-50"
                onClick={() => fileInputRef.current?.click()}
              >
                {proofPreview ? (
                  <img src={proofPreview} alt="Payment proof" className="max-h-40 rounded-lg object-contain" />
                ) : (
                  <>
                    <p className="text-sm text-[#0f766e]">📷 Tap to select screenshot</p>
                    <p className="text-xs text-[#0f766e]/60 mt-1">JPG, PNG, or PDF</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {proofFile && (
                <p className="mt-1 text-xs text-[#0f766e]">Selected: {proofFile.name}</p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleUploadProof}
                disabled={!proofFile || uploading}
                className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
              >
                {uploading ? "Uploading…" : "Submit Payment Screenshot"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setProofFile(null);
                  setProofPreview(null);
                  router.refresh();
                }}
                className="rounded-xl border-2 border-teal-300 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
              >
                Later
              </button>
            </div>
            <p className="mt-2 text-xs text-center text-[#0f766e]/60">
              Admin will verify your payment and update your booking.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
