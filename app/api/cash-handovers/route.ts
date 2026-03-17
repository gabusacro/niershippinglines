import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTodayInManila } from "@/lib/admin/ph-time";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cash-handovers?boat_id=xxx&year=2026&month=3
 *
 * Returns daily walk-in cash totals for the given boat + month,
 * merged with any existing handover receipts so the UI knows
 * which days have been confirmed by the owner.
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

  // Pad month to two digits for date comparison
  const monthStr  = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  // Last day of month
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const supabase = await createClient();

  // ── Fetch all walk-in bookings for this boat in this month ────────────────
  // We join trips to get departure_date, then group by date + trip in JS
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, trip_id, passenger_count, total_amount_cents, created_at,
      customer_full_name, booking_source,
      trip:trips!bookings_trip_id_fkey(
        id, departure_date, departure_time,
        route:routes(display_name, origin, destination)
      )
    `)
    .eq("is_walk_in", true)
    .in("status", ["confirmed", "checked_in", "boarded", "completed"])
    .gte("created_at", `${startDate}T00:00:00+08:00`)
    .lte("created_at", `${endDate}T23:59:59+08:00`)
    .order("created_at", { ascending: true });

  if (bookingsError) {
    console.error("[cash-handovers] bookings error:", bookingsError.message);
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Filter to only bookings for this boat by checking trip's boat_id
  // We need a second query to get trips for this boat in this period
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, boat_id, route:routes(display_name, origin, destination)")
    .eq("boat_id", boatId)
    .gte("departure_date", startDate)
    .lte("departure_date", endDate);

  if (tripsError) {
    console.error("[cash-handovers] trips error:", tripsError.message);
    return NextResponse.json({ error: tripsError.message }, { status: 500 });
  }

  // Build a set of trip IDs for this boat
  const boatTripIds = new Set((trips ?? []).map(t => t.id));
  const tripMeta = new Map((trips ?? []).map(t => {
    const route = Array.isArray(t.route) ? t.route[0] : t.route;
    return [t.id, {
      departure_date: t.departure_date,
      departure_time: t.departure_time,
      routeName: (route as { display_name?: string; origin?: string; destination?: string } | null)
        ?.display_name
        ?? [(route as { origin?: string } | null)?.origin, (route as { destination?: string } | null)?.destination]
          .filter(Boolean).join(" → ")
        ?? "—",
    }];
  }));

  // Filter bookings to this boat only
  const boatBookings = (bookings ?? []).filter(b => boatTripIds.has(b.trip_id));

  // ── Group by departure_date → trip → bookings ─────────────────────────────
  type TripEntry = {
    tripId: string;
    departure_time: string;
    routeName: string;
    pax: number;
    amountCents: number;
    bookingRefs: { reference?: string; name: string; pax: number; cents: number }[];
  };
  type DayEntry = {
    date: string;
    totalCents: number;
    totalPax: number;
    trips: TripEntry[];
  };

  const dayMap = new Map<string, DayEntry>();

  for (const b of boatBookings) {
    const meta = tripMeta.get(b.trip_id);
    if (!meta) continue;

    const date = meta.departure_date; // group by departure date, not created_at

    if (!dayMap.has(date)) {
      dayMap.set(date, { date, totalCents: 0, totalPax: 0, trips: [] });
    }
    const day = dayMap.get(date)!;

    let tripEntry = day.trips.find(t => t.tripId === b.trip_id);
    if (!tripEntry) {
      tripEntry = {
        tripId: b.trip_id,
        departure_time: meta.departure_time,
        routeName: meta.routeName,
        pax: 0,
        amountCents: 0,
        bookingRefs: [],
      };
      day.trips.push(tripEntry);
    }

    tripEntry.pax        += b.passenger_count ?? 1;
    tripEntry.amountCents += b.total_amount_cents ?? 0;
    tripEntry.bookingRefs.push({
      name:  b.customer_full_name ?? "—",
      pax:   b.passenger_count ?? 1,
      cents: b.total_amount_cents ?? 0,
    });

    day.totalCents += b.total_amount_cents ?? 0;
    day.totalPax   += b.passenger_count ?? 1;
  }

  // Sort trips within each day by departure_time
  for (const day of dayMap.values()) {
    day.trips.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
  }

  const dailySummary = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Fetch existing handover receipts for this boat + month ────────────────
  const { data: handovers } = await supabase
    .from("cash_handovers")
    .select("id, handover_date, total_amount_cents, handover_method, reference_note, marked_received_at, marked_received_by")
    .eq("boat_id", boatId)
    .gte("handover_date", startDate)
    .lte("handover_date", endDate);

  // Build a lookup: date string → handover record
  const handoverByDate = new Map(
    (handovers ?? []).map(h => [h.handover_date as string, h])
  );

  // ── Merge and return ──────────────────────────────────────────────────────
  const result = dailySummary.map(day => ({
    ...day,
    handover: handoverByDate.get(day.date) ?? null,
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/cash-handovers
 * Body: { boat_id, handover_date, total_amount_cents, handover_method, reference_note? }
 *
 * Marks a day's walk-in cash as received by the vessel owner.
 * Only vessel_owner and admin can call this.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "vessel_owner"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Only vessel owners and admins can confirm cash handovers." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const boatId          = b.boat_id;
  const handoverDate    = b.handover_date;      // "YYYY-MM-DD"
  const totalCents      = b.total_amount_cents;
  const method          = b.handover_method ?? "cash_in_person";
  const referenceNote   = b.reference_note ?? null;

  if (!boatId || !handoverDate || typeof totalCents !== "number") {
    return NextResponse.json({ error: "boat_id, handover_date, total_amount_cents required" }, { status: 400 });
  }

  // Use admin client so RLS doesn't block the upsert
  const supabase = createAdminClient() ?? (await createClient());

  // Verify the user is actually a vessel owner of this boat (or admin)
  if (user.role !== "admin") {
    const { data: assignment } = await supabase
      .from("boat_assignments")
      .select("id")
      .eq("boat_id", boatId)
      .eq("profile_id", user.id)
      .eq("assignment_role", "vessel_owner")
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json({ error: "You are not the owner of this vessel." }, { status: 403 });
    }
  }

  // Upsert — if already marked, update the record (owner can correct notes/method)
  const { data, error } = await supabase
    .from("cash_handovers")
    .upsert({
      boat_id:             boatId,
      handover_date:       handoverDate,
      total_amount_cents:  totalCents,
      handover_method:     method,
      reference_note:      referenceNote,
      marked_received_by:  user.id,
      marked_received_at:  new Date().toISOString(),
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
 *
 * Un-marks a handover (in case owner marked it by mistake).
 * Only vessel_owner and admin can call this.
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "vessel_owner"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const boatId        = searchParams.get("boat_id");
  const handoverDate  = searchParams.get("handover_date");

  if (!boatId || !handoverDate) {
    return NextResponse.json({ error: "boat_id and handover_date required" }, { status: 400 });
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
