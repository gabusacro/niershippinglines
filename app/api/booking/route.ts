import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingPaymentRequired } from "@/lib/email/send-booking-payment-required";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { getTodayInManila, isTripDepartureAtLeast30MinFromNow } from "@/lib/admin/ph-time";
import { NextRequest, NextResponse } from "next/server";

const FARE_TYPES = ["adult", "senior", "pwd", "child", "infant"] as const;

/** Infant (below 7) is free; adult = base; senior/pwd/child = discounted. Used for revenue. */
function fareCents(
  baseFareCents: number,
  discountPercent: number,
  fareType: string
): number {
  if (fareType === "adult") return baseFareCents;
  if (fareType === "infant") return 0; // Infant free of charge
  const discounted = Math.round(
    baseFareCents * (1 - discountPercent / 100)
  );
  return discounted;
}

/** GET: Look up a booking by reference (for payment / status check). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference")?.trim();
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, reference, trip_id, customer_full_name, customer_email, customer_mobile, passenger_count, fare_type, total_amount_cents, passenger_details, status, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))")
    .eq("reference", reference)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  return NextResponse.json(booking);
}

type PassengerDetail = { fare_type: string; full_name: string; address?: string };

function isValidPassengerDetail(x: unknown): x is PassengerDetail {
  return (
    typeof x === "object" &&
    x !== null &&
    "fare_type" in x &&
    "full_name" in x &&
    typeof (x as PassengerDetail).full_name === "string" &&
    (x as PassengerDetail).full_name.trim().length > 0 &&
    FARE_TYPES.includes((x as PassengerDetail).fare_type as (typeof FARE_TYPES)[number])
  );
}

export async function POST(request: NextRequest) {
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
  const customerAddressRaw = b.customer_address;
  const notifyAlsoEmailRaw = b.notify_also_email;
  const passengerDetailsRaw = b.passenger_details;

  if (!tripId || typeof customerEmail !== "string" || !customerEmail.trim()) {
    return NextResponse.json({ error: "Missing or invalid: trip_id, customer_email" }, { status: 400 });
  }
  if (!customerMobile || typeof customerMobile !== "string" || !customerMobile.trim()) {
    return NextResponse.json({ error: "Missing or invalid: customer_mobile" }, { status: 400 });
  }
  if (!customerAddressRaw || typeof customerAddressRaw !== "string" || !customerAddressRaw.trim()) {
    return NextResponse.json({ error: "Missing or invalid: customer_address (required for tickets and manifest)" }, { status: 400 });
  }
  const mobile = customerMobile.trim();
  const customerAddress = customerAddressRaw.trim();

  let passengerCount: number;
  let customerFullName: string;
  let fareType: (typeof FARE_TYPES)[number];
  let totalCents: number;
  let passengerDetails: PassengerDetail[] | null = null;

  if (Array.isArray(passengerDetailsRaw) && passengerDetailsRaw.length > 0) {
    if (!passengerDetailsRaw.every(isValidPassengerDetail)) {
      return NextResponse.json(
        { error: "passenger_details must be an array of { fare_type: adult|senior|pwd|child, full_name: string } with non-empty names" },
        { status: 400 }
      );
    }
    passengerDetails = passengerDetailsRaw as PassengerDetail[];
    passengerCount = passengerDetails.length;
    customerFullName = passengerDetails[0].full_name.trim();
    fareType = passengerDetails[0].fare_type as (typeof FARE_TYPES)[number];
  } else {
    const name = b.customer_full_name;
    const count = b.passenger_count;
    const ft = b.fare_type;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Missing or invalid: customer_full_name" }, { status: 400 });
    }
    if (typeof count !== "number" || count < 1) {
      return NextResponse.json({ error: "Missing or invalid: passenger_count (min 1)" }, { status: 400 });
    }
    customerFullName = name.trim();
    passengerCount = count;
    fareType = typeof ft === "string" && FARE_TYPES.includes(ft as (typeof FARE_TYPES)[number])
      ? (ft as (typeof FARE_TYPES)[number])
      : "adult";
  }

  // Use service-role client for creating the booking so public (anon) booking is not blocked by RLS.
  const supabase = createAdminClient() ?? (await createClient());

  const { data: ref, error: refError } = await supabase.rpc(
    "generate_booking_reference"
  );
  if (refError || !ref) {
    return NextResponse.json(
      { error: refError?.message ?? "Failed to generate reference" },
      { status: 500 }
    );
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, route_id, departure_date, departure_time, online_quota, online_booked, status")
    .eq("id", tripId)
    .eq("status", "scheduled")
    .single();
  if (tripError || !trip) {
    return NextResponse.json(
      { error: tripError?.message ?? "Trip not found or not available" },
      { status: 400 }
    );
  }
  const todayManila = getTodayInManila();
  const depDate = (trip as { departure_date?: string }).departure_date;
  const depTime = (trip as { departure_time?: string }).departure_time ?? "";
  if (depDate === todayManila && !isTripDepartureAtLeast30MinFromNow(depDate, depTime)) {
    return NextResponse.json(
      { error: "This trip departs too soon. Book a later trip (at least 30 minutes from now) so you have time to pay and board." },
      { status: 400 }
    );
  }
  const available = (trip.online_quota ?? 0) - (trip.online_booked ?? 0);
  if (available < passengerCount) {
    return NextResponse.json(
      { error: "Not enough seats available for this trip" },
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
    const perPersonCents = fareCents(base, discount, fareType);
    totalCents = passengerCount * perPersonCents;
  }

  let createdBy: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) {
    // Only set created_by when a matching profile exists, to satisfy FK bookings_created_by_fkey.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.id) {
      createdBy = profile.id;
    }
  }

  const notifyAlsoEmail =
    typeof notifyAlsoEmailRaw === "string" && notifyAlsoEmailRaw.trim().length > 0
      ? notifyAlsoEmailRaw.trim()
      : null;
  const insertPayload: Record<string, unknown> = {
    trip_id: tripId,
    reference: ref,
    customer_full_name: customerFullName,
    customer_email: customerEmail.trim(),
    customer_mobile: mobile,
    customer_address: customerAddress,
    passenger_count: passengerCount,
    fare_type: fareType,
    total_amount_cents: totalCents,
    status: "pending_payment",
    is_walk_in: false,
    created_by: createdBy,
  };
  if (notifyAlsoEmail) insertPayload.notify_also_email = notifyAlsoEmail;
  if (passengerDetails && passengerDetails.length > 0) {
    insertPayload.passenger_details = passengerDetails.map((p) => {
      const addr = typeof p.address === "string" && p.address.trim() ? p.address.trim() : customerAddress;
      return { fare_type: p.fare_type, full_name: p.full_name.trim(), address: addr };
    });
  }

  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert(insertPayload)
    .select("id, reference, total_amount_cents, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Email: payment required to main contact and optionally to second email.
  const emailParams = {
    reference: ref,
    totalAmountCents: totalCents,
    gcashNumber: GCASH_NUMBER || undefined,
    gcashAccountName: GCASH_ACCOUNT_NAME || undefined,
  };
  sendBookingPaymentRequired({ to: customerEmail.trim(), ...emailParams }).catch((err) =>
    console.error("[booking] payment-required email (main) failed:", err)
  );
  if (notifyAlsoEmail && notifyAlsoEmail !== customerEmail.trim()) {
    sendBookingPaymentRequired({ to: notifyAlsoEmail, ...emailParams }).catch((err) =>
      console.error("[booking] payment-required email (also notify) failed:", err)
    );
  }

  return NextResponse.json({
    booking_id: booking.id,
    reference: booking.reference,
    total_amount_cents: booking.total_amount_cents,
    status: booking.status,
    fare_breakdown: passengerDetails
      ? {
          base_fare_cents: base,
          discount_percent: discount,
          passenger_details: passengerDetails.map((p) => ({
            fare_type: p.fare_type,
            full_name: p.full_name.trim(),
            per_person_cents: fareCents(base, discount, p.fare_type),
          })),
          total_cents: totalCents,
        }
      : {
          base_fare_cents: base,
          discount_percent: discount,
          fare_type: fareType,
          per_person_cents: fareCents(base, discount, fareType),
          passenger_count: passengerCount,
          total_cents: totalCents,
        },
  });
}
