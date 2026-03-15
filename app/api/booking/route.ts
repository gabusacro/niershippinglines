import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingPaymentRequired } from "@/lib/email/send-booking-payment-required";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { getFeeSettings, FeeSettings } from "@/lib/get-fee-settings";
import { getTodayInManila, isTripDepartureAtLeast30MinFromNow } from "@/lib/admin/ph-time";
import { NextRequest, NextResponse } from "next/server";

const FARE_TYPES = ["adult", "senior", "pwd", "student", "child", "infant"] as const;

function fareCents(baseFareCents: number, fareType: string, fees: FeeSettings): number {
  switch (fareType) {
    case "adult":   return baseFareCents;
    case "infant":  return fees.infant_is_free ? 0 : baseFareCents;
    case "senior":  return Math.round(baseFareCents * (1 - fees.senior_discount_percent / 100));
    case "pwd":     return Math.round(baseFareCents * (1 - fees.pwd_discount_percent / 100));
    case "child":   return Math.round(baseFareCents * (1 - fees.child_discount_percent / 100));
    case "student": return Math.round(baseFareCents * (1 - fees.pwd_discount_percent / 100));
    default:        return baseFareCents;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference")?.trim();
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, reference, trip_id, customer_full_name, customer_email, customer_mobile, passenger_count, fare_type, total_amount_cents, passenger_details, status, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))")
    .eq("reference", reference)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json(booking);
}

type PassengerDetail = {
  fare_type: string; full_name: string; address?: string;
  gender?: string; birthdate?: string; nationality?: string;
};

function isValidPassengerDetail(x: unknown): x is PassengerDetail {
  return (
    typeof x === "object" && x !== null &&
    "fare_type" in x && "full_name" in x &&
    typeof (x as PassengerDetail).full_name === "string" &&
    (x as PassengerDetail).full_name.trim().length > 0 &&
    FARE_TYPES.includes((x as PassengerDetail).fare_type as (typeof FARE_TYPES)[number])
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const tripId             = b.trip_id;
  const customerEmail      = b.customer_email;
  const customerMobile     = b.customer_mobile;
  const customerAddressRaw = b.customer_address;
  const notifyAlsoEmailRaw = b.notify_also_email;
  const passengerDetailsRaw = b.passenger_details;
  const isWalkIn = b.is_walk_in === true;

  if (!tripId || typeof customerEmail !== "string" || !customerEmail.trim()) {
    return NextResponse.json({ error: "Missing or invalid: trip_id, customer_email" }, { status: 400 });
  }
  if (!customerMobile || typeof customerMobile !== "string" || !customerMobile.trim()) {
    return NextResponse.json({ error: "Missing or invalid: customer_mobile" }, { status: 400 });
  }
  if (!customerAddressRaw || typeof customerAddressRaw !== "string" || !customerAddressRaw.trim()) {
    return NextResponse.json({ error: "Missing or invalid: customer_address (required for tickets and manifest)" }, { status: 400 });
  }

  const mobile          = (customerMobile as string).trim();
  const customerAddress = (customerAddressRaw as string).trim();

  let passengerCount: number;
  let customerFullName: string;
  let fareType: (typeof FARE_TYPES)[number];
  let totalCents: number;
  let passengerDetails: PassengerDetail[] | null = null;

  if (Array.isArray(passengerDetailsRaw) && passengerDetailsRaw.length > 0) {
    if (!passengerDetailsRaw.every(isValidPassengerDetail)) {
      return NextResponse.json({ error: "passenger_details must be an array of { fare_type, full_name } with non-empty names" }, { status: 400 });
    }
    passengerDetails  = passengerDetailsRaw as PassengerDetail[];
    passengerCount    = passengerDetails.length;
    customerFullName  = passengerDetails[0].full_name.trim();
    fareType          = passengerDetails[0].fare_type as (typeof FARE_TYPES)[number];
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
    passengerCount   = count;
    fareType = typeof ft === "string" && FARE_TYPES.includes(ft as (typeof FARE_TYPES)[number])
      ? (ft as (typeof FARE_TYPES)[number]) : "adult";
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();

  if (authUser?.id) {
    const adminForCheck = createAdminClient();
    if (adminForCheck) {
      // ── Booking block check ─────────────────────────────────────────────
      const { data: restriction } = await adminForCheck
        .from("passenger_booking_restrictions")
        .select("booking_blocked_at, blocked_until")
        .eq("profile_id", authUser.id)
        .maybeSingle();
      const now = new Date().toISOString();
      if (restriction?.booking_blocked_at) {
        return NextResponse.json({ error: "Your account is blocked from making new bookings. If you believe this is an error, please contact us at gabu.sacro@gmail.com." }, { status: 403 });
      }
      if (restriction?.blocked_until && restriction.blocked_until > now) {
        return NextResponse.json({ error: "We noticed unusual activity and have temporarily restricted your account. If you believe this is an error, please contact us at gabu.sacro@gmail.com." }, { status: 403 });
      }

      // ── Ticket booth vessel restriction ─────────────────────────────────
      // If the user is a ticket_booth operator, they can only book trips for
      // vessels they are assigned to in boat_assignments.
      const { data: profile } = await adminForCheck
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile?.role === "ticket_booth") {
        // Get the boat_id for this trip
        const { data: tripBoat } = await adminForCheck
          .from("trips")
          .select("boat_id")
          .eq("id", tripId)
          .maybeSingle();

        if (!tripBoat?.boat_id) {
          return NextResponse.json({ error: "Trip not found." }, { status: 404 });
        }

        // Check if this ticket booth is assigned to this vessel
        const { data: assignment } = await adminForCheck
          .from("boat_assignments")
          .select("id")
          .eq("profile_id", authUser.id)
          .eq("boat_id", tripBoat.boat_id)
          .eq("assignment_role", "ticket_booth")
          .maybeSingle();

        if (!assignment) {
          return NextResponse.json({
            error: "You are not authorized to book tickets for this vessel. You can only book for vessels you are assigned to.",
          }, { status: 403 });
        }
      }
    }
  }

  // Use service-role client for creating the booking
  const supabase = createAdminClient() ?? (await createClient());

  const { data: ref, error: refError } = await supabase.rpc("generate_booking_reference");
  if (refError || !ref) {
    return NextResponse.json({ error: refError?.message ?? "Failed to generate reference" }, { status: 500 });
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, route_id, departure_date, departure_time, online_quota, online_booked, status")
    .eq("id", tripId)
    .eq("status", "scheduled")
    .single();
  if (tripError || !trip) {
    return NextResponse.json({ error: tripError?.message ?? "Trip not found or not available" }, { status: 400 });
  }

  const todayManila = getTodayInManila();
  const depDate = (trip as { departure_date?: string }).departure_date;
  const depTime = (trip as { departure_time?: string }).departure_time ?? "";
  if (depDate === todayManila && !isTripDepartureAtLeast30MinFromNow(depDate, depTime)) {
    return NextResponse.json({ error: "This trip departs too soon. Book a later trip (at least 30 minutes from now) so you have time to pay and board." }, { status: 400 });
  }

  const available = (trip.online_quota ?? 0) - (trip.online_booked ?? 0);
  if (available < passengerCount) {
    return NextResponse.json({ error: "Not enough seats available for this trip" }, { status: 400 });
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
  if (fareError) return NextResponse.json({ error: fareError.message }, { status: 500 });
  const base = fareRule?.base_fare_cents ?? 55000;

  const fees = await getFeeSettings();

  if (passengerDetails && passengerDetails.length > 0) {
    totalCents = passengerDetails.reduce((sum, p) => sum + fareCents(base, p.fare_type, fees), 0);
  } else {
    totalCents = passengerCount * fareCents(base, fareType, fees);
  }
  const fareSubtotalCents = totalCents;

  const chargeAdminFee = isWalkIn ? fees.admin_fee_applies_walkin : true;
  const adminFeeCents  = chargeAdminFee ? passengerCount * fees.admin_fee_cents_per_passenger : 0;
  const gcashFeeCents  = isWalkIn ? 0 : fees.gcash_fee_cents;
  totalCents = fareSubtotalCents + adminFeeCents + gcashFeeCents;

  let createdBy: string | null = null;
  if (authUser?.id) {
    const { data: profileCheck } = await supabase.from("profiles").select("id").eq("id", authUser.id).maybeSingle();
    if (profileCheck?.id) createdBy = profileCheck.id;
  }

  const notifyAlsoEmail = typeof notifyAlsoEmailRaw === "string" && notifyAlsoEmailRaw.trim().length > 0
    ? notifyAlsoEmailRaw.trim() : null;

  // ── Determine booking_source ──────────────────────────────────────────────
  // online        = passenger booking via website
  // ticket_booth_walk_in = ticket booth staff booking on behalf of walk-in passenger
  // admin_walk_in = admin manually creating a booking
  let bookingSource = "online";
  if (isWalkIn && authUser?.id) {
    const { data: bookerProfile } = await supabase
      .from("profiles").select("role").eq("id", authUser.id).maybeSingle();
    if (bookerProfile?.role === "ticket_booth") bookingSource = "ticket_booth_walk_in";
    else if (bookerProfile?.role === "admin") bookingSource = "admin_walk_in";
    else bookingSource = "walk_in";
  }

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
    gcash_fee_cents: gcashFeeCents,
    admin_fee_cents: adminFeeCents,
    status: "pending_payment",
    is_walk_in: isWalkIn,
    booking_source: bookingSource,
    payment_method: isWalkIn ? "cash" : "gcash",
    created_by: createdBy,
    terms_accepted_at: typeof b.terms_accepted_at === "string" ? b.terms_accepted_at : null,
    terms_version: typeof b.terms_version === "string" ? b.terms_version : null,
  };
  if (notifyAlsoEmail) insertPayload.notify_also_email = notifyAlsoEmail;
  if (passengerDetails && passengerDetails.length > 0) {
    insertPayload.passenger_details = passengerDetails.map((p) => {
      const addr = typeof p.address === "string" && p.address.trim() ? p.address.trim() : customerAddress;
      return { fare_type: p.fare_type, full_name: p.full_name.trim(), address: addr, gender: p.gender || null, birthdate: p.birthdate || null, nationality: p.nationality || null };
    });
  }

  const { data: booking, error: insertError } = await supabase
    .from("bookings").insert(insertPayload).select("id, reference, total_amount_cents, status").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (!isWalkIn) {
    const emailParams = { reference: ref, totalAmountCents: totalCents, gcashNumber: GCASH_NUMBER || undefined, gcashAccountName: GCASH_ACCOUNT_NAME || undefined };
    sendBookingPaymentRequired({ to: customerEmail.trim(), ...emailParams }).catch((err) => console.error("[booking] email (main) failed:", err));
    if (notifyAlsoEmail && notifyAlsoEmail !== customerEmail.trim()) {
      sendBookingPaymentRequired({ to: notifyAlsoEmail, ...emailParams }).catch((err) => console.error("[booking] email (also notify) failed:", err));
    }
  }

  const fareBreakdownBase = {
    base_fare_cents: base, fare_subtotal_cents: fareSubtotalCents,
    admin_fee_cents: adminFeeCents, gcash_fee_cents: gcashFeeCents, total_cents: totalCents,
    admin_fee_label: fees.admin_fee_label, gcash_fee_label: fees.gcash_fee_label,
    gcash_fee_show_breakdown: fees.gcash_fee_show_breakdown,
  };

  const fareBreakdown = passengerDetails
    ? { ...fareBreakdownBase, passenger_details: passengerDetails.map((p) => ({ fare_type: p.fare_type, full_name: p.full_name.trim(), per_person_cents: fareCents(base, p.fare_type, fees) })) }
    : { ...fareBreakdownBase, fare_type: fareType, per_person_cents: fareCents(base, fareType, fees), passenger_count: passengerCount };

  return NextResponse.json({ booking_id: booking.id, reference: booking.reference, total_amount_cents: booking.total_amount_cents, status: booking.status, fare_breakdown: fareBreakdown });
}
