import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { getSiteBranding } from "@/lib/site-branding";
import { getTripManifestData } from "@/lib/admin/trip-manifest";
import { formatTime } from "@/lib/dashboard/format";
import { ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "captain", "crew", "ticket_booth"];

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
    });
  } catch { return "—"; }
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

type SearchParams = Promise<Record<string, string>> | Record<string, string>;

export default async function ProtectedManifestViewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 🔒 Auth check — only allowed roles can view
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (!ALLOWED_ROLES.includes(user.role ?? "")) redirect(ROUTES.dashboard);

  const resolved = searchParams instanceof Promise ? await searchParams : searchParams;
  const tripId = resolved.id ?? "";

  if (!tripId) {
    return <div className="p-8 text-red-600">Error: No trip ID in URL. Use /manifest/view?id=YOUR_TRIP_ID</div>;
  }

  // Reuse the same manifest data fetcher (already secure, uses session client)
  const data = await getTripManifestData(tripId);
  if (!data) {
    return <div className="p-8 text-red-600">Manifest not found for trip: {tripId}</div>;
  }

  const branding = await getSiteBranding();
  const serialNumber = generateSerialNumber(data.tripId, data.departureDate);

  const boardedCount = data.passengers.filter((p) => p.status === "boarded" || p.status === "completed").length;
  const checkedInAtPierCount = data.passengers.filter((p) => ["checked_in", "boarded", "completed"].includes(p.status)).length;
  const confirmedOnlyCount = data.passengers.filter((p) => p.status === "confirmed").length;

  const captainDisplay = data.captainNames.length === 0
    ? "—"
    : data.captainNames.length === 1
    ? data.captainNames[0]
    : `⚠️ Multiple: ${data.captainNames.join(", ")}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auth badge — only visible on screen, hidden on print */}
      <div className="print:hidden bg-teal-700 text-white text-xs px-4 py-2 flex items-center justify-between">
        <span>🔒 Secure manifest view — visible to authorized personnel only</span>
        <span>Logged in as: <strong>{user.role}</strong></span>
      </div>

      <div className="min-h-screen bg-white text-black p-6 sm:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-600">Republic of the Philippines</p>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">PASSENGER MANIFEST</h1>
            <p className="text-sm text-gray-700 mt-0.5">For Philippine Coast Guard — Pre-Departure Clearance</p>
            <p className="text-xs text-gray-500 mt-1">Live data · {branding.site_name} Booking System</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Document Reference No.</p>
            <p className="font-mono font-bold">{serialNumber}</p>
          </div>
        </div>

        {/* Trip details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
          <div><span className="font-semibold">Vessel:</span> {data.vesselName}</div>
          <div><span className="font-semibold">MARINA Reg. No.:</span> {data.marinaNumber ?? "—"}</div>
          <div><span className="font-semibold">Route:</span> {data.routeName}</div>
          <div><span className="font-semibold">Date of Departure:</span> {formatDate(data.departureDate)}</div>
          <div><span className="font-semibold">Origin:</span> {data.origin}</div>
          <div><span className="font-semibold">Destination:</span> {data.destination}</div>
          <div><span className="font-semibold">Time of Departure:</span> {formatTime(data.departureTime)}</div>
          <div><span className="font-semibold">Vessel Capacity:</span> {data.capacity}</div>
          <div className={data.captainNames.length > 1 ? "text-red-600 font-semibold" : ""}>
            <span className="font-semibold">Master/Captain:</span> {captainDisplay}
          </div>
          <div>
            <span className="font-semibold">Crew ({data.crewNames.length}):</span>{" "}
            {data.crewNames.length === 0 ? "None assigned" : data.crewNames.join(", ")}
          </div>
        </div>

        {/* Boarding summary */}
        <div className="mb-4 flex flex-wrap gap-4 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-sm">
          <div><span className="font-semibold">Total Passengers:</span> <strong>{data.totalPassengers}</strong></div>
          <div><span className="font-semibold">Actually Boarded:</span> <strong>{boardedCount}</strong></div>
          <div><span className="font-semibold">Checked In at Pier:</span> {checkedInAtPierCount}</div>
          <div><span className="font-semibold">Not Yet at Pier:</span> {confirmedOnlyCount}</div>
        </div>

        {/* Multiple captains warning */}
        {data.captainNames.length > 1 && (
          <div className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-700">
            ⚠️ <strong>Multiple captains on this vessel:</strong> {data.captainNames.join(", ")} — please fix in Supabase → boat_assignments.
          </div>
        )}

        {/* Passenger table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-800 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">No.</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Ticket #</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Passenger Name</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Gender</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Age</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Nationality</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Address</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Contact</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Source</th>
                <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.passengers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="border border-gray-800 px-2 py-3 text-center text-gray-600">No passengers on manifest</td>
                </tr>
              ) : (
                data.passengers.map((p) => (
                  <tr key={`${p.ticketNumber}-${p.seq}`} className={p.seq % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="border border-gray-800 px-2 py-1">{p.seq}</td>
                    <td className="border border-gray-800 px-2 py-1 font-mono font-semibold">{p.ticketNumber}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.passengerName}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.fareType}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.gender ?? "—"}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.age ?? "—"}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.nationality ?? "—"}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.address ?? "—"}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.contact ?? "—"}</td>
                    <td className="border border-gray-800 px-2 py-1">{p.source}</td>
                    <td className="border border-gray-800 px-2 py-1 min-w-[120px]">
                      <div className="font-semibold text-xs">{statusLabel[p.status] ?? p.status}</div>
                      {p.checkedInAt && <div className="text-xs text-gray-600">In: {formatTimestamp(p.checkedInAt)}</div>}
                      {p.boardedAt && <div className="text-xs font-semibold">✓ Boarded: {formatTimestamp(p.boardedAt)}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Source: Online = booked on website; Walk-in = sold at ticket booth.
          Status: Confirmed = not yet at pier; Checked in = at pier; Boarded = on vessel. Times are PST.
        </p>
        <p className="mt-3 text-xs text-gray-400 text-center">
          🔒 Confidential — For authorized personnel only · {branding.site_name}
        </p>
      </div>
    </div>
  );
}
