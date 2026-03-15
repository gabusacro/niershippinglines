import { createClient } from "@/lib/supabase/server";
import { getTodayInManila } from "./ph-time";

const PAID_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

export interface VesselDayStats {
  boat_id: string;
  boat_name: string;
  // passengers
  boarded: number;
  checked_in: number;
  confirmed: number;
  total_passengers: number;
  // revenue breakdown
  fare_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_revenue_cents: number;
  // booking counts
  online_count: number;
  walkin_count: number;
  pending_count: number;
}

export interface PeriodDashboardStats {
  period: string;
  vessels: VesselDayStats[];
  // totals across all vessels
  total_boarded: number;
  total_confirmed: number;
  total_passengers: number;
  total_fare_cents: number;
  total_platform_fee_cents: number;
  total_processing_fee_cents: number;
  total_revenue_cents: number;
  total_online: number;
  total_walkin: number;
  total_pending: number;
  total_refund_requests: number;
  vessels_active: number;
  trips_today: number;
}

export async function getDashboardStats(
  period: "today" | "week" | "month" | "year" | "custom" = "today",
  customStart?: string,
  customEnd?: string
): Promise<PeriodDashboardStats> {
  const supabase = await createClient();
  const today = getTodayInManila();

  // ── Date range ────────────────────────────────────────────────────────────
  let startDate: string;
  let endDate: string = today;

  if (period === "today") {
    startDate = today;
    endDate = today;
  } else if (period === "week") {
    // Current calendar week — Monday to Sunday (Manila time)
    const d = new Date(today + "T00:00:00");
    const day = d.getDay(); // 0 = Sunday, 1 = Monday ...
    const daysFromMonday = day === 0 ? 6 : day - 1; // Sunday wraps to 6
    d.setDate(d.getDate() - daysFromMonday);
    startDate = d.toISOString().slice(0, 10);
    // End = this Sunday
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    endDate = end.toISOString().slice(0, 10);
  } else if (period === "month") {
    startDate = today.slice(0, 7) + "-01";
    const [y, m] = today.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    endDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
  } else if (period === "year") {
    startDate = today.slice(0, 4) + "-01-01";
    endDate = today.slice(0, 4) + "-12-31";
  } else {
    startDate = customStart ?? today;
    endDate = customEnd ?? today;
  }

  // ── Fetch trips in range ──────────────────────────────────────────────────
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, boats:boat_id(id, name)")
    .gte("departure_date", startDate)
    .lte("departure_date", endDate);

  const tripIds = (trips ?? []).map((t) => t.id);
  const todayTripIds = (trips ?? [])
    .filter((t) => t.departure_date === today)
    .map((t) => t.id);

  // ── Fetch all boats ───────────────────────────────────────────────────────
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name")
    .eq("status", "running");

  const boatMap = new Map<string, string>();
  for (const b of boats ?? []) boatMap.set(b.id, b.name);

  // ── Fetch bookings ────────────────────────────────────────────────────────
  let bookings: {
    trip_id: string;
    status: string;
    passenger_count: number;
    total_amount_cents: number;
    admin_fee_cents: number;
    gcash_fee_cents: number;
    is_walk_in: boolean;
    booking_source: string | null;
  }[] = [];

  if (tripIds.length > 0) {
    const { data: bk } = await supabase
      .from("bookings")
      .select("trip_id, status, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents, is_walk_in, booking_source")
      .in("trip_id", tripIds)
      .not("status", "in", '("cancelled","refunded")');
    bookings = (bk ?? []) as typeof bookings;
  }

  // ── Pending payments (all, not trip-scoped) ───────────────────────────────
  const { count: pendingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_payment");

  // ── Refund requests ───────────────────────────────────────────────────────
  const { count: refundCount } = await supabase
    .from("refunds")
    .select("id", { count: "exact", head: true })
    .in("status", ["requested", "under_review"]);

  // ── Build trip → boat map ─────────────────────────────────────────────────
  const tripBoatMap = new Map<string, string>();
  for (const t of trips ?? []) {
    const boat = Array.isArray(t.boats) ? t.boats[0] : t.boats;
    const boatId = (boat as { id: string } | null)?.id ?? t.boat_id;
    tripBoatMap.set(t.id, boatId);
  }

  // ── Per-vessel aggregation ────────────────────────────────────────────────
  const vesselMap = new Map<string, VesselDayStats>();

  for (const b of bookings) {
    const boatId = tripBoatMap.get(b.trip_id);
    if (!boatId) continue;

    if (!vesselMap.has(boatId)) {
      vesselMap.set(boatId, {
        boat_id: boatId,
        boat_name: boatMap.get(boatId) ?? "Unknown",
        boarded: 0, checked_in: 0, confirmed: 0, total_passengers: 0,
        fare_cents: 0, platform_fee_cents: 0, processing_fee_cents: 0, total_revenue_cents: 0,
        online_count: 0, walkin_count: 0, pending_count: 0,
      });
    }

    const v = vesselMap.get(boatId)!;
    const pax = b.passenger_count ?? 1;
    const adminFee = b.admin_fee_cents ?? 0;
    const gcashFee = b.gcash_fee_cents ?? 0;
    const fare = Math.max(0, (b.total_amount_cents ?? 0) - adminFee - gcashFee);
    const isWalkIn = b.is_walk_in || b.booking_source === "walk_in" ||
      b.booking_source === "admin_walk_in" || b.booking_source === "ticket_booth_walk_in" ||
      b.booking_source === "deck_crew_walk_in" || b.booking_source === "captain_walk_in";

    if (PAID_STATUSES.includes(b.status as typeof PAID_STATUSES[number])) {
      v.total_passengers += pax;
      v.fare_cents += fare;
      v.platform_fee_cents += adminFee;
      v.processing_fee_cents += gcashFee;
      v.total_revenue_cents += b.total_amount_cents ?? 0;
      if (isWalkIn) v.walkin_count++; else v.online_count++;
    }

    if (b.status === "boarded") v.boarded += pax;
    if (b.status === "checked_in") v.checked_in += pax;
    if (b.status === "confirmed") v.confirmed += pax;
    if (b.status === "pending_payment") v.pending_count++;
  }

  // ── Boarded count from trips table (today only for accuracy) ─────────────
  if (period === "today" && todayTripIds.length > 0) {
    const { data: boardedTrips } = await supabase
      .from("trips")
      .select("boat_id, boarded_count")
      .in("id", todayTripIds);

    // Reset boarded from trips boarded_count
    for (const [boatId, v] of vesselMap) {
      v.boarded = 0;
    }
    for (const t of boardedTrips ?? []) {
      const v = vesselMap.get(t.boat_id);
      if (v) v.boarded += t.boarded_count ?? 0;
    }
  }

  const vessels = Array.from(vesselMap.values()).sort((a, b) => b.total_revenue_cents - a.total_revenue_cents);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = vessels.reduce((acc, v) => ({
    total_boarded: acc.total_boarded + v.boarded,
    total_confirmed: acc.total_confirmed + v.confirmed,
    total_passengers: acc.total_passengers + v.total_passengers,
    total_fare_cents: acc.total_fare_cents + v.fare_cents,
    total_platform_fee_cents: acc.total_platform_fee_cents + v.platform_fee_cents,
    total_processing_fee_cents: acc.total_processing_fee_cents + v.processing_fee_cents,
    total_revenue_cents: acc.total_revenue_cents + v.total_revenue_cents,
    total_online: acc.total_online + v.online_count,
    total_walkin: acc.total_walkin + v.walkin_count,
    total_pending: acc.total_pending + v.pending_count,
  }), {
    total_boarded: 0, total_confirmed: 0, total_passengers: 0,
    total_fare_cents: 0, total_platform_fee_cents: 0, total_processing_fee_cents: 0,
    total_revenue_cents: 0, total_online: 0, total_walkin: 0, total_pending: 0,
  });

  return {
    period,
    vessels,
    ...totals,
    total_pending: pendingCount ?? 0,
    total_refund_requests: refundCount ?? 0,
    vessels_active: (boats ?? []).length,
    trips_today: todayTripIds.length,
  };
}
