"use client";

import { QRCodeSVG } from "qrcode.react";

import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { formatTime } from "@/lib/dashboard/format";

interface ManifestDocumentProps {
  data: TripManifestData;
  manifestUrl: string;
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

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
    });
  } catch {
    return "—";
  }
}

function generateSerialNumber(tripId: string, date: string): string {
  const datePart = date.replace(/-/g, "").slice(0, 8);
  const idPart = tripId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `MAN-${datePart}-${idPart}`;
}

const statusLabel: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  boarded: "Boarded",
  completed: "Completed",
};

export function ManifestDocument({ data, manifestUrl, appName }: ManifestDocumentProps) {
  const hasWalkInNoNames = data.walkInNoNames > 0;
  const boardedCount = data.passengers.filter((p) => p.status === "boarded" || p.status === "completed").length;
  // Checked in at pier = arrived at pier (includes those who went on to board)
  const checkedInAtPierCount = data.passengers.filter((p) => p.status === "checked_in" || p.status === "boarded" || p.status === "completed").length;
  // Confirmed only = booked but NOT yet at pier at all
  const confirmedOnlyCount = data.passengers.filter((p) => p.status === "confirmed").length;
  const serialNumber = generateSerialNumber(data.tripId, data.departureDate);

  const captainDisplay = data.captainNames.length === 0
    ? "—"
    : data.captainNames.length === 1
    ? data.captainNames[0]
    : `⚠️ Multiple captains: ${data.captainNames.join(", ")}`;

  const crewDisplay = data.crewNames.length === 0
    ? "None assigned"
    : data.crewNames.join(", ");

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <div id="manifest-document" className="manifest-print bg-white text-black p-4 max-w-[1100px] mx-auto text-xs">

        {/* Header */}
        <div className="border-b-2 border-black pb-3 mb-3 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600">Republic of the Philippines</p>
            <h1 className="text-lg font-bold mt-0.5">PASSENGER MANIFEST</h1>
            <p className="text-[11px] text-gray-700">For Philippine Coast Guard — Pre-Departure Clearance</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Document Reference No.</p>
            <p className="font-mono font-bold text-sm">{serialNumber}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              Generated: {new Date().toLocaleDateString("en-PH", {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Trip & vessel details */}
        <div className="grid grid-cols-4 gap-x-6 gap-y-1 mb-2 text-[11px]">
          <div><span className="font-semibold">Vessel:</span> {data.vesselName}</div>
          <div><span className="font-semibold">MARINA Reg. No.:</span> {data.marinaNumber ?? "—"}</div>
          <div><span className="font-semibold">Route:</span> {data.routeName}</div>
          <div><span className="font-semibold">Date of Departure:</span> {formatDate(data.departureDate)}</div>
          <div><span className="font-semibold">Origin:</span> {data.origin}</div>
          <div><span className="font-semibold">Destination:</span> {data.destination}</div>
          <div><span className="font-semibold">Time of Departure:</span> {formatTime(data.departureTime)}</div>
          <div><span className="font-semibold">Vessel Capacity:</span> {data.capacity}</div>

          {/* Captain — spans 2 cols, warns if multiple */}
          <div className={`col-span-2 ${data.captainNames.length > 1 ? "text-red-600 font-semibold" : ""}`}>
            <span className="font-semibold">Master/Captain:</span> {captainDisplay}
          </div>

          {/* Crew */}
          <div className="col-span-2">
            <span className="font-semibold">Crew ({data.crewNames.length}):</span> {crewDisplay}
          </div>

          {/* Passenger counts */}
          <div><span className="font-semibold">Total Passengers:</span> <strong>{data.totalPassengers}</strong></div>
          <div><span className="font-semibold">Actually Boarded:</span> <strong>{boardedCount}</strong></div>
          <div><span className="font-semibold">Checked In at Pier (incl. boarded):</span> {checkedInAtPierCount}</div>
          <div><span className="font-semibold">Not Yet at Pier:</span> {confirmedOnlyCount}</div>
        </div>

        {/* Warning banner if multiple captains */}
        {data.captainNames.length > 1 && (
          <div className="mb-2 rounded border border-red-400 bg-red-50 px-3 py-1.5 text-[10px] text-red-700 print-hidden">
            ⚠️ <strong>Multiple captains detected on this vessel:</strong> {data.captainNames.join(", ")}. Please go to Supabase → boat_assignments and remove the extra captain assignment.
          </div>
        )}

        {/* Passenger table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">No.</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Ticket #</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Passenger Name</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Type</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Gender</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Age</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Nationality</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Address</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Contact</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Source</th>
                <th className="border border-gray-800 px-1.5 py-1 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.passengers.length === 0 && !hasWalkInNoNames ? (
                <tr>
                  <td colSpan={11} className="border border-gray-800 px-2 py-3 text-center text-gray-500">
                    No passengers on manifest
                  </td>
                </tr>
              ) : (
                data.passengers.map((p) => (
                  <tr key={`${p.ticketNumber}-${p.seq}`} className={p.seq % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.seq}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5 font-mono font-semibold">{p.ticketNumber}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.passengerName}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.fareType}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.gender ?? "—"}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.age ?? "—"}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.nationality ?? "—"}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.address ?? "—"}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.contact ?? "—"}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">{p.source}</td>
                    <td className="border border-gray-800 px-1.5 py-0.5">
                      <div className="font-semibold">{statusLabel[p.status] ?? p.status}</div>
                      {p.checkedInAt && <div className="text-gray-600">In: {formatTimestamp(p.checkedInAt)}</div>}
                      {p.boardedAt && <div className="font-semibold">✓ {formatTimestamp(p.boardedAt)}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasWalkInNoNames && (
          <p className="mt-2 text-[10px] text-gray-700">
            <span className="font-semibold">Walk-in (count only):</span> {data.walkInNoNames} passenger{data.walkInNoNames !== 1 ? "s" : ""} sold at pier, not listed by name.
            Total: {data.totalListed} listed + {data.walkInNoNames} = <strong>{data.totalPassengers} total</strong>.
          </p>
        )}

        <p className="mt-1 text-[9px] text-gray-500">
          Source: Online = booked on website; Walk-in = sold at ticket booth.
          Status: Confirmed = not yet at pier; Checked in = at pier; Boarded = on vessel. Times are PST.
        </p>

        {/* Signature section */}
        <div className="mt-5 grid grid-cols-3 gap-8 border-t border-gray-400 pt-4">
          <div>
            <p className="text-[10px] text-gray-500 mb-5">Master / Captain of Vessel</p>
            <div className="border-b border-black mb-1 h-8"></div>
            <p className="font-semibold text-[11px]">
              {data.captainNames.length === 1 ? data.captainNames[0] : "___________________________"}
            </p>
            <p className="text-[10px] text-gray-600">Signature over Printed Name</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-5">Prepared by (Ticket Booth / Admin)</p>
            <div className="border-b border-black mb-1 h-8"></div>
            <p className="text-[10px] text-gray-600">Signature over Printed Name</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-5">Received by (Philippine Coast Guard)</p>
            <div className="border-b border-black mb-1 h-8"></div>
            <p className="text-[10px] text-gray-600">Signature over Printed Name / Date & Time</p>
          </div>
        </div>

        {/* Verification footer with QR — protected URL requires login */}
        <div className="mt-3 border-t border-gray-200 pt-3 flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[9px] text-gray-500 font-semibold mb-0.5">TO VERIFY AUTHENTICITY:</p>
            <p className="text-[9px] text-gray-500">
              Scan the QR code or visit the URL below. Access requires login as admin, captain, crew, or ticket booth.
              Strangers who scan this QR will be redirected to the login page — passenger data is protected.
            </p>
            <p className="text-[9px] text-gray-400 mt-1">
              Generated from {appName} booking system · For Philippine Coast Guard Pre-Departure Clearance only.
            </p>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <QRCodeSVG value={manifestUrl} size={72} level="M" />
            <p className="text-[8px] text-gray-400 mt-0.5">Scan to Verify</p>
          </div>
        </div>
      </div>
    </>
  );
}
