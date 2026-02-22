import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Vessel Owner Dashboard",
  description: "Your vessel earnings and patronage bonus — Travela Siargao",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default async function VesselOwnerDashboard() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "vessel_owner") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);
  const todayManila = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // Get this owner's vessel assignments
  const { data: assignments } = await supabase
    .from("vessel_assignments")
    .select("id, boat_id, patronage_bonus_percent, boat:boats(id, name)")
    .eq("vessel_owner_id", user.id);

  const myBoatIds = (assignments ?? []).map((a) => a.boat_id);

  if (myBoatIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-4xl">🚢</p>
        <h1 className="mt-4 text-xl font-bold text-[#134e4a]">No vessel assigned yet</h1>
        <p className="mt-2 text-sm text-[#0f766e]">Your vessel assignment is being set up. Please contact the admin.</p>
      </div>
    );
  }

  // Get fuel settings
  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("default_fuel_liters_per_trip, fuel_pesos_per_liter")
    .eq("id", 1)
    .maybeSingle();
  const fuelLitersPerTrip = appSettings?.default_fuel_liters_per_trip ?? 50;
  const fuelPesosPerLiter = Number(appSettings?.fuel_pesos_per_liter ?? 61.40);
  const fuelCostPerTrip = Math.round(fuelLitersPerTrip * fuelPesosPerLiter * 100);

  // Month date range
  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Get this month's trips for owner's vessels
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
        .select("trip_id, passenger_count, total_amount_cents")
        .in("trip_id", tripIds)
        .in("status", PAYMENT_STATUSES)
    : { data: [] };

  // Aggregate by trip
  const bookingsByTrip = new Map<string, { passengers: number; revenueCents: number }>();
  for (const b of bookings ?? []) {
    const cur = bookingsByTrip.get(b.trip_id) ?? { passengers: 0, revenueCents: 0 };
    cur.passengers += b.passenger_count ?? 0;
    cur.revenueCents += b.total_amount_cents ?? 0;
    bookingsByTrip.set(b.trip_id, cur);
  }

  // Month totals
  let monthPassengers = 0, monthRevenue = 0, monthFuelCost = 0;
  for (const t of trips ?? []) {
    const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0 };
    monthPassengers += b.passengers;
    monthRevenue += b.revenueCents;
    monthFuelCost += fuelCostPerTrip;
  }
  const monthNet = monthRevenue - monthFuelCost;

  // Today's trips
  const todayTrips = (trips ?? []).filter((t) => t.departure_date === todayManila);

  // Platform revenue for patronage bonus calculation
  // Get all platform admin+gcash fees this month (from all vessels, not just owner's)
  const { data: allTripsThisMonth } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);

  const allTripIds = (allTripsThisMonth ?? []).map((t) => t.id);
  let totalAdminFeeCents = 0, totalGcashFeeCents = 0;
  if (allTripIds.length > 0) {
    const { data: allBookings } = await supabase
      .from("bookings")
      .select("admin_fee_cents, gcash_fee_cents")
      .in("trip_id", allTripIds)
      .in("status", PAYMENT_STATUSES);
    for (const b of allBookings ?? []) {
      totalAdminFeeCents += b.admin_fee_cents ?? 0;
      totalGcashFeeCents += b.gcash_fee_cents ?? 0;
    }
  }

  const grossPlatformRevenue = totalAdminFeeCents + totalGcashFeeCents;
  const monthlyExpenses = await getMonthlyExpenses(supabase, currentYear, currentMonth);
  const netPlatformRevenue = grossPlatformRevenue - monthlyExpenses.totalCents;

  // Calculate patronage bonus for each vessel
  const bonusByBoat = new Map<string, number>();
  for (const a of assignments ?? []) {
    const bonusCents = Math.round(netPlatformRevenue * (Number(a.patronage_bonus_percent) / 100));
    bonusByBoat.set(a.boat_id, bonusCents);
  }
  const totalPatronageBonus = [...bonusByBoat.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Vessel Owner Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold">{user.fullName ?? "Vessel Owner"}</h1>
        <p className="mt-1 text-sm text-white/80">
          {(assignments ?? []).map((a) => {
            const boat = (a as { boat?: { name?: string } | null }).boat;
            return boat?.name ?? "—";
          }).join(", ")} · {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>
      </div>

      {/* Summary cards — vessel owner sees fare/fuel/net ONLY, no platform fees */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Trips This Month</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{(trips ?? []).length}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Passengers</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{monthPassengers.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Gross Fare</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{peso(monthRevenue)}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Net (Fare−Fuel)</p>
          <p className={`mt-1.5 text-2xl font-bold ${monthNet < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(monthNet)}</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/70">Fuel: {peso(monthFuelCost)}</p>
        </div>
      </div>

      {/* Patronage Bonus card */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">🎁 Patronage Bonus — {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
        <p className="mt-1 text-xs text-amber-700">Your share of the net platform revenue pool for bringing passengers to Travela Siargao.</p>
        <div className="mt-4 space-y-2">
          {(assignments ?? []).map((a) => {
            const boat = (a as { boat?: { name?: string } | null }).boat;
            const bonus = bonusByBoat.get(a.boat_id) ?? 0;
            return (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-sm text-amber-800">🚢 {boat?.name ?? "—"} ({a.patronage_bonus_percent}% of pool)</span>
                <span className={`text-lg font-bold ${bonus < 0 ? "text-red-500" : "text-amber-800"}`}>{peso(bonus)}</span>
              </div>
            );
          })}
        </div>
        {netPlatformRevenue < 0 && (
          <p className="mt-3 text-xs text-amber-600">⚠ Net platform revenue is negative this month (expenses exceed fees collected). Bonus will be ₱0 or adjusted once revenue recovers.</p>
        )}
        <div className="mt-3 border-t border-amber-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-900">Total Patronage Bonus</span>
          <span className={`text-xl font-bold ${totalPatronageBonus < 0 ? "text-red-600" : "text-amber-900"}`}>{peso(Math.max(0, totalPatronageBonus))}</span>
        </div>
      </div>

      {/* Today's trips */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-[#134e4a]">Today's trips — {todayManila}</h2>
        {todayTrips.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No trips today.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {todayTrips.map((t) => {
                  const boat = (t as { boat?: { name?: string } | null }).boat;
                  const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
                  const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
                  const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0 };
                  const net = b.revenueCents - fuelCostPerTrip;
                  return (
                    <tr key={t.id} className="hover:bg-teal-50/40">
                      <td className="px-4 py-2 font-medium text-[#134e4a]">{boat?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-[#134e4a]">{formatTime(t.departure_time)}</td>
                      <td className="px-4 py-2 text-[#134e4a]">{routeName}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{b.passengers}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{b.revenueCents > 0 ? peso(b.revenueCents) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2 text-right text-red-600">{peso(fuelCostPerTrip)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${net < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* This month's trips */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-[#134e4a]">All trips — {MONTH_NAMES[currentMonth - 1]} {currentYear}</h2>
        {(trips ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No trips this month yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Passengers</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {(trips ?? []).map((t) => {
                  const boat = (t as { boat?: { name?: string } | null }).boat;
                  const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
                  const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
                  const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0 };
                  const net = b.revenueCents - fuelCostPerTrip;
                  const isToday = t.departure_date === todayManila;
                  return (
                    <tr key={t.id} className={`${isToday ? "bg-teal-50/60" : "hover:bg-teal-50/30"}`}>
                      <td className="px-4 py-2 text-[#134e4a]">
                        {new Date(t.departure_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        {isToday && <span className="ml-1.5 rounded-full bg-[#0c7b93]/10 px-1.5 py-0.5 text-xs text-[#0c7b93]">today</span>}
                      </td>
                      <td className="px-4 py-2 font-medium text-[#134e4a]">{boat?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-[#134e4a]">{formatTime(t.departure_time)}</td>
                      <td className="px-4 py-2 text-[#134e4a]">{routeName}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{b.passengers}</td>
                      <td className="px-4 py-2 text-right text-[#134e4a]">{b.revenueCents > 0 ? peso(b.revenueCents) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2 text-right text-red-600">{peso(fuelCostPerTrip)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${net < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#134e4a]/5 font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-[#134e4a]">Month Total</td>
                  <td className="px-4 py-2 text-right text-[#134e4a]">{monthPassengers}</td>
                  <td className="px-4 py-2 text-right text-[#134e4a]">{peso(monthRevenue)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{peso(monthFuelCost)}</td>
                  <td className={`px-4 py-2 text-right ${monthNet < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(monthNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link href={ROUTES.dashboard} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
