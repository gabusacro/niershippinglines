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

  // Are we viewing the current month AND in the last 5 days?
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

  // Trips this month for owner's vessels only
  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, departure_time, boat:boats(name), route:routes(display_name, origin, destination)")
    .in("boat_id", myBoatIds)
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd)
    .order("departure_date")
    .order("departure_time");

  const tripIds = (trips ?? []).map((t) => t.id);

  // Bookings with creator profile
  const { data: bookings } = tripIds.length > 0
    ? await supabase
        .from("bookings")
        .select(`
          id,
          trip_id,
          reference,
          booking_source,
          is_walk_in,
          payment_method,
          passenger_count,
          total_amount_cents,
          admin_fee_cents,
          gcash_fee_cents,
          customer_full_name,
          status,
          created_at,
          created_by,
          creator:profiles!created_by(full_name, role)
        `)
        .in("trip_id", tripIds)
        .in("status", PAID_STATUSES)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Build booking lines
  type BookingLine = {
    id: string;
    tripId: string;
    reference: string;
    isOnline: boolean;
    paymentMethod: string | null;
    passengerCount: number;
    totalAmountCents: number;
    netFareCents: number;
    platformFeeCents: number;
    processingFeeCents: number;
    customerName: string;
    createdByName: string;
    createdByRole: string;
    createdAt: string;
    status: string;
  };

  const bookingLines: BookingLine[] = (bookings ?? []).map((b) => {
    const creator = (b as { creator?: { full_name?: string; role?: string } | null }).creator;
    const isOnline = b.booking_source === "online" && !b.is_walk_in;
    const createdByRole = creator?.role ?? "passenger";
    const createdByName = creator?.full_name ?? "Passenger (online)";
    const adminFee = b.admin_fee_cents ?? 0;
    const gcashFee = b.gcash_fee_cents ?? 0;
    const total = b.total_amount_cents ?? 0;
    const netFare = isOnline ? total - adminFee - gcashFee : total;
    return {
      id: b.id, tripId: b.trip_id, reference: b.reference ?? "—", isOnline,
      paymentMethod: b.payment_method ?? null,
      passengerCount: b.passenger_count ?? 0,
      totalAmountCents: total, netFareCents: netFare,
      platformFeeCents: adminFee, processingFeeCents: gcashFee,
      customerName: b.customer_full_name ?? "—",
      createdByName, createdByRole, createdAt: b.created_at, status: b.status,
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
    totalGrossCents: number;
    platformFeeCents: number; processingFeeCents: number;
  };

  const byTrip = new Map<string, TripAgg>();
  for (const [tripId, lines] of bookingsByTrip) {
    const agg: TripAgg = { onlinePax: 0, walkInPax: 0, onlineNetFareCents: 0, walkInFareCents: 0, totalGrossCents: 0, platformFeeCents: 0, processingFeeCents: 0 };
    for (const bl of lines) {
      if (bl.isOnline) {
        agg.onlinePax += bl.passengerCount;
        agg.onlineNetFareCents += bl.netFareCents;
        agg.platformFeeCents += bl.platformFeeCents;
        agg.processingFeeCents += bl.processingFeeCents;
      } else {
        agg.walkInPax += bl.passengerCount;
        agg.walkInFareCents += bl.netFareCents;
      }
      agg.totalGrossCents += bl.netFareCents;
    }
    byTrip.set(tripId, agg);
  }

  // Payment status per trip
  const { data: farePayments } = tripIds.length > 0
    ? await supabase.from("trip_fare_payments").select("trip_id, status, payment_method, payment_reference, paid_at").in("trip_id", tripIds)
    : { data: [] };

  const paymentByTrip = new Map<string, { status: string; method: string | null; reference: string | null; paidAt: string | null }>();
  for (const p of farePayments ?? []) {
    if (p) paymentByTrip.set(p.trip_id, { status: p.status, method: p.payment_method, reference: p.payment_reference, paidAt: p.paid_at });
  }

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

  const todayTripIds = (trips ?? []).filter((t) => t.departure_date === todayManila).map((t) => t.id);

  const tripRows = (trips ?? []).map((t) => {
    const boat  = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
    const agg   = byTrip.get(t.id) ?? { onlinePax: 0, walkInPax: 0, onlineNetFareCents: 0, walkInFareCents: 0, totalGrossCents: 0, platformFeeCents: 0, processingFeeCents: 0 };
    const pay   = paymentByTrip.get(t.id) ?? { status: "pending", method: null, reference: null, paidAt: null };
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

  // ── Next month preview (only fetched in last 5 days of current month) ──
  type NextMonthPreview = {
    month: number; year: number; monthName: string;
    onlinePax: number; walkInPax: number;
    tripCount: number; onlineNetFareCents: number;
  } | null;

  let nextMonthPreview: NextMonthPreview = null;

  if (isLast5Days) {
    const MONTH_NAMES_ARR = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear  = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthStr   = String(nextMonth).padStart(2, "0");
    const nextMonthStart = `${nextYear}-${nextMonthStr}-01`;
    const nextLastDay    = new Date(nextYear, nextMonth, 0).getDate();
    const nextMonthEnd   = `${nextYear}-${nextMonthStr}-${String(nextLastDay).padStart(2, "0")}`;

    const { data: nextTrips } = await supabase
      .from("trips")
      .select("id, boat_id")
      .in("boat_id", myBoatIds)
      .gte("departure_date", nextMonthStart)
      .lte("departure_date", nextMonthEnd);

    const nextTripIds = (nextTrips ?? []).map((t) => t.id);

    if (nextTripIds.length > 0) {
      const { data: nextBookings } = await supabase
        .from("bookings")
        .select("trip_id, booking_source, is_walk_in, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
        .in("trip_id", nextTripIds)
        .in("status", PAID_STATUSES);

      let nextOnlinePax = 0, nextWalkInPax = 0, nextOnlineNet = 0;
      for (const b of nextBookings ?? []) {
        const isOnline = b.booking_source === "online" && !b.is_walk_in;
        const pax = b.passenger_count ?? 0;
        if (isOnline) {
          nextOnlinePax += pax;
          nextOnlineNet += (b.total_amount_cents ?? 0) - (b.admin_fee_cents ?? 0) - (b.gcash_fee_cents ?? 0);
        } else {
          nextWalkInPax += pax;
        }
      }

      nextMonthPreview = {
        month: nextMonth, year: nextYear,
        monthName: MONTH_NAMES_ARR[nextMonth - 1],
        onlinePax: nextOnlinePax,
        walkInPax: nextWalkInPax,
        tripCount: nextTripIds.length,
        onlineNetFareCents: nextOnlineNet,
      };
    } else {
      // Still show the preview card even with 0 bookings so owner knows next month exists
      const MONTH_NAMES_ARR = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const nextMonth2 = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear2  = currentMonth === 12 ? currentYear + 1 : currentYear;
      nextMonthPreview = {
        month: nextMonth2, year: nextYear2,
        monthName: MONTH_NAMES_ARR[nextMonth2 - 1],
        onlinePax: 0, walkInPax: 0, tripCount: 0, onlineNetFareCents: 0,
      };
    }
  }

  return (
    <VesselOwnerClient
      ownerName={user.fullName ?? "Vessel Owner"}
      vessels={vesselList}
      tripRows={tripRows}
      todayTripIds={todayTripIds}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      currentYear={currentYear}
      currentMonth={currentMonth}
      monthTotals={{ onlinePax: monthOnlinePax, walkInPax: monthWalkInPax, onlineNetFareCents: monthOnlineNetFare, walkInFareCents: monthWalkInFare }}
      totalPatronageBonusCents={totalPatronageBonus}
      nextMonthPreview={nextMonthPreview}
    />
  );
}
