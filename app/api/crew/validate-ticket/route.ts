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
    user_id: string | null;
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
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, user_id, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
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
      .select("id, reference, status, refund_status, customer_full_name, passenger_details, user_id, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))")
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
  const passengerName = (passenger.full_name ?? "").toLowerCase().trim();

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

    // Step 1: Look up by booking_id + passenger_index (most precise)
    const { data: idRows } = await supabase
      .from("passenger_id_verifications")
      .select("id, discount_type, verification_status, id_image_url, expires_at, uploaded_at, admin_note, passenger_name")
      .eq("booking_id", booking.id)
      .eq("passenger_index", passengerIndex)
      .order("uploaded_at", { ascending: false });

    if (idRows && idRows.length > 0) {
      const verified = idRows.find(r => r.verification_status === "verified");
      const pending  = idRows.find(r => r.verification_status === "pending");
      idVerification = verified ?? pending ?? idRows[0] ?? null;
    }

    // Step 2: Reusable ID — look up by the booking owner's profile_id
    if (!idVerification && booking.user_id) {
      const { data: profileIds } = await supabase
        .from("passenger_id_verifications")
        .select("id, discount_type, verification_status, id_image_url, expires_at, uploaded_at, admin_note, passenger_name")
        .eq("profile_id", booking.user_id)
        .eq("discount_type", fareType)
        .order("uploaded_at", { ascending: false });

      if (profileIds && profileIds.length > 0) {
        const verifiedMatch = profileIds.find(r =>
          r.verification_status === "verified" &&
          r.passenger_name?.toLowerCase().trim() === passengerName
        );
        const verifiedAny  = profileIds.find(r => r.verification_status === "verified");
        const pendingMatch = profileIds.find(r =>
          r.verification_status === "pending" &&
          r.passenger_name?.toLowerCase().trim() === passengerName
        );
        idVerification = verifiedMatch ?? verifiedAny ?? pendingMatch ?? null;
      }
    }

    // Step 3: Last resort — search verified IDs by passenger name only
    if (!idVerification && passengerName) {
      const { data: nameIds } = await supabase
        .from("passenger_id_verifications")
        .select("id, discount_type, verification_status, id_image_url, expires_at, uploaded_at, admin_note, passenger_name")
        .eq("discount_type", fareType)
        .eq("verification_status", "verified")
        .ilike("passenger_name", passengerName)
        .order("uploaded_at", { ascending: false })
        .limit(1);

      idVerification = nameIds?.[0] ?? null;
    }
  }

  // Compute age from birthdate
  const birthdate = (passenger as { birthdate?: string }).birthdate ?? null;
  let age: number | null = null;
  if (birthdate) {
    const today = new Date();
    const dob   = new Date(birthdate);
    age = today.getFullYear() - dob.getFullYear();
    const hasBirthdayPassed =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    if (!hasBirthdayPassed) age -= 1;
  }

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
    passenger_gender: (passenger as { gender?: string }).gender ?? null,
    passenger_birthdate: birthdate,
    passenger_nationality: (passenger as { nationality?: string }).nationality ?? null,
    passenger_age: age,
    trip: trip ? {
      date: trip.departure_date,
      time: trip.departure_time,
      vessel: trip.boat?.name ?? "—",
      route: trip.route?.display_name ?? "—",
    } : null,
    id_required: needsId,
    id_verification: idVerification ? {
      id: idVerification.id,
      discount_type: idVerification.discount_type,
      status: idVerification.verification_status,
      image_url: idVerification.id_image_url,
      expires_at: idVerification.expires_at,
      uploaded_at: idVerification.uploaded_at,
      admin_note: idVerification.admin_note,
      is_expired: idVerification.expires_at
        ? new Date(idVerification.expires_at) < new Date()
        : false,
    } : null,
  });
}
