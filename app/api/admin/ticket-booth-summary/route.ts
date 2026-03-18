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
      rows: [], staffSummary: [],
      cashTotal: 0, onlineTotal: 0,
      cashPax: 0, onlinePax: 0, totalBookings: 0,
    });
  }

  // Get all non-cancelled bookings — including creator profile for accountability
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      reference, booking_source, is_walk_in,
      passenger_count, total_amount_cents,
      admin_fee_cents, gcash_fee_cents,
      customer_full_name, status, created_at,
      trip:trips!bookings_trip_id_fkey(departure_date, departure_time),
      creator:profiles!bookings_created_by_fkey(full_name, role)
    `)
    .in("trip_id", tripIds)
    .not("status", "in", '("cancelled","refunded")')
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let cashTotal = 0, onlineTotal = 0, cashPax = 0, onlinePax = 0;

  // Staff summary: group by issuer for accountability
  const staffMap = new Map<string, {
    issuer_id:   string;
    issuer_name: string;
    issuer_role: string;
    cashTotal:   number;
    onlineTotal: number;
    cashPax:     number;
    onlinePax:   number;
    bookingCount: number;
  }>();

  const rows = (bookings ?? []).map(b => {
    const trip    = Array.isArray(b.trip)    ? b.trip[0]    : b.trip;
    const creator = Array.isArray(b.creator) ? b.creator[0] : b.creator;

    const isWalkIn     = b.is_walk_in || b.booking_source !== "online";
    const pax          = b.passenger_count ?? 0;
    const total        = b.total_amount_cents ?? 0;
    const adminFee     = (b as { admin_fee_cents?: number }).admin_fee_cents ?? 0;
    const gcashFee     = (b as { gcash_fee_cents?: number }).gcash_fee_cents ?? 0;
    const fareAmount   = isWalkIn ? total : total - adminFee - gcashFee;

    const issuerName   = (creator as { full_name?: string } | null)?.full_name ?? "Unknown";
    const issuerRole   = (creator as { role?: string } | null)?.role ?? "—";
    // Use a stable key for grouping — name + role combo
    const staffKey     = `${issuerName}::${issuerRole}`;

    // Accumulate totals
    if (isWalkIn) { cashTotal  += fareAmount; cashPax   += pax; }
    else          { onlineTotal += fareAmount; onlinePax += pax; }

    // Accumulate per-staff
    if (!staffMap.has(staffKey)) {
      staffMap.set(staffKey, {
        issuer_id:    staffKey,
        issuer_name:  issuerName,
        issuer_role:  issuerRole,
        cashTotal:    0, onlineTotal: 0,
        cashPax:      0, onlinePax:   0,
        bookingCount: 0,
      });
    }
    const staff = staffMap.get(staffKey)!;
    staff.bookingCount += 1;
    if (isWalkIn) { staff.cashTotal  += fareAmount; staff.cashPax   += pax; }
    else          { staff.onlineTotal += fareAmount; staff.onlinePax += pax; }

    return {
      reference:          b.reference ?? "—",
      booking_source:     b.booking_source ?? "—",
      is_walk_in:         b.is_walk_in ?? false,
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

  // Sort staff summary: most cash first
  const staffSummary = Array.from(staffMap.values())
    .sort((a, b) => (b.cashTotal + b.onlineTotal) - (a.cashTotal + a.onlineTotal));

  return NextResponse.json({
    rows,
    staffSummary,
    cashTotal,
    onlineTotal,
    cashPax,
    onlinePax,
    totalBookings: rows.length,
  });
}
