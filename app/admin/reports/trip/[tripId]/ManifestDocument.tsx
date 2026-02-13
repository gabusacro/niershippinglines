"use client";

import { QRCodeSVG } from "qrcode.react";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { formatTime } from "@/lib/dashboard/format";

interface ManifestDocumentProps {
  data: TripManifestData;
  manifestUrl: string;
  /** App/shipping line name (e.g. from constants) so rebranding updates automatically. */
  appName: string;
}

function formatDate(d: string): string {
  if (!d || d === "—") return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d;
  }
}

export function ManifestDocument({ data, manifestUrl, appName }: ManifestDocumentProps) {
  const hasWalkInNoNames = data.walkInNoNames > 0;

  return (
    <div id="manifest-document" className="manifest-print bg-white text-black p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="border-b-2 border-black pb-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-gray-600">Republic of the Philippines</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">PASSENGER MANIFEST</h1>
        <p className="text-sm text-gray-700 mt-0.5">For Philippine Coast Guard — Pre-Departure Clearance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm">
        <div><span className="font-semibold">Vessel:</span> {data.vesselName}</div>
        <div><span className="font-semibold">Route:</span> {data.routeName}</div>
        <div><span className="font-semibold">Origin:</span> {data.origin}</div>
        <div><span className="font-semibold">Destination:</span> {data.destination}</div>
        <div><span className="font-semibold">Date of departure:</span> {formatDate(data.departureDate)}</div>
        <div><span className="font-semibold">Time of departure:</span> {formatTime(data.departureTime)}</div>
        <div><span className="font-semibold">Total passengers:</span> {data.totalPassengers}</div>
        <div><span className="font-semibold">Vessel capacity:</span> {data.capacity}</div>
      </div>

      <table className="w-full border-collapse border border-gray-800 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">No.</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Ticket #</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Booking ref.</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Passenger name</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Type</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Address</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Contact</th>
            <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Source</th>
          </tr>
        </thead>
        <tbody>
          {data.passengers.length === 0 && !hasWalkInNoNames ? (
            <tr>
              <td colSpan={8} className="border border-gray-800 px-2 py-3 text-center text-gray-600">No passengers on manifest</td>
            </tr>
          ) : (
            data.passengers.map((p) => (
              <tr key={`${p.ticketNumber}-${p.seq}`}>
                <td className="border border-gray-800 px-2 py-1">{p.seq}</td>
                <td className="border border-gray-800 px-2 py-1 font-mono font-semibold">{p.ticketNumber}</td>
                <td className="border border-gray-800 px-2 py-1">{p.reference}</td>
                <td className="border border-gray-800 px-2 py-1">{p.passengerName}</td>
                <td className="border border-gray-800 px-2 py-1">{p.fareType}</td>
                <td className="border border-gray-800 px-2 py-1">{p.address ?? "—"}</td>
                <td className="border border-gray-800 px-2 py-1">{p.contact ?? "—"}</td>
                <td className="border border-gray-800 px-2 py-1">{p.source}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {hasWalkInNoNames && (
        <p className="mt-4 text-sm text-gray-700">
          <span className="font-semibold">Walk-in (count only):</span> {data.walkInNoNames} passenger{data.walkInNoNames !== 1 ? "s" : ""} sold at the pier but not listed by name above. Total: {data.totalListed} listed above + {data.walkInNoNames} = <strong>{data.totalPassengers} total passengers</strong>.
        </p>
      )}

      <p className="mt-2 text-xs text-gray-600">Source: Online = booked on website; Walk-in = sold at ticket booth (names entered in system when recorded).</p>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">Scan to verify this manifest</p>
          <QRCodeSVG value={manifestUrl} size={80} level="M" />
        </div>
        <p className="text-xs text-gray-500 max-w-xs">Electronic copy. Generated from {appName} booking system. For Philippine Coast Guard clearance.</p>
      </div>
    </div>
  );
}
