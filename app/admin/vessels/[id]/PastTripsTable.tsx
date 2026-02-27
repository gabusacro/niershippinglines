"use client";

import { useState } from "react";
import { ViewBookingsModal } from "./ViewBookingsModal";
import { DeleteTripButton } from "./DeleteTripButton";
import { MarkTripPaidButton } from "./MarkTripPaidButton";

export type PastTrip = {
  id: string;
  departure_date: string;
  departure_time: string | null;
  route: { display_name?: string } | null;
  // Financial data passed from server
  passengers: number;
  grossFareCents: number;
  platformFeeCents: number;
  paymentProcessingCents: number;
  fuelCostCents: number;
  // Payment status from trip_fare_payments
  paymentStatus: "pending" | "paid" | "failed";
  paymentReference: string | null;
};

interface PastTripsTableProps {
  boatId: string;
  trips: PastTrip[];
  confirmedByTrip: Record<string, number>;
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const s = String(t).slice(0, 5);
  const [h, m] = s.split(":");
  const hh = parseInt(h ?? "0", 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m ?? "00"} ${am ? "AM" : "PM"}`;
}

function peso(cents: number) {
  if (cents === 0) return <span className="text-gray-300">—</span>;
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return <span className={cents < 0 ? "text-red-600" : ""}>{cents < 0 ? `-₱${formatted}` : `₱${formatted}`}</span>;
}

export function PastTripsTable({ boatId, trips, confirmedByTrip }: PastTripsTableProps) {
  const [viewBookingsTrip, setViewBookingsTrip] = useState<{
    id: string;
    routeLabel: string;
    departureDate: string;
    departureTime: string;
  } | null>(null);

  const totalGross = trips.reduce((s, t) => s + t.grossFareCents, 0);
  const totalPlatform = trips.reduce((s, t) => s + t.platformFeeCents, 0);
  const totalProcessing = trips.reduce((s, t) => s + t.paymentProcessingCents, 0);
  const totalPassengers = trips.reduce((s, t) => s + t.passengers, 0);
  const paidCount = trips.filter((t) => t.paymentStatus === "paid").length;
  const pendingCount = trips.filter((t) => t.paymentStatus === "pending").length;

  return (
    <>
      {/* Summary bar */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">
          {trips.length} trips · {totalPassengers} pax
        </span>
        <span className="rounded-full bg-[#134e4a]/10 px-3 py-1 font-semibold text-[#134e4a]">
          Gross: ₱{(totalGross / 100).toLocaleString()}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
          Platform fees: ₱{((totalPlatform + totalProcessing) / 100).toLocaleString()}
        </span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">
            ⏳ {pendingCount} unpaid
          </span>
        )}
        {paidCount > 0 && (
          <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
            ✓ {paidCount} paid
          </span>
        )}
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/50">
        <table className="min-w-full divide-y divide-amber-100 text-sm">
          <thead>
            <tr className="bg-amber-100/50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#134e4a]">Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#134e4a]">Time</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#134e4a]">Route</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#134e4a]">Pax</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#134e4a]">Gross Fare</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#134e4a]">Platform Fee</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#134e4a]">Processing</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#134e4a]">Net Payout</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#134e4a]">Paid?</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#134e4a]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {trips.map((t) => {
              const route = t.route as { display_name?: string } | null;
              const netPayout = t.grossFareCents - t.platformFeeCents - t.paymentProcessingCents;
              return (
                <tr key={t.id} className="hover:bg-amber-50/80 transition-colors">
                  <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">{t.departure_date}</td>
                  <td className="px-3 py-2.5 text-[#134e4a] whitespace-nowrap">{formatTime(t.departure_time)}</td>
                  <td className="px-3 py-2.5 text-[#134e4a] max-w-[140px] truncate">{route?.display_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[#134e4a]">{t.passengers > 0 ? t.passengers : <span className="text-gray-300">0</span>}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{peso(t.grossFareCents)}</td>
                  <td className="px-3 py-2.5 text-right text-[#0f766e]">{peso(t.platformFeeCents)}</td>
                  <td className="px-3 py-2.5 text-right text-[#0f766e]">{peso(t.paymentProcessingCents)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {t.grossFareCents > 0 ? peso(netPayout) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <MarkTripPaidButton
                      tripId={t.id}
                      currentStatus={t.paymentStatus}
                      currentReference={t.paymentReference}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setViewBookingsTrip({
                            id: t.id,
                            routeLabel: route?.display_name ?? "—",
                            departureDate: t.departure_date,
                            departureTime: formatTime(t.departure_time),
                          })
                        }
                        className="rounded px-2 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50"
                      >
                        View
                      </button>
                      <DeleteTripButton boatId={boatId} tripId={t.id} confirmedCount={0} isPastTrip />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals footer */}
          <tfoot>
            <tr className="bg-amber-100/70 font-semibold text-sm">
              <td colSpan={3} className="px-3 py-2.5 text-[#134e4a]">Total ({trips.length} trips)</td>
              <td className="px-3 py-2.5 text-right text-[#134e4a]">{totalPassengers}</td>
              <td className="px-3 py-2.5 text-right text-[#134e4a]">₱{(totalGross / 100).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-[#0f766e]">₱{(totalPlatform / 100).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-[#0f766e]">₱{(totalProcessing / 100).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-[#134e4a]">
                ₱{((totalGross - totalPlatform - totalProcessing) / 100).toLocaleString()}
              </td>
              <td colSpan={2} className="px-3 py-2.5 text-center text-xs text-[#0f766e]">
                {paidCount}/{trips.length} paid
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {viewBookingsTrip && (
  <ViewBookingsModal
    tripId={viewBookingsTrip.id}
    departureDate={viewBookingsTrip.departureDate}
    departureTime={viewBookingsTrip.departureTime}
    routeLabel={viewBookingsTrip.routeLabel}
    onClose={() => setViewBookingsTrip(null)}
  />
)}
    </>
  );
}
