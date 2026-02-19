import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { formatTime } from "@/lib/dashboard/format";
import { getNowManilaString } from "@/lib/admin/ph-time";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { CrewCaptainTripSelect } from "@/app/dashboard/CrewCaptainTripSelect";
import { ManifestStatusButton } from "@/components/admin/ManifestStatusButton";

type Props = {
  roleLabel: string;
  todayTrips: TodayTripForCrew[];
  currentTrip: TodayTripForCrew | null;
  selectedTripId: string | null;
  manifest: TripManifestData | null;
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

export function CrewCaptainManifestSection({
  roleLabel,
  todayTrips,
  currentTrip,
  selectedTripId,
  manifest,
}: Props) {
  const nowManila = getNowManilaString();
  const selectedTrip = todayTrips.find((t) => t.id === selectedTripId) ?? currentTrip;
  const routeLabel = selectedTrip
    ? (selectedTrip.route?.display_name ?? [selectedTrip.route?.origin, selectedTrip.route?.destination].filter(Boolean).join(" ↔ ") ?? "—")
    : "—";
  const vesselName = selectedTrip?.boat?.name ?? "—";
  const departureTime = selectedTrip ? formatTime(selectedTrip.departure_time) : "—";
  const passengerCount = manifest?.totalPassengers ?? 0;

  // Summary counts
  const checkedInCount = manifest?.passengers.filter((p) => p.status === "checked_in" || p.status === "boarded" || p.status === "completed").length ?? 0;
  const boardedCount = manifest?.passengers.filter((p) => p.status === "boarded" || p.status === "completed").length ?? 0;

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-[#0f766e]/80">
        Manifest for today&apos;s voyages. Current trip is chosen by Philippines time; use the dropdown to view another trip.
      </p>
      <p className="text-xs text-[#0f766e]/70">Philippines time: {nowManila}</p>

      {/* Cards: passenger count, departure, vessel, route */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-2 border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]/80">Passengers</p>
          <p className="mt-1 text-2xl font-bold text-[#134e4a]">{passengerCount}</p>
        </div>
        <div className="rounded-xl border-2 border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]/80">Departure</p>
          <p className="mt-1 text-2xl font-bold text-[#134e4a]">{departureTime}</p>
        </div>
        <div className="rounded-xl border-2 border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]/80">Vessel</p>
          <p className="mt-1 text-lg font-bold text-[#134e4a]">{vesselName}</p>
        </div>
        <div className="rounded-xl border-2 border-teal-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]/80">Route</p>
          <p className="mt-1 text-lg font-bold text-[#134e4a]">{routeLabel}</p>
        </div>
      </div>

      {/* Check-in / boarded summary badges */}
      {manifest && manifest.passengers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-gray-100 border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700">
            Confirmed: {manifest.passengers.filter((p) => p.status === "confirmed").length}
          </span>
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
            Checked in: {checkedInCount}
          </span>
          <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
            Boarded: {boardedCount}
          </span>
        </div>
      )}

      {/* Dropdown: today's trips for assigned vessel(s) */}
      <CrewCaptainTripSelect todayTrips={todayTrips} selectedTripId={selectedTripId} />

      {/* Manifest table */}
      <div className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm">
        <div className="border-b border-teal-200 bg-teal-50/50 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-[#134e4a]">Passenger manifest</h2>
          <p className="mt-0.5 text-sm text-[#0f766e]">
            Full name, address, contact number, source, and boarding status.
          </p>
        </div>
        <div className="overflow-x-auto">
          {manifest && manifest.passengers.length > 0 ? (
            <table className="min-w-full divide-y divide-teal-200">
              <thead>
                <tr className="bg-teal-50/30">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">#</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">Ticket #</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">Address</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">CP number</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">Source</th>
                  {/* New status column */}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e] sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {manifest.passengers.map((p) => (
                  <tr key={`${p.ticketNumber}-${p.seq}`} className="bg-white">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#134e4a] sm:px-6">{p.seq}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold text-[#134e4a] sm:px-6">{p.ticketNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#134e4a] sm:px-6">{p.passengerName}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-[#0f766e] sm:max-w-xs sm:px-6" title={p.address ?? undefined}>
                      {p.address ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#0f766e] sm:px-6">{p.contact ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#0f766e] sm:px-6">{p.source}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <ManifestStatusButton
                        reference={p.reference}
                        initialStatus={p.status}
                      />
                      {/* Show timestamps if already processed */}
                      {p.checkedInAt && (
                        <p className="mt-0.5 text-xs text-gray-400">In: {formatTimestamp(p.checkedInAt)}</p>
                      )}
                      {p.boardedAt && (
                        <p className="text-xs text-gray-400">Boarded: {formatTimestamp(p.boardedAt)}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[#0f766e] sm:px-6">
              {selectedTripId && !manifest
                ? "Loading manifest…"
                : "No passengers on this trip yet."}
            </div>
          )}
        </div>
      </div>

      {/* Scan ticket */}
      <div className="rounded-xl border-2 border-teal-200 bg-teal-50/30 p-4">
        <Link
          href={ROUTES.crewScan}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
        >
          Scan ticket (verify passenger via QR code)
        </Link>
      </div>

      {roleLabel === "Captain" && (
        <div className="rounded-xl border-2 border-teal-200 bg-teal-50/30 p-4">
          <p className="text-sm text-[#0f766e]">
            Post schedule or trip updates for passengers. They will see announcements on the Schedule and Book pages.
          </p>
          <Link
            href={ROUTES.adminVessels}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
          >
            Your vessels → Post announcements
          </Link>
        </div>
      )}
    </div>
  );
}
