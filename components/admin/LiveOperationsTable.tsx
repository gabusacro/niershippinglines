"use client";

import { useState } from "react";
import Link from "next/link";
import type { TripLiveRow } from "@/lib/admin/today-live-operations";

function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = (h ?? 0) < 12 ? "AM" : "PM";
  const h12 = (h ?? 0) === 0 ? 12 : (h ?? 0) > 12 ? (h ?? 0) - 12 : h ?? 0;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function fmtPeso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled:  "bg-blue-100 text-blue-700",
  departed:   "bg-amber-100 text-amber-700",
  arrived:    "bg-emerald-100 text-emerald-700",
  cancelled:  "bg-red-100 text-red-700",
  delayed:    "bg-orange-100 text-orange-700",
};

const BOOKING_STATUS_STYLES: Record<string, string> = {
  confirmed:  "bg-blue-100 text-blue-700",
  checked_in: "bg-amber-100 text-amber-700",
  boarded:    "bg-emerald-100 text-emerald-700",
  pending:    "bg-gray-100 text-gray-600",
};

export function LiveOperationsTable({ trips }: { trips: TripLiveRow[] }) {
  const [passengerModal, setPassengerModal] = useState<TripLiveRow | null>(null);
  const [refundModal, setRefundModal] = useState<TripLiveRow | null>(null);
  const [detailModal, setDetailModal] = useState<TripLiveRow | null>(null);

  // Group by vessel
  const byVessel = new Map<string, TripLiveRow[]>();
  for (const t of trips) {
    if (!byVessel.has(t.boat_id)) byVessel.set(t.boat_id, []);
    byVessel.get(t.boat_id)!.push(t);
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-teal-100 bg-white p-8 text-center">
        <p className="text-sm text-[#0f766e]">No trips scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(byVessel.entries()).map(([boatId, vesselTrips]) => {
        const vesselName = vesselTrips[0].boat_name;
        const totalRevenue = vesselTrips.reduce((s, t) => s + t.revenue_cents, 0);
        const totalPassengers = vesselTrips.reduce((s, t) => s + t.total_passengers, 0);
        const totalRefunds = vesselTrips.reduce((s, t) => s + t.refund_requests, 0);

        return (
          <div key={boatId} className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
            {/* Vessel header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50/80 border-b border-teal-100 px-5 py-3">
              <Link href={`/admin/vessels/${boatId}`}
                className="font-bold text-[#134e4a] hover:text-[#0c7b93] hover:underline transition-colors text-base flex items-center gap-2">
                🚢 {vesselName}
                <span className="text-xs font-normal text-[#0c7b93]">→ Manage trips</span>
              </Link>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-[#0f766e]">
                  <strong className="text-[#134e4a]">{totalPassengers}</strong> passengers today
                </span>
                <span className="text-[#0f766e]">
                  <strong className="text-[#134e4a]">{fmtPeso(totalRevenue)}</strong> revenue
                </span>
                {totalRefunds > 0 && (
                  <span className="text-red-600 font-semibold">
                    ⚠️ {totalRefunds} refund request{totalRefunds !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Trips table — desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-teal-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                    <th className="text-left px-5 py-3">Trip</th>
                    <th className="text-left px-5 py-3">Route</th>
                    <th className="text-left px-5 py-3">Departure</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-center px-4 py-3">Passengers</th>
                    <th className="text-center px-4 py-3">Online</th>
                    <th className="text-center px-4 py-3">Confirmed</th>
                    <th className="text-center px-4 py-3">Checked In</th>
                    <th className="text-center px-4 py-3">Boarded</th>
                    <th className="text-right px-5 py-3">Revenue</th>
                    <th className="text-center px-4 py-3">Refunds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {vesselTrips.map((trip, idx) => (
                    <tr key={trip.trip_id}
                      onClick={() => setDetailModal(trip)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors">
                      <td className="px-5 py-4 font-semibold text-[#134e4a]">
                        {trip.slot_label ?? `Trip ${idx + 1}`}
                      </td>
                      <td className="px-5 py-4 text-[#0f766e]">
                        {trip.route_origin} → {trip.route_destination}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#134e4a]">
                        {fmt12(trip.departure_time)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[trip.trip_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {trip.trip_status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPassengerModal(trip); }}
                          className={`font-bold text-base hover:underline transition-colors ${trip.total_passengers > 0 ? "text-[#0c7b93] cursor-pointer" : "text-gray-400 cursor-default"}`}
                        >
                          {trip.total_passengers}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center text-[#134e4a]">{trip.online_bookings}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block min-w-[1.5rem] text-center font-semibold ${trip.confirmed > 0 ? "text-blue-700" : "text-gray-400"}`}>
                          {trip.confirmed}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block min-w-[1.5rem] text-center font-semibold ${trip.checked_in > 0 ? "text-amber-700" : "text-gray-400"}`}>
                          {trip.checked_in}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block min-w-[1.5rem] text-center font-semibold ${trip.boarded > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                          {trip.boarded}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-[#134e4a]">
                        {trip.revenue_cents > 0 ? fmtPeso(trip.revenue_cents) : <span className="text-gray-400">₱0</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {trip.refund_requests > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRefundModal(trip); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-100 transition-colors"
                          >
                            ⚠️ {trip.refund_requests}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Trip cards — mobile */}
            <div className="md:hidden divide-y divide-teal-50">
              {vesselTrips.map((trip, idx) => (
                <div key={trip.trip_id}
                  onClick={() => setDetailModal(trip)}
                  className="p-4 hover:bg-teal-50/30 cursor-pointer transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-[#134e4a]">{trip.slot_label ?? `Trip ${idx + 1}`} · {fmt12(trip.departure_time)}</p>
                      <p className="text-xs text-[#0f766e]">{trip.route_origin} → {trip.route_destination}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[trip.trip_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {trip.trip_status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
                    {[
                      { label: "Passengers", value: trip.total_passengers, color: "text-[#0c7b93]", onClick: (e: React.MouseEvent) => { e.stopPropagation(); setPassengerModal(trip); } },
                      { label: "Confirmed", value: trip.confirmed, color: "text-blue-700" },
                      { label: "Boarded", value: trip.boarded, color: "text-emerald-700" },
                    ].map(({ label, value, color, onClick }) => (
                      <div key={label} className="rounded-lg bg-teal-50/50 p-2" onClick={onClick}>
                        <p className={`text-base font-bold ${color}`}>{value}</p>
                        <p className="text-[#0f766e]/70">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="font-semibold text-[#134e4a]">{fmtPeso(trip.revenue_cents)}</span>
                    {trip.refund_requests > 0 && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setRefundModal(trip); }}
                        className="text-red-600 font-semibold">
                        ⚠️ {trip.refund_requests} refund{trip.refund_requests !== 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Passenger List Modal */}
      {passengerModal && (
        <Modal title={`Passengers — ${passengerModal.boat_name} ${fmt12(passengerModal.departure_time)}`}
          subtitle={`${passengerModal.route_origin} → ${passengerModal.route_destination} · ${passengerModal.total_passengers} passenger${passengerModal.total_passengers !== 1 ? "s" : ""}`}
          onClose={() => setPassengerModal(null)}>
          {passengerModal.passengers.length === 0 ? (
            <p className="text-sm text-[#0f766e]/60 text-center py-4">No passengers yet.</p>
          ) : (
            <div className="space-y-2">
              {passengerModal.passengers.map((p) => (
                <div key={p.booking_id} className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-[#134e4a]">{p.passenger_name}</p>
                    <p className="text-xs text-[#0f766e] font-mono">{p.reference}</p>
                    <p className="text-xs text-[#0f766e]/60 mt-0.5">
                      {p.passenger_count} pax · {p.booking_source === "walk_in" ? "Walk-in" : "Online"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${BOOKING_STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status.replace("_", " ")}
                    </span>
                    <p className="text-xs font-semibold text-[#134e4a] mt-1">{fmtPeso(p.total_amount_cents)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Refund Requests Modal */}
      {refundModal && (
        <Modal title={`Refund Requests — ${refundModal.boat_name}`}
          subtitle={`${refundModal.route_origin} → ${refundModal.route_destination} · ${fmt12(refundModal.departure_time)}`}
          onClose={() => setRefundModal(null)}>
          {refundModal.refunds.length === 0 ? (
            <p className="text-sm text-[#0f766e]/60 text-center py-4">No refund requests.</p>
          ) : (
            <div className="space-y-2">
              {refundModal.refunds.map((r) => (
                <div key={r.refund_id} className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#134e4a]">{r.requested_by_name ?? "Unknown"}</p>
                      <p className="text-xs font-mono text-[#0f766e]">{r.booking_reference}</p>
                      {r.policy_basis && (
                        <p className="text-xs text-[#0f766e]/70 mt-0.5 capitalize">Reason: {r.policy_basis.replace("_", " ")}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-red-700">{fmtPeso(r.amount_cents)}</p>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium capitalize">
                        {r.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Link href="/admin/pending-payments"
                      className="text-xs font-semibold text-[#0c7b93] hover:underline">
                      Review in Pending Payments →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Trip Detail Modal */}
      {detailModal && (
        <Modal title={`${detailModal.slot_label ?? "Trip"} — ${detailModal.boat_name}`}
          subtitle={`${detailModal.route_origin} → ${detailModal.route_destination} · ${fmt12(detailModal.departure_time)}`}
          onClose={() => setDetailModal(null)}>
          <div className="space-y-3">
            {/* Status + trip ID */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[detailModal.trip_status] ?? "bg-gray-100 text-gray-600"}`}>
                {detailModal.trip_status}
              </span>
              <span className="text-xs text-[#0f766e]/60 font-mono">{detailModal.trip_id.slice(0, 8)}…</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total Passengers", value: detailModal.total_passengers, color: "text-[#0c7b93]" },
                { label: "Online Bookings", value: detailModal.online_bookings, color: "text-[#134e4a]" },
                { label: "Confirmed", value: detailModal.confirmed, color: "text-blue-700" },
                { label: "Checked In", value: detailModal.checked_in, color: "text-amber-700" },
                { label: "Boarded", value: detailModal.boarded, color: "text-emerald-700" },
                { label: "Refund Requests", value: detailModal.refund_requests, color: detailModal.refund_requests > 0 ? "text-red-600" : "text-gray-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-teal-50/50 border border-teal-100 px-4 py-3">
                  <p className="text-xs text-[#0f766e]">{label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Revenue */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-xs text-emerald-700">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-800 mt-0.5">{fmtPeso(detailModal.revenue_cents)}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button"
                onClick={() => { setDetailModal(null); setPassengerModal(detailModal); }}
                className="flex-1 min-h-[40px] rounded-xl border-2 border-teal-200 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
                👥 View Passengers
              </button>
              <Link href={`/admin/vessels/${detailModal.boat_id}`}
                className="flex-1 min-h-[40px] rounded-xl bg-[#0c7b93] text-white font-semibold text-sm hover:bg-[#0f766e] transition-colors flex items-center justify-center">
                Manage Trips →
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reusable Modal ───────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-teal-100 px-6 py-4 rounded-t-2xl flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#134e4a]">{title}</h2>
            {subtitle && <p className="text-xs text-[#0f766e] mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 shrink-0">×</button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
