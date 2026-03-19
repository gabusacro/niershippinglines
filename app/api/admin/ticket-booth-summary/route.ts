import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/ticket-booth-summary?boat_id=xxx&start=2026-03-01&end=2026-03-31
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !["admin", "ticket_booth", "captain", "deck_crew"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boatId = searchParams.get("boat_id");
  const start  = searchParams.get("start");
  const end    = searchParams.get("end");

  if (!boatId || !start || !end) {
    return NextResponse.json({ error: "boat_id, start and end required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get all trips for this vessel in the date range
  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .eq("boat_id", boatId)
    .gte("departure_date", start)
    .lte("departure_date", end);

  const tripIds = (trips ?? []).map(t => t.id);
  if (tripIds.length === 0) {
    return NextResponse.json({
      rows: [], staffRows: [],
      cashTotal: 0, onlineTotal: 0,
      cashPax: 0, onlinePax: 0, totalBookings: 0,
    });
  }

  // Fetch bookings with passenger_details for per-passenger expansion
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, reference, booking_source, is_walk_in,
      passenger_count, total_amount_cents,
      admin_fee_cents, gcash_fee_cents,
      fare_type, passenger_details,
      customer_full_name, status, created_at,
      trip:trips!bookings_trip_id_fkey(departure_date, departure_time),
      creator:profiles!bookings_created_by_fkey(full_name, role)
    `)
    .in("trip_id", tripIds)
    .not("status", "in", '("cancelled","refunded")')
    .not("refund_status", "in", '("approved","processed")')
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch tickets for ticket numbers
  const bookingIds = (bookings ?? []).map(b => b.id);
  const ticketsByBooking = new Map<string, { passenger_index: number; ticket_number: string }[]>();
  if (bookingIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("booking_id, passenger_index, ticket_number")
      .in("booking_id", bookingIds);
    for (const t of tickets ?? []) {
      if (!ticketsByBooking.has(t.booking_id)) ticketsByBooking.set(t.booking_id, []);
      ticketsByBooking.get(t.booking_id)!.push(t);
    }
  }

  let cashTotal = 0, onlineTotal = 0, cashPax = 0, onlinePax = 0;

  // ── Staff rows: one entry per staff per payment type ──────────────────────
  // Key: "issuerName::issuerRole::cash" or "::online"
  type PassengerItem = {
    name:       string;
    fare_type:  string;
    ticket_num: string;
    amount:     number;
    address:    string | null;
  };

  type StaffRow = {
    key:          string;
    issuer_name:  string;
    issuer_role:  string;
    payment_type: "cash" | "online";
    pax:          number;
    total:        number;
    passengers:   PassengerItem[];
  };

  const staffRowMap = new Map<string, StaffRow>();

  const FARE_LABELS: Record<string, string> = {
    adult: "Adult", senior: "Senior", pwd: "PWD",
    student: "Student", child: "Child", infant: "Infant",
  };

  const rows = (bookings ?? []).map(b => {
    const trip    = Array.isArray(b.trip)    ? b.trip[0]    : b.trip;
    const creator = Array.isArray(b.creator) ? b.creator[0] : b.creator;

    const isWalkIn     = b.is_walk_in || b.booking_source !== "online";
    const pax          = b.passenger_count ?? 1;
    const total        = b.total_amount_cents ?? 0;
    const adminFee     = (b as { admin_fee_cents?: number }).admin_fee_cents ?? 0;
    const gcashFee     = (b as { gcash_fee_cents?: number }).gcash_fee_cents ?? 0;
    const fareAmount   = isWalkIn ? total : total - adminFee - gcashFee;
    const perPaxAmount = pax > 0 ? Math.round(fareAmount / pax) : fareAmount;

    const issuerName   = (creator as { full_name?: string } | null)?.full_name ?? "Unknown";
    const issuerRole   = (creator as { role?: string }     | null)?.role       ?? "—";
    const paymentType  = isWalkIn ? "cash" : "online";
    const staffKey     = `${issuerName}::${issuerRole}::${paymentType}`;

    // Accumulate grand totals
    if (isWalkIn) { cashTotal   += fareAmount; cashPax   += pax; }
    else          { onlineTotal += fareAmount; onlinePax += pax; }

    // Build per-passenger list for this booking
    const bookingTickets = ticketsByBooking.get(b.id) ?? [];
    const ticketByIndex  = new Map(bookingTickets.map(t => [t.passenger_index, t.ticket_number]));
    const pd = (b as { passenger_details?: { full_name?: string; fare_type?: string; address?: string; ticket_number?: string }[] | null }).passenger_details;

    const passengers: PassengerItem[] = [];

    if (Array.isArray(pd) && pd.length > 0) {
      pd.forEach((p, i) => {
        const ticketNum = ticketByIndex.get(i)
          ?? (p.ticket_number ? String(p.ticket_number) : b.reference ?? "—");
        passengers.push({
          name:       (p.full_name ?? "—").trim() || "—",
          fare_type:  FARE_LABELS[p.fare_type ?? ""] ?? (p.fare_type ?? "Adult"),
          ticket_num: ticketNum,
          amount:     perPaxAmount,
          address:    p.address?.trim() || null,
        });
      });
    } else {
      // Single passenger booking — use booking-level fields
      const ticketNum = ticketByIndex.get(0) ?? b.reference ?? "—";
      passengers.push({
        name:       b.customer_full_name ?? "—",
        fare_type:  FARE_LABELS[(b as { fare_type?: string }).fare_type ?? ""] ?? "Adult",
        ticket_num: ticketNum,
        amount:     fareAmount,
        address:    null,
      });
    }

    // Accumulate into staff row
    if (!staffRowMap.has(staffKey)) {
      staffRowMap.set(staffKey, {
        key:          staffKey,
        issuer_name:  issuerName,
        issuer_role:  issuerRole,
        payment_type: paymentType as "cash" | "online",
        pax:          0,
        total:        0,
        passengers:   [],
      });
    }
    const staffRow = staffRowMap.get(staffKey)!;
    staffRow.pax        += pax;
    staffRow.total      += fareAmount;
    staffRow.passengers.push(...passengers);

    return {
      reference:          b.reference ?? "—",
      booking_source:     b.booking_source ?? "—",
      is_walk_in:         isWalkIn,
      passenger_count:    pax,
      total_amount_cents: fareAmount,
      customer_full_name: b.customer_full_name ?? "—",
      status:             b.status ?? "—",
      created_at:         b.created_at ?? "",
      departure_date:     (trip as { departure_date?: string } | null)?.departure_date ?? "",
      departure_time:     (trip as { departure_time?: string } | null)?.departure_time ?? "",
      issuer_name:        issuerName,
      issuer_role:        issuerRole,
    };
  });

  // Sort staff rows: cash first, then online; within each, most pax first
  const staffRows = Array.from(staffRowMap.values()).sort((a, b) => {
    if (a.payment_type !== b.payment_type) return a.payment_type === "cash" ? -1 : 1;
    return b.pax - a.pax;
  });

  return NextResponse.json({
    rows,
    staffRows,
    cashTotal,
    onlineTotal,
    cashPax,
    onlinePax,
    totalBookings: rows.length,
  });
}
