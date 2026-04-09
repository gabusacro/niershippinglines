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
// Refund statuses that mean money is committed to be returned — exclude from all revenue
const EXCLUDE_REFUND = '("approved","processed")';

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

  const todayManila  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const currentYear  = parseInt(todayManila.slice(0, 4), 10);
  const currentMonth = parseInt(todayManila.slice(5, 7), 10);
  const todayDay     = parseInt(todayManila.slice(8, 10), 10);

  const selectedYear  = parseInt(params.year  ?? String(currentYear),  10);
  const selectedMonth = parseInt(params.month ?? String(currentMonth), 10);

  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
  const isViewingCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isLast5Days = isViewingCurrentMonth && todayDay >= daysInCurrentMonth - 4;

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = profile?.avatar_url ?? null;

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

  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id, departure_date, departure_time, boat:boats(name), route:routes(display_name, origin, destination)")
    .in("boat_id", myBoatIds)
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd)
    .order("departure_date")
    .order("departure_time");

  const tripIds = (trips ?? []).map((t) => t.id);

  // ── Fetch refunded bookings for this month (accountability) ────────────────
  let refundedBookings: {
    reference: string;
    customer_full_name: string;
    total_amount_cents: number;
    passenger_count: number;
    is_walk_in: boolean;
    booking_source: string | null;
    trip_id: string;
    refund_status: string | null;
  }[] = [];

  if (tripIds.length > 0) {
    const { data: rb } = await supabase
      .from("bookings")
      .select("reference, customer_full_name, total_amount_cents, passenger_count, is_walk_in, booking_source, trip_id, refund_status")
      .in("trip_id", tripIds)
      .in("refund_status", ["approved", "processed"]);
    refundedBookings = (rb ?? []) as typeof refundedBookings;
  }

  // Build refund rows with trip info
  const tripInfoMap = new Map<string, { departure_date: string; departure_time: string; route_name: string; boat_name: string }>();
  for (const t of trips ?? []) {
    const boat  = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
    tripInfoMap.set(t.id, {
      departure_date: t.departure_date,
      departure_time: t.departure_time,
      boat_name:  boat?.name ?? "—",
      route_name: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
    });
  }

  const refundRows = refundedBookings.map(b => ({
    reference:          b.reference,
    customer_full_name: b.customer_full_name,
    total_amount_cents: b.total_amount_cents,
    passenger_count:    b.passenger_count,
    is_walk_in:         b.is_walk_in,
    booking_source:     b.booking_source,
    refund_status:      b.refund_status,
    departure_date:     tripInfoMap.get(b.trip_id)?.departure_date ?? "",
    departure_time:     tripInfoMap.get(b.trip_id)?.departure_time ?? "",
    boat_name:          tripInfoMap.get(b.trip_id)?.boat_name ?? "—",
    route_name:         tripInfoMap.get(b.trip_id)?.route_name ?? "—",
  }));

  const refundTotalCents  = refundRows.reduce((s, r) => s + r.total_amount_cents, 0);
  const refundOnlineCents = refundRows.filter(r => !r.is_walk_in).reduce((s, r) => s + r.total_amount_cents, 0);
  const refundCashCents   = refundRows.filter(r =>  r.is_walk_in).reduce((s, r) => s + r.total_amount_cents, 0);

  const completedTripIds = (trips ?? []).filter((t) => t.departure_date < todayManila).map((t) => t.id);
  const todayTripIds     = (trips ?? []).filter((t) => t.departure_date === todayManila).map((t) => t.id);
  const upcomingTripIds  = (trips ?? []).filter((t) => t.departure_date > todayManila).map((t) => t.id);

  // ── Main bookings query — excludes approved/processed refunds ─────────────
  const { data: bookings } = tripIds.length > 0
    ? await supabase
        .from("bookings")
        .select(`
          id, trip_id, reference, booking_source, is_walk_in,
          payment_method, passenger_count, total_amount_cents,
          admin_fee_cents, gcash_fee_cents, customer_full_name,
          fare_type, passenger_details,
          status, created_at, created_by,
          creator:profiles!created_by(full_name, role)
        `)
        .in("trip_id", tripIds)
        .in("status", PAID_STATUSES)
        .not("refund_status", "in", EXCLUDE_REFUND)
        .order("created_at", { ascending: false })
    : { data: [] };

  type PassengerDetail = {
    fare_type: string; full_name: string;
    gender?: string | null; address?: string | null;
    birthdate?: string | null; nationality?: string | null; ticket_number?: string | null;
  };

  type BookingLine = {
    id: string; tripId: string; reference: string; isOnline: boolean;
    paymentMethod: string | null; passengerCount: number;
    totalAmountCents: number; netFareCents: number;
    platformFeeCents: number; processingFeeCents: number;
    customerName: string; createdByName: string; createdByRole: string;
    bookingSource: string | null; createdAt: string; status: string;
    passengerDetails: PassengerDetail[] | null; fareType: string;
  };

  const bookingLines: BookingLine[] = (bookings ?? []).map((b) => {
    const creator = (b as { creator?: { full_name?: string; role?: string } | null }).creator;
    const bx = b as { booking_source?: string | null; fare_type?: string | null; passenger_details?: PassengerDetail[] | null };
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
      bookingSource: bx.booking_source ?? null,
      createdAt: b.created_at, status: b.status,
      passengerDetails: Array.isArray(bx.passenger_details) ? bx.passenger_details : null,
      fareType: bx.fare_type ?? "adult",
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
        agg.onlinePax          += bl.passengerCount;
        agg.onlineNetFareCents += bl.netFareCents;
        agg.platformFeeCents   += bl.platformFeeCents;
        agg.processingFeeCents += bl.processingFeeCents;
      } else {
        agg.walkInPax       += bl.passengerCount;
        agg.walkInFareCents += bl.netFareCents;
      }
      agg.totalGrossCents += bl.netFareCents;
    }
    byTrip.set(tripId, agg);
  }

  const { data: farePayments } = tripIds.length > 0
    ? await supabase
        .from("trip_fare_payments")
.select("trip_id, status, payment_method, payment_reference, paid_at, net_payout_cents, gross_fare_cents, owner_acknowledged")
        .in("trip_id", tripIds)
    : { data: [] };

const paymentByTrip = new Map<string, {
  status: string;
  method: string | null;
  reference: string | null;
  paidAt: string | null;
  netPayoutCents: number;
  grossFareCents: number;
  ownerAcknowledged: boolean;

  
  }>();
for (const p of farePayments ?? []) {
  if (p) paymentByTrip.set(p.trip_id, {
    status: p.status,
    method: p.payment_method,
    reference: p.payment_reference,
    paidAt: p.paid_at,
    netPayoutCents: p.net_payout_cents ?? 0,
    grossFareCents: p.gross_fare_cents ?? 0,
    ownerAcknowledged: p.owner_acknowledged ?? false,
  });
}

type OwedTrip = {
  tripId: string;
  boatName: string;
  routeName: string;
  departureDate: string;
  departureTime: string;
  onlinePax: number;
  netFareCents: number;
  paymentStatus: "pending" | "paid" | "failed";
  paidAt: string | null;
  ownerAcknowledged: boolean; // ✅ ADD THIS HERE
};

  const owedTrips: OwedTrip[] = [];
  let totalOwedCents = 0;
  let totalPaidCents = 0;

  for (const t of trips ?? []) {
    if (t.departure_date > todayManila) continue;
    const agg = byTrip.get(t.id);
    if (!agg || agg.onlineNetFareCents === 0) continue;
    const pay = paymentByTrip.get(t.id);
    const status = (pay?.status ?? "pending") as "pending" | "paid" | "failed";
    const boat  = (t as { boat?: { name?: string } | null }).boat;
    const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
    owedTrips.push({
      tripId: t.id,
      boatName: boat?.name ?? "—",
      routeName: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
      departureDate: t.departure_date, departureTime: t.departure_time,
      onlinePax: agg.onlinePax, netFareCents: agg.onlineNetFareCents,
      paymentStatus: status, paidAt: pay?.paidAt ?? null,
      ownerAcknowledged: pay?.ownerAcknowledged ?? false,
    });
    if (status === "paid") totalPaidCents += agg.onlineNetFareCents;
    else totalOwedCents += agg.onlineNetFareCents;
  }

  owedTrips.sort((a, b) => {
    if (a.paymentStatus === "pending" && b.paymentStatus !== "pending") return -1;
    if (a.paymentStatus !== "pending" && b.paymentStatus === "pending") return 1;
    return b.departureDate.localeCompare(a.departureDate);
  });

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
      onlineNetFareCents: agg.onlineNetFareCents, walkInFareCents: agg.walkInFareCents,
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
        .in("trip_id", nextTripIds)
        .in("status", PAID_STATUSES)
        // Also exclude refunds from next month preview
        .not("refund_status", "in", EXCLUDE_REFUND);
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
      avatarUrl={avatarUrl}
      vessels={vesselList}
      tripRows={tripRows}
      refundRows={refundRows}
      refundTotalCents={refundTotalCents}
      refundOnlineCents={refundOnlineCents}
      refundCashCents={refundCashCents}
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
