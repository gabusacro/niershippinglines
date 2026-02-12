import { createClient } from "@/lib/supabase/server";
import { getTodayInManila } from "./ph-time";
const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

export interface TodayDashboardStats {
  totalPassengerBoard: number;
  vesselsActive: number;
  revenueSiargaoSurigao: number;
  revenueSurigaoDinagat: number;
  totalFuelLiters: number;
  totalRevenue: number;
}

export async function getTodayDashboardStats(): Promise<TodayDashboardStats> {
  const supabase = await createClient();

  const today = getTodayInManila();
  const [passengerRes, vesselsRes, routesRes] = await Promise.all([
    supabase.from("trips").select("boarded_count").eq("departure_date", today),
    supabase.from("boats").select("id").eq("status", "running"),
    supabase.from("routes").select("id, origin, destination, display_name"),
  ]);

  const totalPassengerBoard = (passengerRes.data ?? []).reduce((s, t) => s + (t.boarded_count ?? 0), 0);
  const vesselsActive = (vesselsRes.data ?? []).length;

  const routes = routesRes.data ?? [];
  const siargaoRouteIds = routes
    .filter((r) => (r.origin === "Siargao Island" || r.destination === "Siargao Island") && !String(r.display_name).includes("Dinagat"))
    .map((r) => r.id);
  const dinagatRouteIds = routes
    .filter((r) => r.origin === "Dinagat" || r.destination === "Dinagat")
    .map((r) => r.id);

  let revenueSiargaoSurigao = 0;
  let revenueSurigaoDinagat = 0;

  if (siargaoRouteIds.length > 0) {
    const { data: siargaoTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("departure_date", today)
      .in("route_id", siargaoRouteIds);
    const tripIdsSiargao = (siargaoTrips ?? []).map((t) => t.id);
    if (tripIdsSiargao.length > 0) {
      const { data: bookingsSiargao } = await supabase
        .from("bookings")
        .select("total_amount_cents")
        .in("trip_id", tripIdsSiargao)
        .in("status", PAYMENT_STATUSES);
      revenueSiargaoSurigao = (bookingsSiargao ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);
    }
  }

  if (dinagatRouteIds.length > 0) {
    const { data: dinagatTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("departure_date", today)
      .in("route_id", dinagatRouteIds);
    const tripIdsDinagat = (dinagatTrips ?? []).map((t) => t.id);
    if (tripIdsDinagat.length > 0) {
      const { data: bookingsDinagat } = await supabase
        .from("bookings")
        .select("total_amount_cents")
        .in("trip_id", tripIdsDinagat)
        .in("status", PAYMENT_STATUSES);
      revenueSurigaoDinagat = (bookingsDinagat ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);
    }
  }

  const totalRevenue = revenueSiargaoSurigao + revenueSurigaoDinagat;

  const { data: todayTrips } = await supabase
    .from("trips")
    .select("id, boat_id, fuel_liters_used")
    .eq("departure_date", today);
  const boatIds = [...new Set((todayTrips ?? []).map((t) => t.boat_id))];
  const { data: boatsFuel } = await supabase
    .from("boats")
    .select("id")
    .in("id", boatIds);
  const fuelByBoat = new Map((boatsFuel ?? []).map((b) => [b.id, 100]));
  const totalFuelLiters = (todayTrips ?? []).reduce(
    (s, t) => s + ((t as { fuel_liters_used?: number }).fuel_liters_used ?? fuelByBoat.get(t.boat_id) ?? 100),
    0
  );

  return {
    totalPassengerBoard,
    vesselsActive,
    revenueSiargaoSurigao,
    revenueSurigaoDinagat,
    totalFuelLiters,
    totalRevenue,
  };
}
