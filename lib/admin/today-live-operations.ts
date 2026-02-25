import { createClient } from "@/lib/supabase/server";
import { getTodayInManila } from "./ph-time";

export type TripLiveRow = {
  trip_id: string;
  boat_id: string;
  boat_name: string;
  route_origin: string;
  route_destination: string;
  departure_time: string;
  trip_status: string;
  slot_label: string | null;
  // booking counts
  total_bookings: number;
  total_passengers: number;
  online_bookings: number;
  confirmed: number;
  checked_in: number;
  boarded: number;
  revenue_cents: number;
  refund_requests: number;
  // passenger list (for modal)
  passengers: {
    booking_id: string;
    reference: string;
    passenger_name: string;
    passenger_count: number;
    status: string;
    booking_source: string | null;
    total_amount_cents: number;
  }[];
  // refund requests (for modal)
  refunds: {
    refund_id: string;
    booking_reference: string;
    requested_by_name: string | null;
    amount_cents: number;
    status: string;
    policy_basis: string | null;
  }[];
};

export async function getTodayLiveOperations(): Promise<TripLiveRow[]> {
  const supabase = await createClient();
  const today = getTodayInManila();

  // Fetch today's trips with boat + route
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(`
      id, boat_id, route_id, departure_time, departure_date, status,
      boats:boat_id (id, name),
      routes:route_id (id, origin, destination)
    `)
    .eq("departure_date", today)
    .order("departure_time");

  if (tripsError || !trips?.length) return [];

  const tripIds = trips.map((t) => t.id);

  // Fetch all bookings for today's trips
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id, trip_id, reference, status, passenger_count,
      total_amount_cents, booking_source, is_walk_in,
      customer_full_name
    `)
    .in("trip_id", tripIds)
    .not("status", "in", '("cancelled","refunded")');

  // Fetch refund requests for today's trips
  const bookingIds = (bookings ?? []).map((b) => b.id);
  let refunds: {
    id: string;
    booking_id: string;
    amount_cents: number;
    status: string;
    policy_basis: string | null;
    bookings: { reference: string; customer_full_name: string | null } | null;
  }[] = [];

  if (bookingIds.length > 0) {
    const { data: refundData } = await supabase
      .from("refunds")
      .select(`
        id, booking_id, amount_cents, status, policy_basis,
        bookings:booking_id (reference, customer_full_name)
      `)
      .in("booking_id", bookingIds)
      .in("status", ["requested", "under_review"]);

    refunds = (refundData ?? []).map((r) => ({
      ...r,
      bookings: Array.isArray(r.bookings) ? r.bookings[0] ?? null : r.bookings,
    }));
  }

  // Group bookings and refunds by trip
  const bookingsByTrip = new Map<string, typeof bookings>();
  for (const b of bookings ?? []) {
    if (!bookingsByTrip.has(b.trip_id)) bookingsByTrip.set(b.trip_id, []);
    bookingsByTrip.get(b.trip_id)!.push(b);
  }

  const refundsByBookingId = new Map<string, typeof refunds[0][]>();
  for (const r of refunds) {
    if (!refundsByBookingId.has(r.booking_id)) refundsByBookingId.set(r.booking_id, []);
    refundsByBookingId.get(r.booking_id)!.push(r);
  }

  return trips.map((t) => {
    const boat = Array.isArray(t.boats) ? t.boats[0] : t.boats;
    const route = Array.isArray(t.routes) ? t.routes[0] : t.routes;
    const tripBookings = bookingsByTrip.get(t.id) ?? [];

    const confirmed = tripBookings.filter((b) => b.status === "confirmed").length;
    const checkedIn = tripBookings.filter((b) => b.status === "checked_in").length;
    const boarded = tripBookings.filter((b) => b.status === "boarded").length;
    const online = tripBookings.filter((b) => !b.is_walk_in && b.booking_source !== "walk_in").length;
    const totalPassengers = tripBookings.reduce((s, b) => s + (b.passenger_count ?? 1), 0);
    const revenue = tripBookings.reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);

    // Collect refund requests for this trip's bookings
    const tripRefunds = tripBookings.flatMap((b) => {
      const bRefunds = refundsByBookingId.get(b.id) ?? [];
      return bRefunds.map((r) => ({
        refund_id: r.id,
        booking_reference: r.bookings?.reference ?? b.reference,
        requested_by_name: r.bookings?.customer_full_name ?? null,
        amount_cents: r.amount_cents ?? 0,
        status: r.status,
        policy_basis: r.policy_basis ?? null,
      }));
    });

    return {
      trip_id: t.id,
      boat_id: (boat as { id: string; name: string } | null)?.id ?? t.boat_id,
      boat_name: (boat as { id: string; name: string } | null)?.name ?? "Unknown",
      route_origin: (route as { id: string; origin: string; destination: string } | null)?.origin ?? "—",
      route_destination: (route as { id: string; origin: string; destination: string } | null)?.destination ?? "—",
      departure_time: t.departure_time,
      trip_status: t.status ?? "scheduled",
      slot_label: null,
      total_bookings: tripBookings.length,
      total_passengers: totalPassengers,
      online_bookings: online,
      confirmed,
      checked_in: checkedIn,
      boarded,
      revenue_cents: revenue,
      refund_requests: tripRefunds.length,
      passengers: tripBookings.map((b) => ({
        booking_id: b.id,
        reference: b.reference,
        passenger_name: b.customer_full_name ?? "—",
        passenger_count: b.passenger_count ?? 1,
        status: b.status,
        booking_source: b.booking_source ?? null,
        total_amount_cents: b.total_amount_cents ?? 0,
      })),
      refunds: tripRefunds,
    };
  });
}
