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
    refund_status: string | null;
    customer_full_name: string | null;
    passenger_details: unknown;
    trip: unknown;
  } | null = null;
  let passengerIndex: number;
  let ticketStatus: string | null = null;
  let resolvedTicketNumber: string | undefined;

  const legacyMatch = afterNier.match(/^([A-Z0-9]+):(\d+)$/i);

  if (legacyMatch) {
    // ── Legacy QR: NIER:REFERENCE:INDEX ──────────────────────────────────
    const [, ref, idxStr] = legacyMatch;
    passengerIndex = parseInt(idxStr ?? "0", 10);

    const { data: b, error } = await supabase
      .from("bookings")
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
      .eq("reference", ref!.toUpperCase())
      .maybeSingle();

    if (error || !b) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    booking = b;

    const { data: legacyTicket } = await supabase
      .from("tickets")
      .select("ticket_number, status")
      .eq("booking_id", b.id)
      .eq("passenger_index", passengerIndex)
      .maybeSingle();

    ticketStatus = legacyTicket?.status ?? booking.status;
    resolvedTicketNumber = legacyTicket?.ticket_number ?? undefined;

  } else {
    // ── New QR: NIER:TICKETNUMBER ─────────────────────────────────────────
    const ticketNumber = afterNier;
    if (!ticketNumber) {
      return NextResponse.json({ error: "Invalid QR format. Scan a valid ticket." }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("ticket_number, booking_id, passenger_index, status")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    passengerIndex = ticket.passenger_index;
    ticketStatus = ticket.status;
    resolvedTicketNumber = ticket.ticket_number;

    const { data: b, error: bookError } = await supabase
      .from("bookings")
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
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

  // ⭐ Fetch refund details (admin_notes) from refunds table if there's an active refund
  let refundNote: string | null = null;
  let refundGcashReference: string | null = null;
  const activeRefundStatuses = ["pending", "under_review", "approved", "processed"];
  if (booking.refund_status && activeRefundStatuses.includes(booking.refund_status)) {
    const { data: refundRow } = await supabase
      .from("refunds")
      .select("admin_notes, gcash_reference, status")
      .eq("booking_id", booking.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    refundNote = refundRow?.admin_notes ?? null;
    refundGcashReference = refundRow?.gcash_reference ?? null;
  }

  // ⭐ Block refunded bookings — return early with full refund info for scanner display
  if (booking.status === "refunded" || booking.refund_status === "processed") {
    return NextResponse.json({
      valid: false,
      refunded: true,
      reference: booking.reference ?? "—",
      ticket_number: resolvedTicketNumber,
      passenger_name: (() => {
        const details = (booking.passenger_details ?? []) as { full_name?: string }[];
        const passengers = details.length > 0 ? details : [{ full_name: booking.customer_full_name ?? "" }];
        return passengers[passengerIndex]?.full_name ?? "";
      })(),
      refund_status: booking.refund_status,
      refund_note: refundNote,
      refund_gcash_reference: refundGcashReference,
      status: booking.status,
    }, { status: 400 });
  }

  // ⭐ Block bookings with active refund requests (pending/under_review/approved)
  if (booking.refund_status && ["pending", "under_review", "approved"].includes(booking.refund_status)) {
    return NextResponse.json({
      valid: false,
      refund_blocked: true,
      reference: booking.reference ?? "—",
      ticket_number: resolvedTicketNumber,
      passenger_name: (() => {
        const details = (booking.passenger_details ?? []) as { full_name?: string }[];
        const passengers = details.length > 0 ? details : [{ full_name: booking.customer_full_name ?? "" }];
        return passengers[passengerIndex]?.full_name ?? "";
      })(),
      refund_status: booking.refund_status,
      refund_note: refundNote,
      status: booking.status,
    }, { status: 400 });
  }

  const validStatuses = ["confirmed", "checked_in", "boarded", "completed"];
  if (!validStatuses.includes(ticketStatus ?? "")) {
    return NextResponse.json({
      error: `Ticket status: ${ticketStatus}. Not valid for boarding.`,
      booking: { reference: booking.reference, status: ticketStatus },
    }, { status: 400 });
  }

  const details = (booking.passenger_details ?? []) as { full_name?: string }[];
  const passengers = details.length > 0 ? details : [{ full_name: booking.customer_full_name ?? "" }];
  const passenger = passengers[passengerIndex];
  if (!passenger) {
    return NextResponse.json({ error: "Invalid passenger index" }, { status: 400 });
  }

  const trip = booking.trip as {
    departure_date?: string;
    departure_time?: string;
    boat?: { name?: string } | null;
    route?: { display_name?: string } | null;
  } | null;

  return NextResponse.json({
    valid: true,
    reference: booking.reference ?? "—",
    ticket_number: resolvedTicketNumber,
    passenger_index: passengerIndex,
    passenger_name: passenger.full_name ?? "",
    status: ticketStatus,
    trip: trip ? {
      date: trip.departure_date,
      time: trip.departure_time,
      vessel: trip.boat?.name ?? "—",
      route: trip.route?.display_name ?? "—",
    } : null,
  });
}
