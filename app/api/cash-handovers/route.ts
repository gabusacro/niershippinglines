import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cash-handovers?boat_id=xxx&year=2026&month=3
 *
 * Returns ALL trip days for the given boat + month, merged with
 * walk-in booking totals and any existing handover receipts.
 *
 * Days with scheduled trips but ZERO walk-in bookings are included
 * so the vessel owner can spot suspicious gaps in cash collection.
 *
 * Accessible by: admin, vessel_owner, ticket_booth (for their assigned boat)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "vessel_owner", "ticket_booth"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const boatId = searchParams.get("boat_id");
  const year   = parseInt(searchParams.get("year")  ?? "0");
  const month  = parseInt(searchParams.get("month") ?? "0");

  if (!boatId || !year || !month) {
    return NextResponse.json({ error: "boat_id, year, month required" }, { status: 400 });
  }

  const monthStr  = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const supabase = await createClient();

  // ── 1. Fetch ALL scheduled trips for this boat in this month ─────────────
  // This is the backbone — every trip day appears even with zero bookings
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(`
      id, departure_date, departure_time,
      route:routes(display_name, origin, destination)
    `)
    .eq("boat_id", boatId)
    .eq("status", "scheduled")
    .gte("departure_date", startDate)
    .lte("departure_date", endDate)
    .order("departure_date")
    .order("departure_time");

  if (tripsError) {
    console.error("[cash-handovers] trips error:", tripsError.message);
    return NextResponse.json({ error: tripsError.message }, { status: 500 });
  }

  const allTrips = trips ?? [];
  const boatTripIds = new Set(allTrips.map(t => t.id));

  // Build trip metadata map
  type TripMeta = {
    departure_date: string;
    departure_time: string;
    routeName: string;
  };
  const tripMeta = new Map<string, TripMeta>();
  for (const t of allTrips) {
    const route = Array.isArray(t.route) ? t.route[0] : t.route;
    const r = route as { display_name?: string; origin?: string; destination?: string } | null;
    tripMeta.set(t.id, {
      departure_date: t.departure_date,
      departure_time: t.departure_time,
      routeName: r?.display_name
        ?? [r?.origin, r?.destination].filter(Boolean).join(" → ")
        ?? "—",
    });
  }

  // ── 2. Fetch walk-in bookings for this boat's trips in this month ─────────
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, trip_id, passenger_count, total_amount_cents,
      customer_full_name, booking_source
    `)
    .eq("is_walk_in", true)
    .in("status", ["confirmed", "checked_in", "boarded", "completed"])
    .in("trip_id", allTrips.length > 0 ? allTrips.map(t => t.id) : ["none"]);

  if (bookingsError) {
    console.error("[cash-handovers] bookings error:", bookingsError.message);
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // ── 3. Build day map from ALL trips (not just booked ones) ────────────────
  type TripEntry = {
    tripId: string;
    departure_time: string;
    routeName: string;
    pax: number;
    amountCents: number;
    bookingRefs: { name: string; pax: number; cents: number }[];
  };

  type DayEntry = {
    date: string;
    totalCents: number;
    totalPax: number;
    tripCount: number;          // total scheduled trips that day
    trips: TripEntry[];
    hasAnyBookings: boolean;    // false = suspicious zero cash day
    handover: null;             // filled in step 4
  };

  // Seed the map with ALL trip days — even days with zero bookings
  const dayMap = new Map<string, DayEntry>();
  for (const t of allTrips) {
    const date = t.departure_date;
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        totalCents: 0,
        totalPax: 0,
        tripCount: 0,
        trips: [],
        hasAnyBookings: false,
        handover: null,
      });
    }
    const day = dayMap.get(date)!;
    day.tripCount += 1;

    // Add a trip entry with zero amounts — will be filled if bookings exist
    day.trips.push({
      tripId:         t.id,
      departure_time: t.departure_time,
      routeName:      tripMeta.get(t.id)?.routeName ?? "—",
      pax:            0,
      amountCents:    0,
      bookingRefs:    [],
    });
  }

  // ── 4. Fill in booking amounts ────────────────────────────────────────────
  for (const b of bookings ?? []) {
    if (!boatTripIds.has(b.trip_id)) continue;
    const meta = tripMeta.get(b.trip_id);
    if (!meta) continue;

    const date = meta.departure_date;
    const day  = dayMap.get(date);
    if (!day) continue;

    day.hasAnyBookings = true;

    const tripEntry = day.trips.find(t => t.tripId === b.trip_id);
    if (tripEntry) {
      tripEntry.pax         += b.passenger_count ?? 1;
      tripEntry.amountCents += b.total_amount_cents ?? 0;
      tripEntry.bookingRefs.push({
        name:  b.customer_full_name ?? "—",
        pax:   b.passenger_count ?? 1,
        cents: b.total_amount_cents ?? 0,
      });
    }

    day.totalCents += b.total_amount_cents ?? 0;
    day.totalPax   += b.passenger_count ?? 1;
  }

  // Sort trips within each day by departure_time
  for (const day of dayMap.values()) {
    day.trips.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
  }

  const dailySummary = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── 5. Fetch existing handover receipts for this boat + month ─────────────
  const { data: handovers } = await supabase
    .from("cash_handovers")
    .select(`
      id, handover_date, total_amount_cents,
      handover_method, reference_note,
      marked_received_at, marked_received_by
    `)
    .eq("boat_id", boatId)
    .gte("handover_date", startDate)
    .lte("handover_date", endDate);

  const handoverByDate = new Map(
    (handovers ?? []).map(h => [h.handover_date as string, h])
  );

  // ── 6. Merge and return ───────────────────────────────────────────────────
  // Only return days that either:
  //   a) have at least one walk-in booking, OR
  //   b) have a handover record already marked (past history preservation)
  // Days with trips but ZERO bookings are hidden — no activity = not shown
  const result = dailySummary
    .filter(day => day.hasAnyBookings || handoverByDate.has(day.date))
    .map(day => ({
      ...day,
      handover: handoverByDate.get(day.date) ?? null,
    }));

  return NextResponse.json(result);
}

/**
 * POST /api/cash-handovers
 * Body: { boat_id, handover_date, total_amount_cents, handover_method, reference_note? }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "vessel_owner"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({
      error: "Only vessel owners and admins can confirm cash handovers.",
    }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const boatId        = b.boat_id;
  const handoverDate  = b.handover_date;
  const totalCents    = b.total_amount_cents;
  const method        = b.handover_method ?? "cash_in_person";
  const referenceNote = b.reference_note ?? null;

  if (!boatId || !handoverDate || typeof totalCents !== "number") {
    return NextResponse.json({
      error: "boat_id, handover_date, total_amount_cents required",
    }, { status: 400 });
  }

  const supabase = createAdminClient() ?? (await createClient());

  // Verify ownership (unless admin)
  if (user.role !== "admin") {
    const { data: assignment } = await supabase
      .from("vessel_assignments")
      .select("id")
      .eq("boat_id", boatId)
      .eq("vessel_owner_id", user.id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json({
        error: "You are not the owner of this vessel.",
      }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("cash_handovers")
    .upsert({
      boat_id:            boatId,
      handover_date:      handoverDate,
      total_amount_cents: totalCents,
      handover_method:    method,
      reference_note:     referenceNote,
      marked_received_by: user.id,
      marked_received_at: new Date().toISOString(),
    }, { onConflict: "boat_id,handover_date" })
    .select()
    .single();

  if (error) {
    console.error("[cash-handovers] upsert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/cash-handovers?boat_id=xxx&handover_date=YYYY-MM-DD
 * Un-marks a handover (in case owner marked it by mistake).
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "vessel_owner"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const boatId       = searchParams.get("boat_id");
  const handoverDate = searchParams.get("handover_date");

  if (!boatId || !handoverDate) {
    return NextResponse.json({
      error: "boat_id and handover_date required",
    }, { status: 400 });
  }

  const supabase = createAdminClient() ?? (await createClient());

  const { error } = await supabase
    .from("cash_handovers")
    .delete()
    .eq("boat_id", boatId)
    .eq("handover_date", handoverDate);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
