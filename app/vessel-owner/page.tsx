import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import { VesselOwnerClient } from "./VesselOwnerClient";

export const metadata = {
  title: "Vessel Owner Dashboard",
  description: "Your vessel earnings and patronage bonus — Travela Siargao",
};

export const dynamic = "force-dynamic";

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function VesselOwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; vessel?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "vessel_owner") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);
  const todayManila = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const selectedYear = parseInt(params.year ?? String(currentYear), 10);
  const selectedMonth = parseInt(params.month ?? String(currentMonth), 10);

  // Get owner's vessel assignments
  const { data: assignments } = await supabase
    .from("vessel_assignments")
    .select("id, boat_id, patronage_bonus_percent, boat:boats(id, name)")
    .eq("vessel_owner_id", user.id);

  const myBoatIds = (assignments ?? []).map((a) => a.boat_id);

  if (myBoatIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🚢</p>
        <h1 className="mt-4 text-xl font-bold text-[#134e4a]">No vessel assigned yet</h1>
        <p className="mt-2 text-sm text-[#0f766e]">Your vessel assignment is being set up. Please contact the admin.</p>
      </div>
    );
  }

  // Fuel settings
  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("default_fuel_liters_per_trip, fuel_pesos_per_liter")
    .eq("id", 1)
    .maybeSingle();
  const fuelLitersPerTrip = appSettings?.default_fuel_liters_per_trip ?? 50;
  const fuelPesosPerLiter = Number(appSettings?.fuel_pesos_per_liter ?? 61.40);
  const fuelCostPerTrip = Math.round(fuelLitersPerTrip * fuelPesosPerLiter * 100);

  // Selected month range
  const monthStr = String(selectedMonth).padStart(2, "0");
  const monthStart = `${selectedYear}-${monthStr}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Get trips for owner's vessels in selected month
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, departure_time, boat:boats(name), route:routes(display_name, origin, destination)")
    .in("boat_id", myBoatIds)
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd)
    .order("departure_date")
    .order("departure_time");

  const tripIds = (trips ?? []).map((t) => t.id);

  // Get bookings for those trips
  const { data: bookings } = tripIds.length > 0
    ? await supabase
        .from("bookings")
        .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
        .in("trip_id", tripIds)
        .in("status", PAYMENT_STATUSES)
    : { data: [] };

  // Aggregate by trip
  type TripAgg = { passengers: number; grossFareCents: number; platformFeeCents: number; paymentProcessingCents: number };
  const byTrip = new Map<string, TripAgg>();
  for (const b of bookings ?? []) {
    const cur = byTrip.get(b.trip_id) ?? { passengers: 0, grossFareCents: 0, platformFeeCents: 0, paymentProcessingCents: 0 };
    cur.passengers += b.passenger_count ?? 0;
    cur.grossFareCents += b.total_amount_cents ?? 0;
    cur.platformFeeCents += b.admin_fee_cents ?? 0;
    cur.paymentProcessingCents += b.gcash_fee_cents ?? 0;
    byTrip.set(b.trip_id, cur);
  }

  // Get payment status for trips
  const { data: farePayments } = tripIds.length > 0
    ? await supabase
        .from("trip_fare_payments")
        .select("trip_id, status, payment_method, payment_reference, paid_at, gross_fare_cents, platform_fee_cents, payment_processing_cents, net_payout_cents")
        .in("trip_id", tripIds)
    : { data: [] };

    type FarePayment = {
      trip_id: string;
      status: string;
      payment_method: string | null;
      payment_reference: string | null;
      paid_at: string | null;
      gross_fare_cents: number;
      platform_fee_cents: number;
      payment_processing_cents: number;
      net_payout_cents: number;
    };
    
    const paymentByTrip = new Map<string, FarePayment>();
  for (const p of farePayments ?? []) {
    if (p) paymentByTrip.set(p.trip_id, p);
  }

  // Patronage bonus: 5% of THIS vessel's own platform fees
  const bonusByBoat = new Map<string, number>();
  for (const a of assignments ?? []) {
    // Get platform fees from bookings of THIS vessel's trips only
    let vesselPlatformFee = 0;
    let vesselPaymentProcessingFee = 0;
    for (const t of trips ?? []) {
      if (t.boat_id !== a.boat_id) continue;
      const agg = byTrip.get(t.id);
      if (agg) {
        vesselPlatformFee += agg.platformFeeCents;
        vesselPaymentProcessingFee += agg.paymentProcessingCents;
      }
    }
    const totalVesselPlatformRevenue = vesselPlatformFee + vesselPaymentProcessingFee;
    const bonusCents = Math.round(totalVesselPlatformRevenue * (Number(a.patronage_bonus_percent) / 100));
    bonusByBoat.set(a.boat_id, bonusCents);
  }
  const totalPatronageBonus = Math.max(0, [...bonusByBoat.values()].reduce((s, v) => s + v, 0));

  // Month totals
  let monthPassengers = 0, monthGrossFare = 0, monthPlatformFee = 0, monthPaymentProcessing = 0, monthFuelCost = 0;
  for (const t of trips ?? []) {
    const agg = byTrip.get(t.id) ?? { passengers: 0, grossFareCents: 0, platformFeeCents: 0, paymentProcessingCents: 0 };
    monthPassengers += agg.passengers;
    monthGrossFare += agg.grossFareCents;
    monthPlatformFee += agg.platformFeeCents;
    monthPaymentProcessing += agg.paymentProcessingCents;
    monthFuelCost += fuelCostPerTrip;
  }
  const monthNet = monthGrossFare - monthFuelCost;

  // Today's trips
  const todayTrips = (trips ?? []).filter((t) => t.departure_date === todayManila);

  // Build serializable trip rows
  const tripRows = (trips ?? []).map((t) => {
    const boat = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
    const agg = byTrip.get(t.id) ?? { passengers: 0, grossFareCents: 0, platformFeeCents: 0, paymentProcessingCents: 0 };
    const payment = paymentByTrip.get(t.id) ?? null;
    return {
      id: t.id,
      boat_id: t.boat_id,
      boatName: boat?.name ?? "—",
      routeName: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
      departureDate: t.departure_date,
      departureTime: t.departure_time,
      passengers: agg.passengers,
      grossFareCents: agg.grossFareCents,
      platformFeeCents: agg.platformFeeCents,
      paymentProcessingCents: agg.paymentProcessingCents,
      fuelCostCents: fuelCostPerTrip,
      netRevCents: agg.grossFareCents - fuelCostPerTrip,
      isToday: t.departure_date === todayManila,
      paymentStatus: (payment?.status ?? "pending") as "pending" | "paid" | "failed",
      paymentMethod: payment?.payment_method ?? null,
      paymentReference: payment?.payment_reference ?? null,
      paidAt: payment?.paid_at ?? null,
    };
  });

  const vesselList = (assignments ?? []).map((a) => {
    const boat = (a as { boat?: { name?: string } | null }).boat;
    return {
      boatId: a.boat_id,
      boatName: boat?.name ?? "—",
      patronagePct: Number(a.patronage_bonus_percent),
      bonusCents: bonusByBoat.get(a.boat_id) ?? 0,
    };
  });

  return (
    <VesselOwnerClient
      ownerName={user.fullName ?? "Vessel Owner"}
      vessels={vesselList}
      tripRows={tripRows}
      todayTripIds={todayTrips.map((t) => t.id)}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      currentYear={currentYear}
      currentMonth={currentMonth}
      todayManila={todayManila}
      monthTotals={{
        passengers: monthPassengers,
        grossFareCents: monthGrossFare,
        platformFeeCents: monthPlatformFee,
        paymentProcessingCents: monthPaymentProcessing,
        fuelCostCents: monthFuelCost,
        netCents: monthNet,
      }}
      totalPatronageBonusCents={totalPatronageBonus}
    />
  );
}
