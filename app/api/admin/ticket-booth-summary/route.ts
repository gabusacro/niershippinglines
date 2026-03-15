import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/ticket-booth-summary?boat_id=xxx&start=2026-03-01&end=2026-03-31
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !["admin", "ticket_booth"].includes(user.role)) {
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
      rows: [], cashTotal: 0, onlineTotal: 0,
      cashPax: 0, onlinePax: 0, totalBookings: 0,
    });
  }

  // Get all non-cancelled bookings for these trips
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      reference, booking_source, is_walk_in,
      passenger_count, total_amount_cents,
      customer_full_name, status, created_at,
      trip:trips!bookings_trip_id_fkey(departure_date, departure_time)
    `)
    .in("trip_id", tripIds)
    .not("status", "in", '("cancelled","refunded")')
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let cashTotal = 0, onlineTotal = 0, cashPax = 0, onlinePax = 0;

  const rows = (bookings ?? []).map(b => {
    const trip = Array.isArray(b.trip) ? b.trip[0] : b.trip;
    const isWalkIn = b.is_walk_in || b.booking_source !== "online";
    const pax    = b.passenger_count ?? 0;
    const amount = b.total_amount_cents ?? 0;

    if (isWalkIn) { cashTotal += amount; cashPax += pax; }
    else          { onlineTotal += amount; onlinePax += pax; }

    return {
      reference:          b.reference ?? "—",
      booking_source:     b.booking_source ?? "—",
      is_walk_in:         b.is_walk_in ?? false,
      passenger_count:    pax,
      total_amount_cents: amount,
      customer_full_name: b.customer_full_name ?? "—",
      status:             b.status ?? "—",
      created_at:         b.created_at ?? "",
      departure_date:     (trip as { departure_date?: string } | null)?.departure_date ?? "",
      departure_time:     (trip as { departure_time?: string } | null)?.departure_time ?? "",
    };
  });

  return NextResponse.json({
    rows,
    cashTotal,
    onlineTotal,
    cashPax,
    onlinePax,
    totalBookings: rows.length,
  });
}
