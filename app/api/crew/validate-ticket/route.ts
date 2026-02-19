import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: Validate ticket from QR scan. Crew/ticket_booth/admin only.
 *  Payload: NIER:ticketNumber (unique per passenger) or legacy NIER:reference:passengerIndex */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(role ?? "");
  if (!allowed) return NextResponse.json({ error: "Forbidden: crew access required" }, { status: 403 });

  const payload = request.nextUrl.searchParams.get("payload") ?? "";
  if (!payload.startsWith("NIER:")) {
    return NextResponse.json({ error: "Invalid QR format. Scan a valid ticket." }, { status: 400 });
  }
  const afterNier = payload.slice(5).trim();
  let booking: {
    id: string;
    reference: string | null;
    status: string | null;
    customer_full_name: string | null;
    passenger_details: unknown;
    trip: unknown;
  } | null = null;
  let passengerIndex: number;

  const legacyMatch = afterNier.match(/^([A-Z0-9]+):(\d+)$/i);
  if (legacyMatch) {
    const [, ref, idxStr] = legacyMatch;
    passengerIndex = parseInt(idxStr ?? "0", 10);
    const { data: b, error } = await supabase
      .from("bookings")
      .select("id, reference, status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
      .eq("reference", ref!.toUpperCase())
      .maybeSingle();
    if (error || !b) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    booking = b;
    const details = (booking.passenger_details ?? []) as { full_name?: string }[];
    const passengers = details.length > 0 ? details : [{ full_name: booking.customer_full_name ?? "" }];
    if (!passengers[passengerIndex]) {
      return NextResponse.json({ error: "Invalid passenger index" }, { status: 400 });
    }
  } else {
    const ticketNumber = afterNier;
    if (!ticketNumber) {
      return NextResponse.json({ error: "Invalid QR format. Scan a valid ticket." }, { status: 400 });
    }
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("booking_id, passenger_index")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();
    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    passengerIndex = ticket.passenger_index;
    const { data: b, error: bookError } = await supabase
      .from("bookings")
      .select("id, reference, status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
      .eq("id", ticket.booking_id)
      .single();
    if (bookError || !b) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    booking = b;
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const validStatuses = ["confirmed", "checked_in", "boarded", "completed"];
  if (!validStatuses.includes(booking.status ?? "")) {
    return NextResponse.json({
      error: `Ticket status: ${booking.status}. Not valid for boarding.`,
      booking: { reference: booking.reference, status: booking.status },
    }, { status: 400 });
  }

  const details = (booking.passenger_details ?? []) as { full_name?: string }[];
  const passengers = details.length > 0 ? details : [{ full_name: booking.customer_full_name ?? "" }];
  const passenger = passengers[passengerIndex];
  if (!passenger) {
    return NextResponse.json({ error: "Invalid passenger index" }, { status: 400 });
  }

  const trip = booking.trip as { departure_date?: string; departure_time?: string; boat?: { name?: string } | null; route?: { display_name?: string } | null } | null;

  return NextResponse.json({
    valid: true,
    reference: booking.reference ?? "—",
    ticket_number: afterNier.match(/^([A-Z0-9]+):(\d+)$/i) ? undefined : afterNier,
    passenger_index: passengerIndex,
    passenger_name: passenger.full_name ?? "",
    status: booking.status,
    trip: trip ? {
      date: trip.departure_date,
      time: trip.departure_time,
      vessel: trip.boat?.name ?? "—",
      route: trip.route?.display_name ?? "—",
    } : null,
  });
}