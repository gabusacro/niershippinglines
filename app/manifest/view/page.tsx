import { createClient } from "@supabase/supabase-js";
import { getSiteBranding } from "@/lib/site-branding";
import { formatTime } from "@/lib/dashboard/format";

export const dynamic = "force-dynamic";

function formatDate(d: string): string {
  if (!d) return "-";
  try {
    return new Date(d + "Z").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d;
  }
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
  } catch {
    return "-";
  }
}

const statusLabel: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  boarded: "Boarded",
  completed: "Completed",
};

const MANIFEST_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function PublicManifestPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const tripId = searchParams.id ?? "";

  if (!tripId) {
    return (
      <div className="p-8 text-red-600">
        Error: No trip ID in URL. Use /manifest/view?id=YOUR_TRIP_ID
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: trip } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(id, name, capacity), route:routes(display_name, origin, destination)")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return <div className="p-8 text-red-600">Manifest not found for trip: {tripId}</div>;
  }

  const boat = (Array.isArray(trip.boat) ? trip.boat[0] : trip.boat) as { name: string; capacity: number } | null;
  const route = (Array.isArray(trip.route) ? trip.route[0] : trip.route) as { display_name?: string; origin?: string; destination?: string } | null;
  const capacity = boat?.capacity ?? 0;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, reference, customer_full_name, customer_mobile, customer_address, fare_type, passenger_count, passenger_details, is_walk_in, status")
    .eq("trip_id", tripId)
    .in("status", MANIFEST_STATUSES)
    .order("created_at", { ascending: true });

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const ticketsByBooking = new Map<string, { ticket_number: string; passenger_index: number; status: string; checked_in_at: string | null; boarded_at: string | null }[]>();
  if (bookingIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("ticket_number, booking_id, passenger_index, status, checked_in_at, boarded_at")
      .in("booking_id", bookingIds);
    for (const t of tickets ?? []) {
      if (!ticketsByBooking.has(t.booking_id)) ticketsByBooking.set(t.booking_id, []);
      ticketsByBooking.get(t.booking_id)!.push(t);
    }
  }

  const fareTypeLabels: Record<string, string> = { adult: "Adult", senior: "Senior", pwd: "PWD", child: "Child", infant: "Infant" };
  let seq = 0;
  const passengers: {
    seq: number; ticketNumber: string; reference: string; passengerName: string;
    fareType: string; address: string | null; contact: string | null; source: string;
    status: string; checkedInAt: string | null; boardedAt: string | null;
  }[] = [];

  for (const b of bookings ?? []) {
    const pd = (b.passenger_details ?? []) as { fare_type?: string; full_name?: string; address?: string; ticket_number?: string }[];
    const bookingFareType = b.fare_type ?? "adult";
    const bookingAddress = b.customer_address?.trim() || null;
    const bookingStatus = b.status ?? "confirmed";
    const ref = b.reference ?? "-";
    const contact = b.customer_mobile?.trim() || null;
    const source = b.is_walk_in ? "Walk-in" : "Online";
    const bookingTickets = ticketsByBooking.get(b.id) ?? [];
    const ticketByIndex = new Map(bookingTickets.map((t) => [t.passenger_index, t]));

    if (pd.length > 0) {
      for (let i = 0; i < pd.length; i++) {
        const p = pd[i]!;
        const ticket = ticketByIndex.get(i);
        seq += 1;
        passengers.push({
          seq,
          ticketNumber: ticket?.ticket_number ?? ref,
          reference: ref,
          passengerName: (p.full_name ?? "-").trim() || "-",
          fareType: fareTypeLabels[p.fare_type ?? ""] ?? (p.fare_type ?? bookingFareType),
          address: (p.address && p.address.trim()) ? p.address.trim() : bookingAddress,
          contact, source,
          status: ticket?.status ?? bookingStatus,
          checkedInAt: ticket?.checked_in_at ?? null,
          boardedAt: ticket?.boarded_at ?? null,
        });
      }
    } else {
      const ticket = ticketByIndex.get(0);
      seq += 1;
      passengers.push({
        seq,
        ticketNumber: ticket?.ticket_number ?? ref,
        reference: ref,
        passengerName: b.customer_full_name ?? "-",
        fareType: fareTypeLabels[bookingFareType] ?? bookingFareType,
        address: bookingAddress, contact, source,
        status: ticket?.status ?? bookingStatus,
        checkedInAt: ticket?.checked_in_at ?? null,
        boardedAt: ticket?.boarded_at ?? null,
      });
    }
  }

  const boardedCount = passengers.filter((p) => p.status === "boarded" || p.status === "completed").length;
  const checkedInCount = passengers.filter((p) => p.status === "checked_in").length;
  const confirmedCount = passengers.filter((p) => p.status === "confirmed").length;
  const totalPassengers = passengers.length;

  const branding = await getSiteBranding();

  return (
    <div className="min-h-screen bg-white text-black p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="border-b-2 border-black pb-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-gray-600">Republic of the Philippines</p>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">PASSENGER MANIFEST</h1>
        <p className="text-sm text-gray-700 mt-0.5">For Philippine Coast Guard - Pre-Departure Clearance</p>
        <p className="text-xs text-gray-500 mt-1">Generated by {branding.site_name} booking system - Live data</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div><span className="font-semibold">Vessel:</span> {boat?.name ?? "-"}</div>
        <div><span className="font-semibold">Route:</span> {route?.display_name ?? "-"}</div>
        <div><span className="font-semibold">Origin:</span> {route?.origin ?? "-"}</div>
        <div><span className="font-semibold">Destination:</span> {route?.destination ?? "-"}</div>
        <div><span className="font-semibold">Date of departure:</span> {formatDate(trip.departure_date ?? "")}</div>
        <div><span className="font-semibold">Time of departure:</span> {formatTime(trip.departure_time ?? "")}</div>
        <div><span className="font-semibold">Total passengers:</span> {totalPassengers}</div>
        <div><span className="font-semibold">Vessel capacity:</span> {capacity}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-sm">
        <div><span className="font-semibold">Confirmed (not yet checked in):</span> {confirmedCount}</div>
        <div><span className="font-semibold">Checked in (at pier):</span> {checkedInCount}</div>
        <div><span className="font-semibold">Actually boarded:</span> <span className="font-bold">{boardedCount}</span></div>
      </div>

      <div className="overflow-x-auto">
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
              <th className="border border-gray-800 px-2 py-1.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {passengers.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-gray-800 px-2 py-3 text-center text-gray-600">No passengers on manifest</td>
              </tr>
            ) : (
              passengers.map((p) => (
                <tr key={`${p.ticketNumber}-${p.seq}`}>
                  <td className="border border-gray-800 px-2 py-1">{p.seq}</td>
                  <td className="border border-gray-800 px-2 py-1 font-mono font-semibold">{p.ticketNumber}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.reference}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.passengerName}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.fareType}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.address ?? "-"}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.contact ?? "-"}</td>
                  <td className="border border-gray-800 px-2 py-1">{p.source}</td>
                  <td className="border border-gray-800 px-2 py-1 min-w-[120px]">
                    <div className="font-semibold text-xs">{statusLabel[p.status] ?? p.status}</div>
                    {p.checkedInAt && <div className="text-xs text-gray-600">In: {formatTimestamp(p.checkedInAt)}</div>}
                    {p.boardedAt && <div className="text-xs font-semibold text-black">Boarded: {formatTimestamp(p.boardedAt)}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-600">
        Source: Online = booked on website; Walk-in = sold at ticket booth.
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Status: Confirmed = booked but not yet at pier; Checked in = arrived at pier; Boarded = confirmed on vessel. Times are Philippines Standard Time (PST).
      </p>
      <p className="mt-4 text-xs text-gray-400 text-center">
        This is a live public manifest link. Data updates in real time. - {branding.site_name}
      </p>
    </div>
  );
}
