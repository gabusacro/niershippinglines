import { createClient } from "@/lib/supabase/server";
import { getTodayInManila, getMonthStartEndInManila } from "./ph-time";
import { FUEL_PESOS_PER_LITER } from "@/lib/constants";

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

const DEFAULT_FUEL_LITERS = 100;

export interface FuelSettings {
  defaultFuelLitersPerTrip: number;
  fuelPesosPerLiter: number;
}

/** Fetches fuel settings from app_settings (admin-editable). Falls back to constants if missing. */
export async function getFuelSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<FuelSettings> {
  const { data: row } = await supabase
    .from("app_settings")
    .select("default_fuel_liters_per_trip, fuel_pesos_per_liter")
    .eq("id", 1)
    .maybeSingle();

  const defaultFuelLitersPerTrip =
    typeof row?.default_fuel_liters_per_trip === "number" && row.default_fuel_liters_per_trip >= 0
      ? row.default_fuel_liters_per_trip
      : DEFAULT_FUEL_LITERS;
  const fuelPesosPerLiter =
    typeof row?.fuel_pesos_per_liter === "number" && row.fuel_pesos_per_liter >= 0
      ? Number(row.fuel_pesos_per_liter)
      : FUEL_PESOS_PER_LITER;

  return { defaultFuelLitersPerTrip, fuelPesosPerLiter };
}

/** Fuel cost in centavos: liters × price per liter (PHP/L). */
function fuelCostCentsFromLiters(liters: number, fuelPesosPerLiter: number): number {
  return Math.round(liters * fuelPesosPerLiter * 100);
}

/** Per-trip report row for today (one row per departure time). */
export interface TripReportRow {
  tripId: string;
  vesselName: string;
  departureTime: string;
  routeName: string;
  availableSeats: number;
  passengerBoard: number;
  revenueCents: number;
  fuelLiters: number;
  /** Fuel cost in centavos (fuelLiters × 61.4 PHP/L). */
  fuelCostCents: number;
  netRevenueCents: number;
}

/** Monthly totals (passengers, revenue, fuel, net). */
export interface MonthlySummary {
  totalPassengers: number;
  totalRevenueCents: number;
  totalFuelLiters: number;
  /** Fuel cost in centavos (totalFuelLiters × 61.4 PHP/L). */
  totalFuelCostCents: number;
  netRevenueCents: number;
}

/** Today's trips with per-trip available seats and stats. Uses Philippines date. */
export async function getReportsTodayPerTrip(): Promise<TripReportRow[]> {
  const today = getTodayInManila();
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);

  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(
      "id, departure_time, fuel_liters_used, online_quota, online_booked, walk_in_quota, walk_in_booked, boarded_count, boat:boats(name, default_fuel_liters_per_trip), route:routes(display_name, origin, destination)"
    )
    .eq("departure_date", today)
    .order("departure_time");

  if (tripsError || !trips?.length) return [];

  const tripIds = (trips ?? []).map((t) => t.id);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  const passengersByTrip = new Map<string, number>();
  const revenueByTrip = new Map<string, number>();
  for (const b of bookings ?? []) {
    passengersByTrip.set(b.trip_id, (passengersByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
    revenueByTrip.set(b.trip_id, (revenueByTrip.get(b.trip_id) ?? 0) + (b.total_amount_cents ?? 0));
  }

  return (trips ?? []).map((t) => {
    const oq = t.online_quota ?? 0;
    const ob = t.online_booked ?? 0;
    const wq = t.walk_in_quota ?? 0;
    const wb = t.walk_in_booked ?? 0;
    const availableSeats = Math.max(0, (oq - ob) + (wq - wb));
    const route = t.route as { display_name?: string; origin?: string; destination?: string } | null;
    const routeName =
      route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
    const boat = t.boat as { name?: string; default_fuel_liters_per_trip?: number } | null;
    const boatName = boat?.name ?? "—";
    const tripFuel = (t as { fuel_liters_used?: number | null }).fuel_liters_used;
    const fuelL =
      typeof tripFuel === "number" && tripFuel >= 0
        ? tripFuel
        : (typeof boat?.default_fuel_liters_per_trip === "number" && boat.default_fuel_liters_per_trip >= 0
          ? boat.default_fuel_liters_per_trip
          : fuelSettings.defaultFuelLitersPerTrip);
    const revenue = revenueByTrip.get(t.id) ?? 0;
    const fuelCost = fuelCostCentsFromLiters(fuelL, fuelSettings.fuelPesosPerLiter);
    return {
      tripId: t.id,
      vesselName: boatName,
      departureTime: t.departure_time ?? "—",
      routeName,
      availableSeats,
      passengerBoard: passengersByTrip.get(t.id) ?? t.boarded_count ?? 0,
      revenueCents: revenue,
      fuelLiters: fuelL,
      fuelCostCents: fuelCost,
      netRevenueCents: revenue - fuelCost,
    };
  });
}

/** Current month (Philippines) summary from Supabase. */
export async function getMonthlySummary(): Promise<MonthlySummary> {
  const { start, end } = getMonthStartEndInManila();
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);

  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_date", start)
    .lte("departure_date", end);

  const tripIds = (trips ?? []).map((t) => t.id);
  if (tripIds.length === 0) {
    return { totalPassengers: 0, totalRevenueCents: 0, totalFuelLiters: 0, totalFuelCostCents: 0, netRevenueCents: 0 };
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  let totalPassengers = 0;
  let totalRevenueCents = 0;
  for (const b of bookings ?? []) {
    totalPassengers += b.passenger_count ?? 0;
    totalRevenueCents += b.total_amount_cents ?? 0;
  }

  const totalFuelLiters = tripIds.length * fuelSettings.defaultFuelLitersPerTrip;
  const totalFuelCostCents = fuelCostCentsFromLiters(totalFuelLiters, fuelSettings.fuelPesosPerLiter);

  return {
    totalPassengers,
    totalRevenueCents,
    totalFuelLiters,
    totalFuelCostCents,
    netRevenueCents: totalRevenueCents - totalFuelCostCents,
  };
}

export interface VesselDayReport {
  boatId: string;
  boatName: string;
  passengerBoard: number;
  availableSeats: number;
  revenueCents: number;
  fuelLiters: number;
  /** Fuel cost in centavos (fuelLiters × 61.4 PHP/L). */
  fuelCostCents: number;
  netRevenueCents: number;
}

export async function getVesselReportsToday(): Promise<VesselDayReport[]> {
  const supabase = await createClient();
  const today = getTodayInManila();
  const fuelSettings = await getFuelSettings(supabase);

  const { data: todayTrips } = await supabase
    .from("trips")
    .select("id, boat_id, fuel_liters_used, boarded_count, online_quota, online_booked, walk_in_quota, walk_in_booked")
    .eq("departure_date", today);

  if (!todayTrips?.length) return [];

  const boatIds = [...new Set(todayTrips.map((t) => t.boat_id))];
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, default_fuel_liters_per_trip")
    .in("id", boatIds);

  const fuelByBoat = new Map(
    (boats ?? []).map((b) => [
      b.id,
      typeof (b as { default_fuel_liters_per_trip?: number }).default_fuel_liters_per_trip === "number"
        ? (b as { default_fuel_liters_per_trip: number }).default_fuel_liters_per_trip
        : fuelSettings.defaultFuelLitersPerTrip,
    ])
  );

  const tripIds = todayTrips.map((t) => t.id);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, total_amount_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  const revenueByTrip2 = new Map<string, number>();
  (bookings ?? []).forEach((b) => {
    const tid = b.trip_id;
    revenueByTrip2.set(tid, (revenueByTrip2.get(tid) ?? 0) + (b.total_amount_cents ?? 0));
  });

  const byBoat = new Map<
    string,
    { board: number; available: number; revenue: number; fuel: number }
  >();

  for (const t of todayTrips) {
    const bid = t.boat_id;
    const cur = byBoat.get(bid) ?? { board: 0, available: 0, revenue: 0, fuel: 0 };
    cur.board += t.boarded_count ?? 0;
    const oq = t.online_quota ?? 0;
    const ob = t.online_booked ?? 0;
    const wq = t.walk_in_quota ?? 0;
    const wb = t.walk_in_booked ?? 0;
    cur.available += oq + wq - ob - wb;
    cur.revenue += revenueByTrip2.get(t.id) ?? 0;
    const tripFuel = (t as { fuel_liters_used?: number | null }).fuel_liters_used;
    cur.fuel +=
      typeof tripFuel === "number" && tripFuel >= 0
        ? tripFuel
        : fuelByBoat.get(bid) ?? fuelSettings.defaultFuelLitersPerTrip;
    byBoat.set(bid, cur);
  }

  return (boats ?? []).map((b) => {
    const agg = byBoat.get(b.id) ?? { board: 0, available: 0, revenue: 0, fuel: 0 };
    const fuelCost = fuelCostCentsFromLiters(agg.fuel, fuelSettings.fuelPesosPerLiter);
    return {
      boatId: b.id,
      boatName: b.name,
      passengerBoard: agg.board,
      availableSeats: agg.available,
      revenueCents: agg.revenue,
      fuelLiters: agg.fuel,
      fuelCostCents: fuelCost,
      netRevenueCents: agg.revenue - fuelCost,
    };
  });
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface MonthStat {
  month: number;
  monthName: string;
  passengers: number;
  revenueCents: number;
}

/** Annual analytics: passengers and revenue per month for a given year. Used for peak travel (tourist) by month. */
export async function getAnnualMonthlyStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number
): Promise<MonthStat[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: trips } = await supabase
    .from("trips")
    .select("id, departure_date")
    .gte("departure_date", start)
    .lte("departure_date", end);

  const tripIds = (trips ?? []).map((t) => t.id);
  const tripIdToMonth = new Map<string, number>();
  for (const t of trips ?? []) {
    const d = (t as { departure_date?: string }).departure_date;
    if (d && d.length >= 7) {
      const m = parseInt(d.slice(5, 7), 10);
      if (m >= 1 && m <= 12) tripIdToMonth.set(t.id, m);
    }
  }

  const byMonth = new Map<number, { passengers: number; revenueCents: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { passengers: 0, revenueCents: 0 });

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const month = tripIdToMonth.get(b.trip_id);
      if (month == null) continue;
      const cur = byMonth.get(month)!;
      cur.passengers += b.passenger_count ?? 0;
      cur.revenueCents += b.total_amount_cents ?? 0;
    }
  }

  return MONTH_NAMES.map((monthName, i) => {
    const m = i + 1;
    const cur = byMonth.get(m) ?? { passengers: 0, revenueCents: 0 };
    return { month: m, monthName, passengers: cur.passengers, revenueCents: cur.revenueCents };
  });
}

export interface MonthVesselRow {
  month: number;
  monthName: string;
  vesselName: string;
  /** Boat UUID for linking to trip list / manifests. */
  boatId: string | null;
  passengers: number;
  revenueCents: number;
}

/** Annual monthly stats plus per-month-per-vessel breakdown (which vessel in each month). */
export async function getAnnualMonthlyStatsWithVessels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number
): Promise<{ monthly: MonthStat[]; byMonthVessel: MonthVesselRow[] }> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: trips } = await supabase
    .from("trips")
    .select("id, departure_date, boat_id, boat:boats(name)")
    .gte("departure_date", start)
    .lte("departure_date", end);

  const tripIds = (trips ?? []).map((t) => t.id);
  const tripIdToMonth = new Map<string, number>();
  const tripIdToVessel = new Map<string, string>();
  const tripIdToBoatId = new Map<string, string>();
  for (const t of trips ?? []) {
    const d = (t as { departure_date?: string }).departure_date;
    if (d && d.length >= 7) {
      const m = parseInt(d.slice(5, 7), 10);
      if (m >= 1 && m <= 12) tripIdToMonth.set(t.id, m);
    }
    const boat = (t as { boat?: { name?: string } | null }).boat;
    const vesselName = boat?.name?.trim() || "—";
    tripIdToVessel.set(t.id, vesselName);
    const bid = (t as { boat_id?: string }).boat_id;
    if (bid) tripIdToBoatId.set(t.id, bid);
  }

  const byMonthVessel = new Map<string, { passengers: number; revenueCents: number; boatId: string | null }>();
  function key(m: number, v: string) {
    return `${m}:${v}`;
  }

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const month = tripIdToMonth.get(b.trip_id);
      const vessel = tripIdToVessel.get(b.trip_id) ?? "—";
      if (month == null) continue;
      const k = key(month, vessel);
      const cur = byMonthVessel.get(k) ?? { passengers: 0, revenueCents: 0, boatId: null };
      cur.passengers += b.passenger_count ?? 0;
      cur.revenueCents += b.total_amount_cents ?? 0;
      if (cur.boatId == null) cur.boatId = tripIdToBoatId.get(b.trip_id) ?? null;
      byMonthVessel.set(k, cur);
    }
  }

  const byMonthVesselRows: MonthVesselRow[] = [];
  const byMonthAgg = new Map<number, { passengers: number; revenueCents: number }>();
  for (let m = 1; m <= 12; m++) byMonthAgg.set(m, { passengers: 0, revenueCents: 0 });

  for (let m = 1; m <= 12; m++) {
    const monthName = MONTH_NAMES[m - 1];
    const keysForMonth = [...byMonthVessel.keys()].filter((k) => k.startsWith(`${m}:`));
    for (const k of keysForMonth) {
      const vesselName = k.slice(String(m).length + 1);
      const cur = byMonthVessel.get(k)!;
      if (cur.passengers > 0 || cur.revenueCents > 0) {
        byMonthVesselRows.push({
          month: m,
          monthName,
          vesselName,
          boatId: cur.boatId ?? null,
          passengers: cur.passengers,
          revenueCents: cur.revenueCents,
        });
        const agg = byMonthAgg.get(m)!;
        agg.passengers += cur.passengers;
        agg.revenueCents += cur.revenueCents;
      }
    }
  }
  byMonthVesselRows.sort((a, b) => a.month - b.month || a.vesselName.localeCompare(b.vesselName));

  const monthly: MonthStat[] = MONTH_NAMES.map((monthName, i) => {
    const m = i + 1;
    const agg = byMonthAgg.get(m) ?? { passengers: 0, revenueCents: 0 };
    return { month: m, monthName, passengers: agg.passengers, revenueCents: agg.revenueCents };
  });

  return { monthly, byMonthVessel: byMonthVesselRows };
}
