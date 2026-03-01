import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: Validate ticket from QR scan. Crew/ticket_booth/admin only.
 *  Payload: NIER:ticketNumber or legacy NIER:reference:passengerIndex */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
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
  let passengerIndex: number = 0;
  let ticketStatus: string | null = null;
  let resolvedTicketNumber: string | undefined;

  const legacyMatch = afterNier.match(/^([A-Z0-9]+):(\d+)$/i);

  if (legacyMatch) {
    // Legacy QR: NIER:REFERENCE:INDEX
    const [, ref, idxStr] = legacyMatch;
    passengerIndex = parseInt(idxStr ?? "0", 10);

    const { data: b, error } = await supabase
      .from("bookings")
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
      .eq("reference", ref!.toUpperCase())
      .maybeSingle();

    if (error || !b) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    booking = b;

    const { data: legacyTicket } = await supabase
      .from("tickets").select("ticket_number, status")
      .eq("booking_id", b.id).eq("passenger_index", passengerIndex).maybeSingle();

    ticketStatus = legacyTicket?.status ?? booking.status;
    resolvedTicketNumber = legacyTicket?.ticket_number ?? undefined;

  } else {
    // New QR: NIER:TICKETNUMBER
    const ticketNumber = afterNier;
    if (!ticketNumber) {
      return NextResponse.json({ error: "Invalid QR format. Scan a valid ticket." }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets").select("ticket_number, booking_id, passenger_index, status")
      .eq("ticket_number", ticketNumber).maybeSingle();

    if (ticketError || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    passengerIndex = ticket.passenger_index;
    ticketStatus = ticket.status;
    resolvedTicketNumber = ticket.ticket_number;

    const { data: b, error: bookError } = await supabase
      .from("bookings")
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
      .eq("id", ticket.booking_id).single();

    if (bookError || !b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    booking = b;
  }

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Parse passenger details
  const passengers = Array.isArray(booking.passenger_details)
    ? booking.passenger_details as { full_name?: string; fare_type?: string; birthdate?: string; gender?: string; nationality?: string }[]
    : [{ full_name: booking.customer_full_name ?? "" }];

  const passenger = passengers[passengerIndex];
  if (!passenger) return NextResponse.json({ error: "Invalid passenger index" }, { status: 400 });

  const trip = booking.trip as {
    departure_date?: string;
    departure_time?: string;
    boat?: { name?: string };
    route?: { display_name?: string };
  } | null;

  // Check refund status
  const refunded = booking.refund_status === "processed";
  const refundBlocked = ["pending","under_review","approved"].includes(booking.refund_status ?? "");

  // ── Fetch discount ID verification for this passenger ──────────────────────
  const fareType = (passenger as { fare_type?: string }).fare_type ?? "adult";
  const needsId = ["senior","pwd","student","child"].includes(fareType);

  let idVerification: {
    id: string;
    discount_type: string;
    verification_status: string;
    id_image_url: string | null;
    expires_at: string | null;
    uploaded_at: string | null;
    admin_note: string | null;
    passenger_name: string | null;
  } | null = null;

  if (needsId) {
    // Look up by booking_id + passenger_index, get most recent verified first, else latest pending
    const { data: idRows } = await supabase
      .from("passenger_id_verifications")
      .select("id, discount_type, verification_status, id_image_url, expires_at, uploaded_at, admin_note, passenger_name")
      .eq("booking_id", booking.id)
      .eq("passenger_index", passengerIndex)
      .order("uploaded_at", { ascending: false });

    if (idRows && idRows.length > 0) {
      // Prefer verified > pending > rejected
      const verified  = idRows.find(r => r.verification_status === "verified");
      const pending   = idRows.find(r => r.verification_status === "pending");
      idVerification  = verified ?? pending ?? idRows[0] ?? null;
    }

    // Also try by profile_id if not found by booking (reused ID from another booking)
    if (!idVerification) {
      // Find profile linked to this booking via uploaded_by
      const { data: anyId } = await supabase
        .from("passenger_id_verifications")
        .select("id, discount_type, verification_status, id_image_url, expires_at, uploaded_at, admin_note, passenger_name")
        .eq("discount_type", fareType)
        .eq("verification_status", "verified")
        .not("profile_id", "is", null)
        .order("uploaded_at", { ascending: false })
        .limit(1);

      // Only use if name matches
      const match = anyId?.find(r =>
        r.passenger_name?.toLowerCase().trim() === (passenger.full_name ?? "").toLowerCase().trim()
      );
      if (match) idVerification = match;
    }
  }

  // Refresh signed URL if needed (URLs expire)
  // We return the stored URL — admin should regenerate via storage if expired

  return NextResponse.json({
    valid: !refunded && !refundBlocked,
    refunded,
    refund_blocked: refundBlocked,
    reference: booking.reference,
    ticket_number: resolvedTicketNumber,
    passenger_index: passengerIndex,
    passenger_name: passenger.full_name ?? "",
    fare_type: fareType,
    status: ticketStatus ?? booking.status,
    refund_status: booking.refund_status,
    // Passenger detail fields
    passenger_gender: (passenger as { gender?: string }).gender ?? null,
    passenger_birthdate: (passenger as { birthdate?: string }).birthdate ?? null,
    passenger_nationality: (passenger as { nationality?: string }).nationality ?? null,
    trip: trip ? {
      date: trip.departure_date,
      time: trip.departure_time,
      vessel: trip.boat?.name ?? "—",
      route: trip.route?.display_name ?? "—",
    } : null,
    // ID verification info
    id_required: needsId,
    id_verification: idVerification ? {
      id: idVerification.id,
      discount_type: idVerification.discount_type,
      status: idVerification.verification_status,
      image_url: idVerification.id_image_url,
      expires_at: idVerification.expires_at,
      uploaded_at: idVerification.uploaded_at,
      admin_note: idVerification.admin_note,
      is_expired: idVerification.expires_at ? new Date(idVerification.expires_at) < new Date() : false,
    } : null,
  });
}
