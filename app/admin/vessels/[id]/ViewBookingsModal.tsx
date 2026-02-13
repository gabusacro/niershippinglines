"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

type BookingItem = {
  id: string;
  reference: string;
  customer_full_name: string;
  customer_email: string;
  customer_mobile: string | null;
  passenger_count: number;
  passenger_names: string[];
  status: string;
  total_amount_cents: number;
  booking_source: string;
  is_walk_in?: boolean;
};

type AlternativeTrip = {
  id: string;
  departure_date: string;
  departure_time: string;
  boat_name: string;
  route_label: string;
};

interface ViewBookingsModalProps {
  tripId: string;
  routeLabel: string;
  departureDate: string;
  departureTime: string;
  onClose: () => void;
}

function formatTime(t: string): string {
  const s = String(t).slice(0, 5);
  const [h, m] = s.split(":");
  const hh = parseInt(h ?? "0", 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m ?? "00"} ${am ? "AM" : "PM"}`;
}

function formatAmount(cents: number): string {
  return `₱${(cents / 100).toLocaleString()}`;
}

export function ViewBookingsModal({
  tripId,
  routeLabel,
  departureDate,
  departureTime,
  onClose,
}: ViewBookingsModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [showReassignFor, setShowReassignFor] = useState<string | null>(null);
  const [showRefundFor, setShowRefundFor] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState<"weather_disturbance" | "vessel_cancellation">("weather_disturbance");
  const [gcashRef, setGcashRef] = useState("");
  const [alternatives, setAlternatives] = useState<AlternativeTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/bookings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load bookings");
      setBookings(data.bookings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const openReassign = async (booking: BookingItem) => {
    setShowReassignFor(booking.id);
    setSelectedTripId("");
    try {
      const res = await fetch(
        `/api/admin/trips/${tripId}/alternatives?passenger_count=${booking.passenger_count}&is_walk_in=${booking.is_walk_in === true}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.showError(data.error ?? "Failed to load alternatives");
        setAlternatives([]);
        return;
      }
      setAlternatives(data.alternatives ?? []);
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not load alternative trips.");
      setAlternatives([]);
    }
  };

  const doReassign = async () => {
    const bid = showReassignFor;
    if (!bid || !selectedTripId) return;
    setReassigningId(bid);
    try {
      const res = await fetch(`/api/admin/bookings/${bid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: selectedTripId }),
      });
      const data = await res.json();
      if (!res.ok)       throw new Error(data.error ?? "Reassign failed");
      toast.showSuccess("Booking reassigned successfully");
      setShowReassignFor(null);
      fetchBookings();
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not reassign.");
    } finally {
      setReassigningId(null);
    }
  };

  const openRefund = (bookingId: string) => {
    setShowRefundFor(bookingId);
    setRefundReason("weather_disturbance");
    setGcashRef("");
  };

  const doRefund = async () => {
    const bookingId = showRefundFor;
    if (!bookingId) return;
    if (!confirm(`Refund ${formatAmount(bookings.find((b) => b.id === bookingId)?.total_amount_cents ?? 0)} for this booking? This cannot be undone.`))
      return;
    setRefundingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason, gcash_reference: gcashRef.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      toast.showSuccess("Refund processed successfully");
      setShowRefundFor(null);
      setRefundReason("weather_disturbance");
      setGcashRef("");
      fetchBookings();
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Could not process refund.");
    } finally {
      setRefundingId(null);
    }
  };

  const canReassign = (b: BookingItem) =>
    ["confirmed", "checked_in", "boarded", "pending_payment"].includes(b.status);
  const canRefund = (b: BookingItem) =>
    ["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(b.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-bookings-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
          <h2 id="view-bookings-title" className="text-lg font-bold text-[#134e4a]">
            Bookings — {routeLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-[#0f766e] mb-4">
            {departureDate} · {formatTime(departureTime)}
          </p>

          {loading && <p className="text-[#0f766e]">Loading…</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {!loading && !error && bookings.length === 0 && (
            <p className="text-[#0f766e]">No bookings for this trip.</p>
          )}

          {!loading && !error && bookings.length > 0 && (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-teal-200 bg-[#fef9e7]/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#134e4a]">{b.reference}</p>
                      <p className="text-sm text-[#0f766e]">
                        <strong>Passengers:</strong> {b.passenger_names.join(", ") || b.customer_full_name || "—"}
                      </p>
                      <p className="text-sm text-[#0f766e]">
                        <strong>Contact:</strong> {b.customer_email || "—"}
                        {b.customer_mobile ? ` · ${b.customer_mobile}` : ""}
                      </p>
                      <p className="text-xs text-[#0f766e]">
                        Source: {b.booking_source} · {b.passenger_count} pax · {formatAmount(b.total_amount_cents)} · {b.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canReassign(b) && (
                        <button
                          type="button"
                          onClick={() => openReassign(b)}
                          className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50"
                        >
                          Reassign
                        </button>
                      )}
                      {canRefund(b) && (
                        <button
                          type="button"
                          onClick={() => openRefund(b.id)}
                          disabled={refundingId === b.id}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {refundingId === b.id ? "Processing…" : "Refund"}
                        </button>
                      )}
                    </div>
                  </div>

                  {showRefundFor === b.id && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-xs text-amber-800 mb-2">
                        Per policy: Refunds only for weather disturbance or vessel cancellation.
                      </p>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">Reason (required):</label>
                      <select
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value as "weather_disturbance" | "vessel_cancellation")}
                        className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm mb-2"
                      >
                        <option value="weather_disturbance">Weather disturbance</option>
                        <option value="vessel_cancellation">Vessel cancellation by operator</option>
                      </select>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">
                        GCash transaction reference (for traceability):
                      </label>
                      <input
                        type="text"
                        value={gcashRef}
                        onChange={(e) => setGcashRef(e.target.value)}
                        placeholder="e.g. 1234567890"
                        className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={doRefund}
                          disabled={refundingId === b.id}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {refundingId === b.id ? "Processing…" : "Confirm refund"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowRefundFor(null); setRefundReason("weather_disturbance"); setGcashRef(""); }}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {showReassignFor === b.id && (
                    <div className="mt-3 rounded-lg border border-teal-200 bg-white p-3">
                      <p className="text-xs text-amber-700 mb-2">
                        Per policy: Reschedule only 24+ hours before departure. 10% + ₱15 fee applies.
                      </p>
                      <label className="block text-xs font-semibold text-[#134e4a] mb-1">
                        Assign to another trip (same route):
                      </label>
                      <select
                        value={selectedTripId}
                        onChange={(e) => setSelectedTripId(e.target.value)}
                        className="w-full rounded-lg border border-teal-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Select trip —</option>
                        {alternatives.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.departure_date} {formatTime(a.departure_time)} · {a.boat_name} · {a.route_label}
                          </option>
                        ))}
                      </select>
                      {alternatives.length === 0 && (
                        <p className="text-xs text-amber-700 mt-1">No alternative trips with available seats.</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={doReassign}
                          disabled={!selectedTripId || reassigningId === b.id}
                          className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a6b83] disabled:opacity-50"
                        >
                          {reassigningId === b.id ? "Reassigning…" : "Confirm reassign"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReassignFor(null)}
                          className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-[#134e4a] hover:bg-teal-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
