"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import { RESCHEDULE_FEE_PERCENT, RESCHEDULE_GCASH_FEE_CENTS, ADMIN_FEE_CENTS_PER_PASSENGER, GCASH_FEE_CENTS } from "@/lib/constants";

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

  const adminFee = ADMIN_FEE_CENTS_PER_PASSENGER * Math.max(1, passengerCount);
  const gcashFee = GCASH_FEE_CENTS;
  const fareCents = Math.max(0, totalAmountCents - adminFee - gcashFee);
  const rescheduleFeeCents = Math.round(fareCents * (RESCHEDULE_FEE_PERCENT / 100)) + RESCHEDULE_GCASH_FEE_CENTS;

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
      toast.showSuccess(data.message ?? "Booking rescheduled.");
      setOpen(false);
      setSelectedTripId("");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not reschedule.");
    } finally {
      setRescheduling(false);
    }
  };

  if (!canReschedule) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-sm font-semibold text-amber-900">Change schedule</p>
        <p className="mt-1 text-xs text-amber-800">
          Reschedule is available at least <strong>24 hours</strong> before departure. For a smooth experience, we kindly suggest arriving at the port 30 min–1 hour before boarding so you don’t miss your sailing.
        </p>
      </div>
    );
  }

  return (
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
            Reschedule only allowed <strong>24+ hours</strong> before departure. Fee: <strong>{RESCHEDULE_FEE_PERCENT}%</strong> of fare + <strong>₱{RESCHEDULE_GCASH_FEE_CENTS / 100}</strong> GCash fee (₱{(rescheduleFeeCents / 100).toFixed(0)} for this booking). Pay at the ticket booth.
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
  );
}
