import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ADMIN_FEE_CENTS_PER_PASSENGER } from "@/lib/constants";
import { assignTicketNumbersToBooking } from "@/lib/tickets/assign-ticket-numbers";
import { NextRequest, NextResponse } from "next/server";

const FARE_TYPES = ["adult", "senior", "pwd", "child", "infant"] as const;

type PassengerDetail = { fare_type: string; full_name: string; address?: string };

/** Infant (below 7) is free; adult = base; senior/pwd/child = discounted. Used for revenue. */
function fareCents(
  baseFareCents: number,
  discountPercent: number,
  fareType: string
): number {
  if (fareType === "adult") return baseFareCents;
  if (fareType === "infant") return 0; // Infant free of charge
  return Math.round(baseFareCents * (1 - discountPercent / 100));
}

function isValidPassengerDetail(x: unknown): x is PassengerDetail {
  return (
    typeof x === "object" &&
    x !== null &&
    "fare_type" in x &&
    "full_name" in x &&
    typeof (x as PassengerDetail).full_name === "string" &&
    (x as PassengerDetail).full_name.trim().length > 0 &&
    FARE_TYPES.includes((x as PassengerDetail).fare_type as (typeof FARE_TYPES)[number]) &&
    ((x as PassengerDetail).address === undefined || typeof (x as PassengerDetail).address === "string")
  );
}

/** POST: Admin or ticket_booth. Create a walk-in booking (manual). Already confirmed (payment taken in field).
 *  Reduces walk_in_booked on the trip via DB trigger; revenue counts in reports per vessel. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const tripId = b.trip_id;
  const customerEmail = b.customer_email;
  const customerMobile = b.customer_mobile;
  const customerAddress = b.customer_address;
  const notifyAlsoEmail = b.notify_also_email;
  const passengerDetailsRaw = b.passenger_details;

  if (!tripId || typeof tripId !== "string") {
    return NextResponse.json({ error: "Missing or invalid trip_id" }, { status: 400 });
  }
  if (!customerEmail || typeof customerEmail !== "string" || !customerEmail.trim()) {
    return NextResponse.json({ error: "Missing or invalid customer_email" }, { status: 400 });
  }
  if (!customerAddress || typeof customerAddress !== "string" || !customerAddress.trim()) {
    return NextResponse.json({ error: "Missing or invalid customer_address (required for tickets and Coast Guard manifest)" }, { status: 400 });
  }

  let passengerCount: number;
  let customerFullName: string;
  let fareType: (typeof FARE_TYPES)[number];
  let totalCents: number;
  let passengerDetails: PassengerDetail[] | null = null;

  if (Array.isArray(passengerDetailsRaw) && passengerDetailsRaw.length > 0) {
    if (!passengerDetailsRaw.every(isValidPassengerDetail)) {
      return NextResponse.json(
        { error: "passenger_details must be array of { fare_type, full_name } with non-empty names" },
        { status: 400 }
      );
    }
    passengerDetails = passengerDetailsRaw as PassengerDetail[];
    passengerCount = passengerDetails.length;
    customerFullName = passengerDetails[0].full_name.trim();
    fareType = passengerDetails[0].fare_type as (typeof FARE_TYPES)[number];
  } else {
    const name = b.customer_full_name;
    const count = typeof b.passenger_count === "number" ? b.passenger_count : parseInt(String(b.passenger_count ?? 0), 10);
    const ft = b.fare_type;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Missing or invalid customer_full_name" }, { status: 400 });
    }
    if (count < 1) {
      return NextResponse.json({ error: "passenger_count must be at least 1" }, { status: 400 });
    }
    customerFullName = name.trim();
    passengerCount = count;
    fareType = typeof ft === "string" && FARE_TYPES.includes(ft as (typeof FARE_TYPES)[number])
      ? (ft as (typeof FARE_TYPES)[number])
      : "adult";
  }

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, route_id, walk_in_quota, walk_in_booked, status, departure_date, departure_time, boat:boats(name), route:routes(display_name)")
    .eq("id", tripId)
    .eq("status", "scheduled")
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: "Trip not found or not available" }, { status: 400 });
  }

  const walkInAvailable = (trip.walk_in_quota ?? 0) - (trip.walk_in_booked ?? 0);
  if (walkInAvailable < passengerCount) {
    return NextResponse.json(
      { error: `Not enough walk-in seats. Available: ${walkInAvailable}, requested: ${passengerCount}` },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: fareRule, error: fareError } = await supabase
    .from("fare_rules")
    .select("base_fare_cents, discount_percent")
    .eq("route_id", trip.route_id)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fareError) {
    return NextResponse.json({ error: fareError.message }, { status: 500 });
  }
  const base = fareRule?.base_fare_cents ?? 55000;
  const discount = fareRule?.discount_percent ?? 20;

  if (passengerDetails && passengerDetails.length > 0) {
    totalCents = passengerDetails.reduce(
      (sum, p) => sum + fareCents(base, discount, p.fare_type),
      0
    );
  } else {
    totalCents = passengerCount * fareCents(base, discount, fareType);
  }
  const fareSubtotalCents = totalCents;
  const gcashFeeCents = 0; // Walk-in pays at booth; no GCash fee
  const adminFeeCents = passengerCount * ADMIN_FEE_CENTS_PER_PASSENGER;
  totalCents = fareSubtotalCents + gcashFeeCents + adminFeeCents;

  const { data: ref, error: refError } = await supabase.rpc("generate_booking_reference");
  if (refError || !ref) {
    return NextResponse.json({ error: refError?.message ?? "Failed to generate reference" }, { status: 500 });
  }

  let createdBy: string | null = null;
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile?.id) createdBy = profile.id;
  }

  const t = trip as { departure_date?: string; departure_time?: string; boat?: { name?: string } | null; route?: { display_name?: string } | null };
  const bookingAddress = (customerAddress && typeof customerAddress === "string") ? customerAddress.trim() : null;
  const notifyAlso =
    typeof notifyAlsoEmail === "string" && notifyAlsoEmail.trim().length > 0
      ? notifyAlsoEmail.trim()
      : null;

  const insertPayload: Record<string, unknown> = {
    trip_id: tripId,
    reference: ref,
    customer_full_name: customerFullName,
    customer_email: customerEmail.trim(),
    customer_mobile: (customerMobile && typeof customerMobile === "string") ? customerMobile.trim() : null,
    customer_address: bookingAddress,
    passenger_count: passengerCount,
    fare_type: fareType,
    total_amount_cents: totalCents,
    gcash_fee_cents: gcashFeeCents,
    admin_fee_cents: adminFeeCents,
    status: "confirmed",
    is_walk_in: true,
    created_by: createdBy,
    trip_snapshot_vessel_name: t.boat?.name ?? null,
    trip_snapshot_route_name: t.route?.display_name ?? null,
    trip_snapshot_departure_date: t.departure_date ?? null,
    trip_snapshot_departure_time: t.departure_time ?? null,
  };
  if (notifyAlso) (insertPayload as Record<string, unknown>).notify_also_email = notifyAlso;
  if (passengerDetails && passengerDetails.length > 0) {
    const addr = bookingAddress ?? "";
    insertPayload.passenger_details = passengerDetails.map((p) => ({
      fare_type: p.fare_type,
      full_name: p.full_name.trim(),
      address: (p.address && p.address.trim()) ? p.address.trim() : addr,
    }));
  }

  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert(insertPayload)
    .select("id, reference, total_amount_cents, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await assignTicketNumbersToBooking(booking.id);

  return NextResponse.json({
    message: "Manual Booking created. Walk-in seats updated in Supabase.",
    booking_id: booking.id,
    reference: booking.reference,
    total_amount_cents: booking.total_amount_cents,
    status: booking.status,
  });
}
