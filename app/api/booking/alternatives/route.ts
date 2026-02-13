import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isDepartureAtLeast24HoursFromNow } from "@/lib/admin/ph-time";

/** GET: List alternative trips for passenger reschedule. Same route, upcoming, with available seats. 24h rule. */
export async function GET(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reference = request.nextUrl.searchParams.get("reference")?.trim().toUpperCase();
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const supabase = await createClient();
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .select("id, trip_id, passenger_count, is_walk_in, status")
    .eq("reference", reference)
    .ilike("customer_email", email)
    .maybeSingle();

  if (bookErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!["confirmed", "checked_in", "boarded", "pending_payment"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot reschedule this booking" }, { status: 400 });
  }

  const tripId = booking.trip_id;
  if (!tripId) return NextResponse.json({ error: "Booking has no trip" }, { status: 400 });

  const { data: currentTrip, error: tripErr } = await supabase
    .from("trips")
    .select("id, route_id, departure_date, departure_time")
    .eq("id", tripId)
    .single();
  if (tripErr || !currentTrip)
    return NextResponse.json({ error: "Current trip not found" }, { status: 404 });

  if (!isDepartureAtLeast24HoursFromNow(currentTrip.departure_date ?? "", currentTrip.departure_time ?? "")) {
    return NextResponse.json(
      { error: "Reschedule only allowed at least 24 hours before departure.", alternatives: [] },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const passengerCount = Math.max(1, booking.passenger_count ?? 1);
  const isWalkIn = (booking as { is_walk_in?: boolean }).is_walk_in === true;
  const col = isWalkIn ? "walk_in_booked" : "online_booked";
  const quotaCol = isWalkIn ? "walk_in_quota" : "online_quota";

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(name), route:routes(display_name, origin, destination)")
    .eq("route_id", currentTrip.route_id)
    .gte("departure_date", today)
    .neq("id", tripId)
    .order("departure_date")
    .order("departure_time")
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (trips ?? [])
    .map((t) => {
      const booked = Number((t as Record<string, unknown>)[col]) || 0;
      const quota = Number((t as Record<string, unknown>)[quotaCol]) || 0;
      const avail = quota - booked;
      return { trip: t, avail };
    })
    .filter(({ avail }) => avail >= passengerCount)
    .map(({ trip }) => {
      const boat = trip.boat as { name?: string } | null;
      const route = trip.route as { display_name?: string; origin?: string; destination?: string } | null;
      return {
        id: trip.id,
        departure_date: trip.departure_date,
        departure_time: String(trip.departure_time ?? "").slice(0, 5),
        boat_name: boat?.name ?? "—",
        route_label: route?.display_name ?? `${route?.origin ?? ""} → ${route?.destination ?? ""}`,
        seats_available: Math.max(0, (Number((trip as Record<string, unknown>)[quotaCol]) || 0) - (Number((trip as Record<string, unknown>)[col]) || 0)),
      };
    });

  return NextResponse.json({ alternatives: items });
}
