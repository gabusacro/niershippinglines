import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import { VesselOwnerClient } from "./VesselOwnerClient";

export const metadata = {
  title: "Vessel Owner Dashboard",
  description: "Your vessel earnings — Travela Siargao",
};

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function VesselOwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "vessel_owner") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear  = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);
  const todayManila  = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const todayDay     = parseInt(todayManila.slice(8, 10), 10);

  const selectedYear  = parseInt(params.year  ?? String(currentYear),  10);
  const selectedMonth = parseInt(params.month ?? String(currentMonth), 10);

  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
  const isViewingCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isLast5Days = isViewingCurrentMonth && todayDay >= daysInCurrentMonth - 4;

  // Owner's vessel assignments
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
        <p className="mt-2 text-sm text-[#0f766e]">Contact the admin to get your vessel set up.</p>
      </div>
    );
  }

  const monthStr   = String(selectedMonth).padStart(2, "0");
  const monthStart = `${selectedYear}-${monthStr}-01`;
  const lastDay    = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthEnd   = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // All trips this month for owner's vessels
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, departure_time, boat:boats(name), route:routes(display_name, origin, destination)")
    .in("boat_id", myBoatIds)
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd)
    .order("departure_date")
    .order("departure_time");

  const tripIds = (trips ?? []).map((t) => t.id);

  // ── Trip progress counters ──────────────────────────────────────────────
  const completedTripIds = (trips ?? [])
    .filter((t) => t.departure_date < todayManila)
    .map((t) => t.id);
  const todayTripIds = (trips ?? [])
    .filter((t) => t.departure_date === todayManila)
    .map((t) => t.id);
  const upcomingTripIds = (trips ?? [])
    .filter((t) => t.departure_date > todayManila)
    .map((t) => t.id);

  // Bookings with creator profile
  const { data: bookings } = tripIds.length > 0
    ? await supabase
        .from("bookings")
        .select(`
          id, trip_id, reference, booking_source, is_walk_in,
          payment_method, passenger_count, total_amount_cents,
          admin_fee_cents, gcash_fee_cents, customer_full_name,
          status, created_at, created_by,
          creator:profiles!created_by(full_name, role)
        `)
        .in("trip_id", tripIds)
        .in("status", PAID_STATUSES)
        .order("created_at", { ascending: false })
    : { data: [] };

  type BookingLine = {
    id: string; tripId: string; reference: string; isOnline: boolean;
    paymentMethod: string | null; passengerCount: number;
    totalAmountCents: number; netFareCents: number;
    platformFeeCents: number; processingFeeCents: number;
    customerName: string; createdByName: string; createdByRole: string;
    createdAt: string; status: string;
  };

  const bookingLines: BookingLine[] = (bookings ?? []).map((b) => {
    const creator = (b as { creator?: { full_name?: string; role?: string } | null }).creator;
    const isOnline = b.booking_source === "online" && !b.is_walk_in;
    const adminFee = b.admin_fee_cents ?? 0;
    const gcashFee = b.gcash_fee_cents ?? 0;
    const total    = b.total_amount_cents ?? 0;
    const netFare  = isOnline ? total - adminFee - gcashFee : total;
    return {
      id: b.id, tripId: b.trip_id, reference: b.reference ?? "—", isOnline,
      paymentMethod: b.payment_method ?? null,
      passengerCount: b.passenger_count ?? 0,
      totalAmountCents: total, netFareCents: netFare,
      platformFeeCents: adminFee, processingFeeCents: gcashFee,
      customerName: b.customer_full_name ?? "—",
      createdByName: creator?.full_name ?? "Passenger (online)",
      createdByRole: creator?.role ?? "passenger",
      createdAt: b.created_at, status: b.status,
    };
  });

  const bookingsByTrip = new Map<string, BookingLine[]>();
  for (const bl of bookingLines) {
    const arr = bookingsByTrip.get(bl.tripId) ?? [];
    arr.push(bl);
    bookingsByTrip.set(bl.tripId, arr);
  }

  type TripAgg = {
    onlinePax: number; walkInPax: number;
    onlineNetFareCents: number; walkInFareCents: number;
    totalGrossCents: number; platformFeeCents: number; processingFeeCents: number;
  };

  const byTrip = new Map<string, TripAgg>();
  for (const [tripId, lines] of bookingsByTrip) {
    const agg: TripAgg = { onlinePax:0, walkInPax:0, onlineNetFareCents:0, walkInFareCents:0, totalGrossCents:0, platformFeeCents:0, processingFeeCents:0 };
    for (const bl of lines) {
      if (bl.isOnline) {
        agg.onlinePax           += bl.passengerCount;
        agg.onlineNetFareCents  += bl.netFareCents;
        agg.platformFeeCents    += bl.platformFeeCents;
        agg.processingFeeCents  += bl.processingFeeCents;
      } else {
        agg.walkInPax         += bl.passengerCount;
        agg.walkInFareCents   += bl.netFareCents;
      }
      agg.totalGrossCents += bl.netFareCents;
    }
    byTrip.set(tripId, agg);
  }

  // Payment status per trip from trip_fare_payments
  const { data: farePayments } = tripIds.length > 0
    ? await supabase
        .from("trip_fare_payments")
        .select("trip_id, status, payment_method, payment_reference, paid_at, net_payout_cents, gross_fare_cents")
        .in("trip_id", tripIds)
    : { data: [] };

  const paymentByTrip = new Map<string, {
    status: string; method: string | null; reference: string | null;
    paidAt: string | null; netPayoutCents: number; grossFareCents: number;
  }>();
  for (const p of farePayments ?? []) {
    if (p) paymentByTrip.set(p.trip_id, {
      status: p.status,
      method: p.payment_method,
      reference: p.payment_reference,
      paidAt: p.paid_at,
      netPayoutCents: p.net_payout_cents ?? 0,
      grossFareCents: p.gross_fare_cents ?? 0,
    });
  }

  // ── Admin Owes Me calculation ─────────────────────────────────────────────
  // For each PAST trip with online bookings:
  //   - If trip_fare_payments.status = 'paid' → already remitted
  //   - If trip_fare_payments.status = 'pending' or no record → admin still owes
  // Only online bookings count — walk-in cash goes directly to vessel

  type OwedTrip = {
    tripId: string; boatName: string; routeName: string;
    departureDate: string; departureTime: string;
    onlinePax: number; netFareCents: number;
    paymentStatus: "pending" | "paid" | "failed";
    paidAt: string | null;
  };

  const owedTrips: OwedTrip[] = [];
  let totalOwedCents = 0;
  let totalPaidCents = 0;

  for (const t of trips ?? []) {
    // Only count past + today trips (departure already happened or happening today)
    if (t.departure_date > todayManila) continue;

    const agg = byTrip.get(t.id);
    if (!agg || agg.onlineNetFareCents === 0) continue; // no online fare = nothing to owe

    const pay = paymentByTrip.get(t.id);
    const status = (pay?.status ?? "pending") as "pending" | "paid" | "failed";

    const boat  = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;

    owedTrips.push({
      tripId: t.id,
      boatName: boat?.name ?? "—",
      routeName: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
      departureDate: t.departure_date,
      departureTime: t.departure_time,
      onlinePax: agg.onlinePax,
      netFareCents: agg.onlineNetFareCents,
      paymentStatus: status,
      paidAt: pay?.paidAt ?? null,
    });

    if (status === "paid") {
      totalPaidCents += agg.onlineNetFareCents;
    } else {
      totalOwedCents += agg.onlineNetFareCents;
    }
  }

  // Sort: pending first, then paid
  owedTrips.sort((a, b) => {
    if (a.paymentStatus === "pending" && b.paymentStatus !== "pending") return -1;
    if (a.paymentStatus !== "pending" && b.paymentStatus === "pending") return 1;
    return b.departureDate.localeCompare(a.departureDate);
  });

  // Patronage bonus
  const bonusByBoat = new Map<string, number>();
  for (const a of assignments ?? []) {
    let vesselFees = 0;
    for (const t of trips ?? []) {
      if (t.boat_id !== a.boat_id) continue;
      const agg = byTrip.get(t.id);
      if (agg) vesselFees += agg.platformFeeCents + agg.processingFeeCents;
    }
    bonusByBoat.set(a.boat_id, Math.round(vesselFees * (Number(a.patronage_bonus_percent) / 100)));
  }
  const totalPatronageBonus = Math.max(0, [...bonusByBoat.values()].reduce((s, v) => s + v, 0));

  // Month totals
  let monthOnlinePax = 0, monthWalkInPax = 0, monthOnlineNetFare = 0, monthWalkInFare = 0;
  for (const t of trips ?? []) {
    const agg = byTrip.get(t.id);
    if (!agg) continue;
    monthOnlinePax     += agg.onlinePax;
    monthWalkInPax     += agg.walkInPax;
    monthOnlineNetFare += agg.onlineNetFareCents;
    monthWalkInFare    += agg.walkInFareCents;
  }

  const tripRows = (trips ?? []).map((t) => {
    const boat  = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
    const agg   = byTrip.get(t.id) ?? { onlinePax:0, walkInPax:0, onlineNetFareCents:0, walkInFareCents:0, totalGrossCents:0, platformFeeCents:0, processingFeeCents:0 };
    const pay   = paymentByTrip.get(t.id) ?? { status:"pending", method:null, reference:null, paidAt:null, netPayoutCents:0, grossFareCents:0 };
    return {
      id: t.id, boat_id: t.boat_id,
      boatName: boat?.name ?? "—",
      routeName: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
      departureDate: t.departure_date, departureTime: t.departure_time,
      isToday: t.departure_date === todayManila,
      onlinePax: agg.onlinePax, walkInPax: agg.walkInPax,
      onlineNetFareCents: agg.onlineNetFareCents,
      walkInFareCents: agg.walkInFareCents,
      totalGrossCents: agg.totalGrossCents,
      paymentStatus: pay.status as "pending" | "paid" | "failed",
      paymentMethod: pay.method, paymentReference: pay.reference, paidAt: pay.paidAt,
      bookings: bookingsByTrip.get(t.id) ?? [],
    };
  });

  const vesselList = (assignments ?? []).map((a) => {
    const boat = (a as { boat?: { name?: string } | null }).boat;
    return { boatId: a.boat_id, boatName: boat?.name ?? "—", patronagePct: Number(a.patronage_bonus_percent), bonusCents: bonusByBoat.get(a.boat_id) ?? 0 };
  });

  // Next month preview
  type NextMonthPreview = {
    month: number; year: number; monthName: string;
    onlinePax: number; walkInPax: number; tripCount: number; onlineNetFareCents: number;
  } | null;

  let nextMonthPreview: NextMonthPreview = null;
  if (isLast5Days) {
    const MONTH_NAMES_ARR = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const nm = currentMonth === 12 ? 1 : currentMonth + 1;
    const ny = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nmStr = String(nm).padStart(2,"0");
    const { data: nextTrips } = await supabase
      .from("trips").select("id, boat_id")
      .in("boat_id", myBoatIds)
      .gte("departure_date", `${ny}-${nmStr}-01`)
      .lte("departure_date", `${ny}-${nmStr}-${String(new Date(ny, nm, 0).getDate()).padStart(2,"0")}`);
    const nextTripIds = (nextTrips ?? []).map((t) => t.id);
    let nextOnlinePax = 0, nextWalkInPax = 0, nextOnlineNet = 0;
    if (nextTripIds.length > 0) {
      const { data: nextBookings } = await supabase
        .from("bookings")
        .select("trip_id, booking_source, is_walk_in, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
        .in("trip_id", nextTripIds).in("status", PAID_STATUSES);
      for (const b of nextBookings ?? []) {
        const isOnline = b.booking_source === "online" && !b.is_walk_in;
        const pax = b.passenger_count ?? 0;
        if (isOnline) { nextOnlinePax += pax; nextOnlineNet += (b.total_amount_cents??0)-(b.admin_fee_cents??0)-(b.gcash_fee_cents??0); }
        else nextWalkInPax += pax;
      }
    }
    nextMonthPreview = { month:nm, year:ny, monthName:MONTH_NAMES_ARR[nm-1], onlinePax:nextOnlinePax, walkInPax:nextWalkInPax, tripCount:nextTripIds.length, onlineNetFareCents:nextOnlineNet };
  }

  return (
    <VesselOwnerClient
      ownerName={user.fullName ?? "Vessel Owner"}
      vessels={vesselList}
      tripRows={tripRows}
      todayTripIds={todayTripIds}
      completedTripCount={completedTripIds.length}
      todayTripCount={todayTripIds.length}
      upcomingTripCount={upcomingTripIds.length}
      totalTripCount={(trips ?? []).length}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      currentYear={currentYear}
      currentMonth={currentMonth}
      monthTotals={{ onlinePax: monthOnlinePax, walkInPax: monthWalkInPax, onlineNetFareCents: monthOnlineNetFare, walkInFareCents: monthWalkInFare }}
      totalPatronageBonusCents={totalPatronageBonus}
      nextMonthPreview={nextMonthPreview}
      owedTrips={owedTrips}
      totalOwedCents={totalOwedCents}
      totalPaidCents={totalPaidCents}
    />
  );
}
