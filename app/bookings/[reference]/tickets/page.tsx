import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getSiteBranding } from "@/lib/site-branding";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";
import { formatTime, passengerTypeLabel } from "@/lib/dashboard/format";
import { PrintTicketsButton } from "./PrintTicketsButton";
import { TicketQRCode } from "@/components/tickets/TicketQRCode";

type PassengerForTicket = { full_name: string; fare_type: string; address: string; ticket_number?: string };

export default async function BookingTicketsPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, customer_full_name, customer_email, customer_address, passenger_count, fare_type, total_amount_cents, gcash_fee_cents, admin_fee_cents, passenger_details, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date, trip_snapshot_departure_time, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route_id, boat:boats(name), route:routes(display_name, origin, destination))"
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error || !booking) {
    notFound();
  }

  const isAdmin = user.role === "admin";
  const isOwner = (user.email ?? "").toLowerCase() === (booking.customer_email ?? "").toLowerCase().trim();
  if (!isAdmin && !isOwner) {
    notFound();
  }

  const trip = booking.trip as {
    departure_date?: string;
    departure_time?: string;
    route_id?: string;
    boat?: { name?: string } | null;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;

  const branding = await getSiteBranding();
  const today = new Date().toISOString().slice(0, 10);
  let baseFareCents = 55000;
  let discountPercent = 20;
  if (trip?.route_id) { // Need route_id for fare; use snapshot route as fallback for display only
    const { data: fareRule } = await supabase
      .from("fare_rules")
      .select("base_fare_cents, discount_percent")
      .eq("route_id", trip.route_id)
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fareRule?.base_fare_cents != null) baseFareCents = fareRule.base_fare_cents;
    if (fareRule?.discount_percent != null) discountPercent = fareRule.discount_percent;
  }

  function fareCentsPerPassenger(fareType: string): number {
    if (fareType === "adult") return baseFareCents;
    if (fareType === "infant") return 0;
    return Math.round(baseFareCents * (1 - discountPercent / 100));
  }

  const b = booking as { trip_snapshot_route_name?: string | null; trip_snapshot_vessel_name?: string | null; trip_snapshot_departure_date?: string | null; trip_snapshot_departure_time?: string | null };
  const routeName =
    trip?.route?.display_name ??
    [trip?.route?.origin, trip?.route?.destination].filter(Boolean).join(" → ") ??
    b.trip_snapshot_route_name ??
    "—";
  const boatName = trip?.boat?.name ?? b.trip_snapshot_vessel_name ?? "—";
  const depDate = trip?.departure_date ?? b.trip_snapshot_departure_date;
  const depTime = trip?.departure_time ?? b.trip_snapshot_departure_time;
  const dateLabel = depDate
    ? new Date(depDate + "Z").toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";
  const timeLabel = formatTime(depTime);

  const bookingAddress = (booking as { customer_address?: string | null }).customer_address?.trim() || "—";
  let passengers: PassengerForTicket[];
  const details = booking.passenger_details as { full_name?: string; fare_type?: string; address?: string; ticket_number?: string }[] | null;
  if (Array.isArray(details) && details.length > 0) {
    passengers = details.map((p) => ({
      full_name: p.full_name?.trim() ?? "",
      fare_type: (p.fare_type ?? "adult") as string,
      address: (p.address && p.address.trim()) ? p.address.trim() : bookingAddress,
      ticket_number: (p.ticket_number && String(p.ticket_number).trim()) ? String(p.ticket_number).trim() : undefined,
    }));
  } else {
    passengers = [
      {
        full_name: (booking.customer_full_name ?? "").trim(),
        fare_type: (booking.fare_type ?? "adult") as string,
        address: bookingAddress,
        ticket_number: undefined,
      },
    ];
  }

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="mx-auto max-w-lg print:max-w-none">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <h1 className="text-xl font-bold text-[#134e4a]">Tickets — {reference}</h1>
          <PrintTicketsButton />
        </div>
        <p className="mb-6 text-sm text-[#0f766e] print:hidden">
          One ticket per passenger. Each ticket has a unique ticket number. Use Print or Save as PDF to print at home or share.
        </p>

        {passengers.map((p, i) => {
          const ticketNumber = p.ticket_number ?? reference;
          return (
          <div
            key={i}
            className="break-after-page border-2 border-teal-200 bg-white p-6 shadow-sm print:shadow-none print:border-teal-300"
            style={{ breakAfter: "page" }}
          >
            <div className="border-b-2 border-teal-200 pb-4">
              <p className="text-2xl font-bold text-[#0c7b93]">{branding.site_name}</p>
              <p className="text-sm text-[#0f766e]">{branding.routes_text}</p>
            </div>
            <div className="mt-4 space-y-2">
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Ticket #</span>
                <span className="ml-2 font-mono text-lg font-bold text-[#134e4a]">{ticketNumber}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Booking reference</span>
                <span className="ml-2 font-mono text-sm text-[#134e4a]">{reference}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Passenger</span>
                <span className="ml-2 font-semibold text-[#134e4a]">{p.full_name || "—"}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Fare type</span>
                <span className="ml-2 text-[#134e4a]">{passengerTypeLabel(p.fare_type)}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Address</span>
                <span className="ml-2 text-[#134e4a]">{p.address || "—"}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Trip</span>
                <span className="ml-2 text-[#134e4a]">{routeName} · {boatName}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Date & time</span>
                <span className="ml-2 text-[#134e4a]">{dateLabel} · {timeLabel}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase text-[#0f766e]">Amount (this passenger)</span>
                <span className="ml-2 font-bold text-[#134e4a]">₱{(fareCentsPerPassenger(p.fare_type) / 100).toLocaleString()}</span>
              </p>
              {i === 0 && (
                <p>
                  <span className="text-xs font-semibold uppercase text-[#0f766e]">Total paid (booking)</span>
                  <span className="ml-2 font-bold text-[#134e4a]">₱{(((booking as { total_amount_cents?: number }).total_amount_cents ?? 0) / 100).toLocaleString()}</span>
                  <span className="ml-2 text-xs text-[#0f766e]">(includes admin fee ₱20/pax{((booking as { gcash_fee_cents?: number }).gcash_fee_cents ?? 0) > 0 ? ", GCash fee ₱15" : ""})</span>
                </p>
              )}
            </div>
            <TicketQRCode reference={reference} passengerIndex={i} ticketNumber={p.ticket_number} />
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <TranslatableNotices listClassName="text-xs text-amber-900 space-y-0.5 list-disc list-outside pl-5 ml-1" compact showSelector={i === 0} />
            </div>
            <p className="mt-4 text-xs text-[#0f766e]/80">
              Present this ticket at the ticket booth. Valid for the passenger named above. Bring 1 any valid identification card.
            </p>
          </div>
          );
        })}
      </div>
    </div>
  );
}
