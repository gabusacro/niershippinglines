import { createClient } from "@/lib/supabase/server";
import { getTodayInManila, getMonthStartEndInManila, getWeekStartEndInManila } from "./ph-time";
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

/** Per-trip report row — shared for daily and date-range views. */
export interface TripReportRow {
  tripId: string;
  vesselName: string;
  departureTime: string;
  departureDate: string;
  routeName: string;
  availableSeats: number;
  passengerBoard: number;
  revenueCents: number;
  adminFeeCents: number;
  gcashFeeCents: number;
  fuelLiters: number;
  fuelCostCents: number;
  netRevenueCents: number;
}

/** Summary totals for any period. */
export interface PeriodSummary {
  totalPassengers: number;
  totalRevenueCents: number;
  totalAdminFeeCents: number;
  totalGcashFeeCents: number;
  totalFuelLiters: number;
  totalFuelCostCents: number;
  netRevenueCents: number;
}

/** Monthly totals (passengers, revenue, fuel, net) — kept for backward compat. */
export type MonthlySummary = PeriodSummary;

// ---------------------------------------------------------------------------
// Daily – one row per trip for a given date
// ---------------------------------------------------------------------------

/** Today's trips with per-trip stats. Uses Philippines date. */
export async function getReportsTodayPerTrip(): Promise<TripReportRow[]> {
  const today = getTodayInManila();
  return getReportsForDatePerTrip(today);
}

/** Trips for a specific date (YYYY-MM-DD). */
export async function getReportsForDatePerTrip(date: string): Promise<TripReportRow[]> {
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);

  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(
      "id, departure_time, departure_date, online_quota, online_booked, walk_in_quota, walk_in_booked, boarded_count, boat:boats(name), route:routes(display_name, origin, destination)"
    )
    .eq("departure_date", date)
    .order("departure_time");

  if (tripsError) {
    console.error("[getReportsForDatePerTrip]", tripsError.message, { date });
    return [];
  }
  if (!trips?.length) return [];

  const tripIds = trips.map((t) => t.id);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  const passengersByTrip = new Map<string, number>();
  const revenueByTrip = new Map<string, number>();
  const adminFeeByTrip = new Map<string, number>();
  const gcashFeeByTrip = new Map<string, number>();

  for (const b of bookings ?? []) {
    passengersByTrip.set(b.trip_id, (passengersByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
    revenueByTrip.set(b.trip_id, (revenueByTrip.get(b.trip_id) ?? 0) + (b.total_amount_cents ?? 0));
    adminFeeByTrip.set(b.trip_id, (adminFeeByTrip.get(b.trip_id) ?? 0) + (b.admin_fee_cents ?? 0));
    gcashFeeByTrip.set(b.trip_id, (gcashFeeByTrip.get(b.trip_id) ?? 0) + (b.gcash_fee_cents ?? 0));
  }

  return trips.map((t) => {
    const oq = t.online_quota ?? 0;
    const ob = t.online_booked ?? 0;
    const wq = t.walk_in_quota ?? 0;
    const wb = t.walk_in_booked ?? 0;
    const availableSeats = Math.max(0, (oq - ob) + (wq - wb));
    const route = t.route as { display_name?: string; origin?: string; destination?: string } | null;
    const routeName =
      route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
    const boat = t.boat as { name?: string } | null;
    const boatName = boat?.name ?? "—";
    const fuelL = fuelSettings.defaultFuelLitersPerTrip;
    const revenue = revenueByTrip.get(t.id) ?? 0;
    const adminFee = adminFeeByTrip.get(t.id) ?? 0;
    const gcashFee = gcashFeeByTrip.get(t.id) ?? 0;
    const fuelCost = fuelCostCentsFromLiters(fuelL, fuelSettings.fuelPesosPerLiter);
    return {
      tripId: t.id,
      vesselName: boatName,
      departureTime: t.departure_time ?? "—",
      departureDate: t.departure_date ?? date,
      routeName,
      availableSeats,
      passengerBoard: passengersByTrip.get(t.id) ?? t.boarded_count ?? 0,
      revenueCents: revenue,
      adminFeeCents: adminFee,
      gcashFeeCents: gcashFee,
      fuelLiters: fuelL,
      fuelCostCents: fuelCost,
      netRevenueCents: revenue - fuelCost,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily calendar – one row per date for a given month
// ---------------------------------------------------------------------------

export interface DayReportRow {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Feb 1"
  dayOfWeek: string; // e.g. "Sat"
  tripCount: number;
  totalPassengers: number;
  totalRevenueCents: number;
  totalAdminFeeCents: number;
  totalGcashFeeCents: number;
  totalFuelLiters: number;
  totalFuelCostCents: number;
  netRevenueCents: number;
}

/** Per-day summary for a given month (YYYY-MM format). */
export async function getDailyReportForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  yearMonth: string // "YYYY-MM"
): Promise<DayReportRow[]> {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

  const fuelSettings = await getFuelSettings(supabase);

  const { data: trips } = await supabase
    .from("trips")
    .select("id, departure_date")
    .gte("departure_date", start)
    .lte("departure_date", end);

  if (!trips?.length) return buildEmptyDays(year, month, fuelSettings.defaultFuelLitersPerTrip, fuelSettings.fuelPesosPerLiter);

  const tripIds = trips.map((t) => t.id);
  const tripToDate = new Map<string, string>();
  for (const t of trips) {
    if (t.departure_date) tripToDate.set(t.id, t.departure_date);
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  const byDate = new Map<string, {
    tripIds: Set<string>;
    passengers: number;
    revenue: number;
    adminFee: number;
    gcashFee: number;
  }>();

  for (const b of bookings ?? []) {
    const date = tripToDate.get(b.trip_id);
    if (!date) continue;
    const cur = byDate.get(date) ?? { tripIds: new Set(), passengers: 0, revenue: 0, adminFee: 0, gcashFee: 0 };
    cur.tripIds.add(b.trip_id);
    cur.passengers += b.passenger_count ?? 0;
    cur.revenue += b.total_amount_cents ?? 0;
    cur.adminFee += b.admin_fee_cents ?? 0;
    cur.gcashFee += b.gcash_fee_cents ?? 0;
    byDate.set(date, cur);
  }

  // Also count trips with no bookings
  for (const t of trips) {
    if (!t.departure_date) continue;
    const cur = byDate.get(t.departure_date) ?? { tripIds: new Set(), passengers: 0, revenue: 0, adminFee: 0, gcashFee: 0 };
    cur.tripIds.add(t.id);
    byDate.set(t.departure_date, cur);
  }

  const days: DayReportRow[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, "0")}`;
    const jsDate = new Date(year, month - 1, d);
    const label = jsDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const dayOfWeek = jsDate.toLocaleDateString("en-PH", { weekday: "short" });
    const data = byDate.get(dateStr);
    const tripCount = data?.tripIds.size ?? 0;
    const fuelLiters = tripCount * fuelSettings.defaultFuelLitersPerTrip;
    const fuelCostCents = fuelCostCentsFromLiters(fuelLiters, fuelSettings.fuelPesosPerLiter);
    const revenue = data?.revenue ?? 0;
    days.push({
      date: dateStr,
      label,
      dayOfWeek,
      tripCount,
      totalPassengers: data?.passengers ?? 0,
      totalRevenueCents: revenue,
      totalAdminFeeCents: data?.adminFee ?? 0,
      totalGcashFeeCents: data?.gcashFee ?? 0,
      totalFuelLiters: fuelLiters,
      totalFuelCostCents: fuelCostCents,
      netRevenueCents: revenue - fuelCostCents,
    });
  }
  return days;
}

function buildEmptyDays(year: number, month: number, fuelLitersPerTrip: number, fuelPesosPerLiter: number): DayReportRow[] {
  const lastDay = new Date(year, month, 0).getDate();
  const days: DayReportRow[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const jsDate = new Date(year, month - 1, d);
    days.push({
      date: dateStr,
      label: jsDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      dayOfWeek: jsDate.toLocaleDateString("en-PH", { weekday: "short" }),
      tripCount: 0,
      totalPassengers: 0,
      totalRevenueCents: 0,
      totalAdminFeeCents: 0,
      totalGcashFeeCents: 0,
      totalFuelLiters: 0,
      totalFuelCostCents: 0,
      netRevenueCents: 0,
    });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Weekly summary
// ---------------------------------------------------------------------------

export async function getWeeklySummary(): Promise<MonthlySummary> {
  const { start, end } = getWeekStartEndInManila();
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);

  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_date", start)
    .lte("departure_date", end);

  const tripIds = (trips ?? []).map((t) => t.id);
  if (tripIds.length === 0) {
    return { totalPassengers: 0, totalRevenueCents: 0, totalAdminFeeCents: 0, totalGcashFeeCents: 0, totalFuelLiters: 0, totalFuelCostCents: 0, netRevenueCents: 0 };
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  let totalPassengers = 0;
  let totalRevenueCents = 0;
  let totalAdminFeeCents = 0;
  let totalGcashFeeCents = 0;
  for (const b of bookings ?? []) {
    totalPassengers += b.passenger_count ?? 0;
    totalRevenueCents += b.total_amount_cents ?? 0;
    totalAdminFeeCents += b.admin_fee_cents ?? 0;
    totalGcashFeeCents += b.gcash_fee_cents ?? 0;
  }

  const totalFuelLiters = tripIds.length * fuelSettings.defaultFuelLitersPerTrip;
  const totalFuelCostCents = fuelCostCentsFromLiters(totalFuelLiters, fuelSettings.fuelPesosPerLiter);

  return {
    totalPassengers,
    totalRevenueCents,
    totalAdminFeeCents,
    totalGcashFeeCents,
    totalFuelLiters,
    totalFuelCostCents,
    netRevenueCents: totalRevenueCents - totalFuelCostCents,
  };
}

// ---------------------------------------------------------------------------
// Monthly summary
// ---------------------------------------------------------------------------

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
    return { totalPassengers: 0, totalRevenueCents: 0, totalAdminFeeCents: 0, totalGcashFeeCents: 0, totalFuelLiters: 0, totalFuelCostCents: 0, netRevenueCents: 0 };
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  let totalPassengers = 0;
  let totalRevenueCents = 0;
  let totalAdminFeeCents = 0;
  let totalGcashFeeCents = 0;
  for (const b of bookings ?? []) {
    totalPassengers += b.passenger_count ?? 0;
    totalRevenueCents += b.total_amount_cents ?? 0;
    totalAdminFeeCents += b.admin_fee_cents ?? 0;
    totalGcashFeeCents += b.gcash_fee_cents ?? 0;
  }

  const totalFuelLiters = tripIds.length * fuelSettings.defaultFuelLitersPerTrip;
  const totalFuelCostCents = fuelCostCentsFromLiters(totalFuelLiters, fuelSettings.fuelPesosPerLiter);

  return {
    totalPassengers,
    totalRevenueCents,
    totalAdminFeeCents,
    totalGcashFeeCents,
    totalFuelLiters,
    totalFuelCostCents,
    netRevenueCents: totalRevenueCents - totalFuelCostCents,
  };
}

// ---------------------------------------------------------------------------
// Per-vessel breakdowns
// ---------------------------------------------------------------------------

export interface VesselPeriodRow {
  vesselName: string;
  boatId?: string;
  passengers: number;
  revenueCents: number;
  adminFeeCents: number;
  gcashFeeCents: number;
  fuelLiters: number;
  fuelCostCents: number;
  netRevenueCents: number;
}

/** Per-vessel totals for the current week (Mon–Sun), Philippines. */
export async function getWeeklySummaryByVessel(): Promise<VesselPeriodRow[]> {
  const { start, end } = getWeekStartEndInManila();
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);
  return getVesselSummaryForRange(supabase, start, end, fuelSettings);
}

/** Per-vessel totals for the current month, Philippines. */
export async function getMonthlySummaryByVessel(): Promise<VesselPeriodRow[]> {
  const { start, end } = getMonthStartEndInManila();
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);
  return getVesselSummaryForRange(supabase, start, end, fuelSettings);
}

async function getVesselSummaryForRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: string,
  end: string,
  fuelSettings: FuelSettings
): Promise<VesselPeriodRow[]> {
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, boat:boats(name)")
    .gte("departure_date", start)
    .lte("departure_date", end);

  if (!trips?.length) return [];

  const tripIds = trips.map((t) => t.id);
  const tripToVessel = new Map<string, string>();
  const tripToBoatId = new Map<string, string>();
  for (const t of trips) {
    const boat = (t as { boat?: { name?: string } | null }).boat;
    tripToVessel.set(t.id, boat?.name?.trim() ?? "—");
    const bid = (t as { boat_id?: string }).boat_id;
    if (bid) tripToBoatId.set(t.id, bid);
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
    .in("trip_id", tripIds)
    .in("status", PAYMENT_STATUSES);

  const byVessel = new Map<string, {
    boatId: string | undefined;
    tripCount: number;
    passengers: number;
    revenueCents: number;
    adminFeeCents: number;
    gcashFeeCents: number;
  }>();

  // Count trips per vessel for fuel calculation
  for (const t of trips) {
    const vessel = tripToVessel.get(t.id) ?? "—";
    const cur = byVessel.get(vessel) ?? { boatId: tripToBoatId.get(t.id), tripCount: 0, passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    cur.tripCount += 1;
    byVessel.set(vessel, cur);
  }

  for (const b of bookings ?? []) {
    const vessel = tripToVessel.get(b.trip_id) ?? "—";
    const cur = byVessel.get(vessel) ?? { boatId: undefined, tripCount: 0, passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    cur.passengers += b.passenger_count ?? 0;
    cur.revenueCents += b.total_amount_cents ?? 0;
    cur.adminFeeCents += b.admin_fee_cents ?? 0;
    cur.gcashFeeCents += b.gcash_fee_cents ?? 0;
    byVessel.set(vessel, cur);
  }

  return [...byVessel.entries()]
    .map(([vesselName, v]) => {
      const fuelLiters = v.tripCount * fuelSettings.defaultFuelLitersPerTrip;
      const fuelCostCents = fuelCostCentsFromLiters(fuelLiters, fuelSettings.fuelPesosPerLiter);
      return {
        vesselName,
        boatId: v.boatId,
        passengers: v.passengers,
        revenueCents: v.revenueCents,
        adminFeeCents: v.adminFeeCents,
        gcashFeeCents: v.gcashFeeCents,
        fuelLiters,
        fuelCostCents,
        netRevenueCents: v.revenueCents - fuelCostCents,
      };
    })
    .sort((a, b) => a.vesselName.localeCompare(b.vesselName));
}

// ---------------------------------------------------------------------------
// Yearly / Annual analytics
// ---------------------------------------------------------------------------

export interface VesselDayReport {
  boatId: string;
  boatName: string;
  passengerBoard: number;
  availableSeats: number;
  revenueCents: number;
  fuelLiters: number;
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
    revenueByTrip2.set(b.trip_id, (revenueByTrip2.get(b.trip_id) ?? 0) + (b.total_amount_cents ?? 0));
  });

  const byBoat = new Map<string, { board: number; available: number; revenue: number; fuel: number }>();

  for (const t of todayTrips) {
    const bid = t.boat_id;
    const cur = byBoat.get(bid) ?? { board: 0, available: 0, revenue: 0, fuel: 0 };
    cur.board += t.boarded_count ?? 0;
    cur.available += (t.online_quota ?? 0) + (t.walk_in_quota ?? 0) - (t.online_booked ?? 0) - (t.walk_in_booked ?? 0);
    cur.revenue += revenueByTrip2.get(t.id) ?? 0;
    const tripFuel = (t as { fuel_liters_used?: number | null }).fuel_liters_used;
    cur.fuel += typeof tripFuel === "number" && tripFuel >= 0 ? tripFuel : fuelByBoat.get(bid) ?? fuelSettings.defaultFuelLitersPerTrip;
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
  adminFeeCents: number;
  gcashFeeCents: number;
}

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

  const byMonth = new Map<number, { passengers: number; revenueCents: number; adminFeeCents: number; gcashFeeCents: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 });

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const month = tripIdToMonth.get(b.trip_id);
      if (month == null) continue;
      const cur = byMonth.get(month)!;
      cur.passengers += b.passenger_count ?? 0;
      cur.revenueCents += b.total_amount_cents ?? 0;
      cur.adminFeeCents += b.admin_fee_cents ?? 0;
      cur.gcashFeeCents += b.gcash_fee_cents ?? 0;
    }
  }

  return MONTH_NAMES.map((monthName, i) => {
    const m = i + 1;
    const cur = byMonth.get(m) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    return { month: m, monthName, passengers: cur.passengers, revenueCents: cur.revenueCents, adminFeeCents: cur.adminFeeCents, gcashFeeCents: cur.gcashFeeCents };
  });
}

export interface MonthVesselRow {
  month: number;
  monthName: string;
  vesselName: string;
  boatId: string | null;
  passengers: number;
  revenueCents: number;
  adminFeeCents: number;
  gcashFeeCents: number;
}

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
    tripIdToVessel.set(t.id, boat?.name?.trim() || "—");
    const bid = (t as { boat_id?: string }).boat_id;
    if (bid) tripIdToBoatId.set(t.id, bid);
  }

  const byMonthVessel = new Map<string, { passengers: number; revenueCents: number; adminFeeCents: number; gcashFeeCents: number; boatId: string | null }>();
  function key(m: number, v: string) { return `${m}:${v}`; }

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const month = tripIdToMonth.get(b.trip_id);
      const vessel = tripIdToVessel.get(b.trip_id) ?? "—";
      if (month == null) continue;
      const k = key(month, vessel);
      const cur = byMonthVessel.get(k) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0, boatId: null };
      cur.passengers += b.passenger_count ?? 0;
      cur.revenueCents += b.total_amount_cents ?? 0;
      cur.adminFeeCents += b.admin_fee_cents ?? 0;
      cur.gcashFeeCents += b.gcash_fee_cents ?? 0;
      if (cur.boatId == null) cur.boatId = tripIdToBoatId.get(b.trip_id) ?? null;
      byMonthVessel.set(k, cur);
    }
  }

  const byMonthVesselRows: MonthVesselRow[] = [];
  const byMonthAgg = new Map<number, { passengers: number; revenueCents: number; adminFeeCents: number; gcashFeeCents: number }>();
  for (let m = 1; m <= 12; m++) byMonthAgg.set(m, { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 });

  for (let m = 1; m <= 12; m++) {
    const monthName = MONTH_NAMES[m - 1];
    const keysForMonth = [...byMonthVessel.keys()].filter((k) => k.startsWith(`${m}:`));
    for (const k of keysForMonth) {
      const vesselName = k.slice(String(m).length + 1);
      const cur = byMonthVessel.get(k)!;
      if (cur.passengers > 0 || cur.revenueCents > 0) {
        byMonthVesselRows.push({ month: m, monthName, vesselName, boatId: cur.boatId ?? null, passengers: cur.passengers, revenueCents: cur.revenueCents, adminFeeCents: cur.adminFeeCents, gcashFeeCents: cur.gcashFeeCents });
        const agg = byMonthAgg.get(m)!;
        agg.passengers += cur.passengers;
        agg.revenueCents += cur.revenueCents;
        agg.adminFeeCents += cur.adminFeeCents;
        agg.gcashFeeCents += cur.gcashFeeCents;
      }
    }
  }

  byMonthVesselRows.sort((a, b) => a.month - b.month || a.vesselName.localeCompare(b.vesselName));

  const monthly: MonthStat[] = MONTH_NAMES.map((monthName, i) => {
    const m = i + 1;
    const agg = byMonthAgg.get(m) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    return { month: m, monthName, passengers: agg.passengers, revenueCents: agg.revenueCents, adminFeeCents: agg.adminFeeCents, gcashFeeCents: agg.gcashFeeCents };
  });

  return { monthly, byMonthVessel: byMonthVesselRows };
}

// ---------------------------------------------------------------------------
// Operational Expenses
// ---------------------------------------------------------------------------

export interface MonthlyExpenseSummary {
  totalRecurringCents: number;
  totalOneTimeCents: number;
  totalCents: number;
  items: {
    id: string;
    name: string;
    amount_cents: number;
    is_recurring: boolean;
  }[];
}

/**
 * Fetches operational expenses for a given month+year.
 * Includes all recurring expenses + one-time expenses that match the month/year.
 */
export async function getMonthlyExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
  month: number
): Promise<MonthlyExpenseSummary> {
  const { data, error } = await supabase
    .from("operational_expenses")
    .select("id, name, amount_cents, is_recurring, applies_month, applies_year")
    .order("is_recurring", { ascending: false })
    .order("name");

  if (error || !data) {
    return { totalRecurringCents: 0, totalOneTimeCents: 0, totalCents: 0, items: [] };
  }

  const applicable = data.filter((e) => {
    if (e.is_recurring) return true;
    // One-time: must match month and year if specified
    const monthMatch = e.applies_month == null || e.applies_month === month;
    const yearMatch = e.applies_year == null || e.applies_year === year;
    return monthMatch && yearMatch;
  });

  const totalRecurringCents = applicable
    .filter((e) => e.is_recurring)
    .reduce((s, e) => s + e.amount_cents, 0);

  const totalOneTimeCents = applicable
    .filter((e) => !e.is_recurring)
    .reduce((s, e) => s + e.amount_cents, 0);

  return {
    totalRecurringCents,
    totalOneTimeCents,
    totalCents: totalRecurringCents + totalOneTimeCents,
    items: applicable.map((e) => ({
      id: e.id,
      name: e.name,
      amount_cents: e.amount_cents,
      is_recurring: e.is_recurring,
    })),
  };
}