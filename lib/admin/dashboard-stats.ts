import { createClient } from "@/lib/supabase/server";
import { getTodayInManila } from "./ph-time";

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

export interface TodayDashboardStats {
  totalPassengerBoard: number;
  totalPassengerConfirmed: number;
  vesselsActive: number;
  totalTripsToday: number;
  revenueSiargaoSurigao: number;
  revenueSurigaoDinagat: number;
  totalRevenue: number;
  pendingPayments: number;
  refundRequests: number;
  onlineBookingsToday: number;
  walkinBookingsToday: number;
}

export async function getTodayDashboardStats(): Promise<TodayDashboardStats> {
  const supabase = await createClient();
  const today = getTodayInManila();

  const [passengerRes, vesselsRes, routesRes, tripsRes, pendingRes, refundRes] = await Promise.all([
    supabase.from("trips").select("boarded_count").eq("departure_date", today),
    supabase.from("boats").select("id").eq("status", "running"),
    supabase.from("routes").select("id, origin, destination, display_name"),
    supabase.from("trips").select("id").eq("departure_date", today),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("refunds").select("id", { count: "exact", head: true }).in("status", ["requested", "under_review"]),
  ]);

  const totalPassengerBoard = (passengerRes.data ?? []).reduce((s, t) => s + (t.boarded_count ?? 0), 0);
  const vesselsActive = (vesselsRes.data ?? []).length;
  const totalTripsToday = (tripsRes.data ?? []).length;
  const pendingPayments = pendingRes.count ?? 0;
  const refundRequests = refundRes.count ?? 0;

  const routes = routesRes.data ?? [];
  const siargaoRouteIds = routes
    .filter((r) => (r.origin === "Siargao Island" || r.destination === "Siargao Island") && !String(r.display_name).includes("Dinagat"))
    .map((r) => r.id);
  const dinagatRouteIds = routes
    .filter((r) => r.origin === "Dinagat" || r.destination === "Dinagat")
    .map((r) => r.id);

  // Get all today's trip IDs for booking queries
  const todayTripIds = (tripsRes.data ?? []).map((t) => t.id);

  let revenueSiargaoSurigao = 0;
  let revenueSurigaoDinagat = 0;
  let totalPassengerConfirmed = 0;
  let onlineBookingsToday = 0;
  let walkinBookingsToday = 0;

  if (todayTripIds.length > 0) {
    const { data: allBookings } = await supabase
      .from("bookings")
      .select("trip_id, total_amount_cents, status, is_walk_in, booking_source, passenger_count")
      .in("trip_id", todayTripIds)
      .in("status", PAYMENT_STATUSES);

    const bookings = allBookings ?? [];

    // Confirmed passengers (not yet boarded)
    totalPassengerConfirmed = bookings
      .filter((b) => b.status === "confirmed")
      .reduce((s, b) => s + (b.passenger_count ?? 1), 0);

    // Online vs walk-in
    onlineBookingsToday = bookings.filter(
      (b) => !b.is_walk_in && b.booking_source !== "walk_in"
    ).length;
    walkinBookingsToday = bookings.filter(
      (b) => b.is_walk_in || b.booking_source === "walk_in"
    ).length;

    // Revenue by route
    const siargaoTripIds = new Set(
      (tripsRes.data ?? [])
        .filter((t) => siargaoRouteIds.includes((t as { id: string; route_id?: string }).route_id ?? ""))
        .map((t) => t.id)
    );
    const dinagatTripIds = new Set(
      (tripsRes.data ?? [])
        .filter((t) => dinagatRouteIds.includes((t as { id: string; route_id?: string }).route_id ?? ""))
        .map((t) => t.id)
    );

    for (const b of bookings) {
      if (siargaoTripIds.has(b.trip_id)) revenueSiargaoSurigao += b.total_amount_cents ?? 0;
      if (dinagatTripIds.has(b.trip_id)) revenueSurigaoDinagat += b.total_amount_cents ?? 0;
    }
  }

  // Fallback for route revenue if trip IDs don't have route_id
  // (re-fetch with route_id if needed)
  if (revenueSiargaoSurigao === 0 && siargaoRouteIds.length > 0) {
    const { data: siargaoTrips } = await supabase
      .from("trips").select("id").eq("departure_date", today).in("route_id", siargaoRouteIds);
    const ids = (siargaoTrips ?? []).map((t) => t.id);
    if (ids.length > 0) {
      const { data: bk } = await supabase
        .from("bookings").select("total_amount_cents")
        .in("trip_id", ids).in("status", PAYMENT_STATUSES);
      revenueSiargaoSurigao = (bk ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);
    }
  }

  if (revenueSurigaoDinagat === 0 && dinagatRouteIds.length > 0) {
    const { data: dinagatTrips } = await supabase
      .from("trips").select("id").eq("departure_date", today).in("route_id", dinagatRouteIds);
    const ids = (dinagatTrips ?? []).map((t) => t.id);
    if (ids.length > 0) {
      const { data: bk } = await supabase
        .from("bookings").select("total_amount_cents")
        .in("trip_id", ids).in("status", PAYMENT_STATUSES);
      revenueSurigaoDinagat = (bk ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);
    }
  }

  const totalRevenue = revenueSiargaoSurigao + revenueSurigaoDinagat;

  return {
    totalPassengerBoard,
    totalPassengerConfirmed,
    vesselsActive,
    totalTripsToday,
    revenueSiargaoSurigao,
    revenueSurigaoDinagat,
    totalRevenue,
    pendingPayments,
    refundRequests,
    onlineBookingsToday,
    walkinBookingsToday,
  };
}
