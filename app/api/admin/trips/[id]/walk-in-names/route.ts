import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const WALK_IN_EMAIL = "walk-in@manifest";
const FARE_TYPES = ["adult", "senior", "pwd", "child", "infant"] as const;

/** Infant (below 7) is free; adult = base; senior/pwd/child = discounted. Used for revenue. */
function fareCents(baseFareCents: number, discountPercent: number, fareType: string): number {
  if (fareType === "adult") return baseFareCents;
  if (fareType === "infant") return 0; // Infant free of charge
  return Math.round(baseFareCents * (1 - discountPercent / 100));
}

/** POST: Create walk-in bookings with passenger names and types (one booking per passenger). Admin or ticket_booth. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "ticket_booth") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { names?: string[]; passengers?: { full_name: string; fare_type?: string; contact?: string }[]; customer_mobile?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const legacyMobile = typeof body.customer_mobile === "string" ? body.customer_mobile.trim() || null : null;

  let passengers: { full_name: string; fare_type: string; contact: string | null }[];
  if (Array.isArray(body.passengers) && body.passengers.length > 0) {
    passengers = body.passengers
      .map((p) => ({
        full_name: typeof p.full_name === "string" ? p.full_name.trim() : "",
        fare_type: typeof p.fare_type === "string" && FARE_TYPES.includes(p.fare_type as (typeof FARE_TYPES)[number])
          ? (p.fare_type as (typeof FARE_TYPES)[number])
          : "adult",
        contact: typeof p.contact === "string" ? p.contact.trim() || null : legacyMobile,
      }))
      .filter((p) => p.full_name.length > 0);
  } else {
    const raw = Array.isArray(body.names) ? body.names : [];
    const names = raw
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter(Boolean);
    passengers = names.map((n) => ({ full_name: n, fare_type: "adult", contact: legacyMobile }));
  }

  if (passengers.length === 0) {
    return NextResponse.json({ error: "passengers (array of { full_name, fare_type }) or names (array of strings) required, at least one" }, { status: 400 });
  }

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("id, route_id, online_quota, online_booked, walk_in_quota, walk_in_booked, departure_date, departure_time, boat:boats(name, capacity), route:routes(display_name)")
    .eq("id", tripId)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json(
      { error: tripErr?.message ? `Trip not found: ${tripErr.message}` : "Trip not found" },
      { status: 404 }
    );
  }

  const boat = trip.boat as { capacity?: number; name?: string } | null;
  const route = trip.route as { display_name?: string } | null;
  const capacity = boat?.capacity ?? (trip.online_quota ?? 0) + (trip.walk_in_quota ?? 0);
  const ob = trip.online_booked ?? 0;
  const wb = trip.walk_in_booked ?? 0;
  const maxNewWalkIn = capacity - ob - wb;
  if (passengers.length > maxNewWalkIn) {
    return NextResponse.json(
      { error: `Only ${maxNewWalkIn} walk-in seat(s) left (capacity ${capacity} − ${ob} online − ${wb} walk-in). You sent ${passengers.length} passenger(s).` },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: fareRule } = await supabase
    .from("fare_rules")
    .select("base_fare_cents, discount_percent")
    .eq("route_id", trip.route_id)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = fareRule?.base_fare_cents ?? 55000;
  const discount = fareRule?.discount_percent ?? 20;

  const t = trip as { departure_date?: string; departure_time?: string; boat?: { name?: string }; route?: { display_name?: string } };
  let created = 0;
  for (const p of passengers) {
    const { data: ref, error: refErr } = await supabase.rpc("generate_booking_reference");
    if (refErr || !ref) {
      return NextResponse.json({ error: refErr?.message ?? "Failed to generate reference" }, { status: 500 });
    }
    const totalCents = fareCents(base, discount, p.fare_type);
    const insertPayload = {
      trip_id: tripId,
      reference: ref,
      customer_full_name: p.full_name,
      customer_email: WALK_IN_EMAIL,
      customer_mobile: p.contact,
      passenger_count: 1,
      fare_type: p.fare_type,
      total_amount_cents: totalCents,
      status: "confirmed" as const,
      is_walk_in: true,
      created_by: user.id,
      trip_snapshot_vessel_name: t.boat?.name ?? null,
      trip_snapshot_route_name: t.route?.display_name ?? null,
      trip_snapshot_departure_date: t.departure_date ?? null,
      trip_snapshot_departure_time: t.departure_time ?? null,
      passenger_details: [{ fare_type: p.fare_type, full_name: p.full_name }],
    };
    const { data: inserted, error: insertErr } = await supabase.from("bookings").insert(insertPayload).select("id").single();
    if (insertErr || !inserted) {
      return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
    }
    const { assignTicketNumbersToBooking } = await import("@/lib/tickets/assign-ticket-numbers");
    await assignTicketNumbersToBooking(inserted.id);
    created += 1;
  }

  revalidatePath("/admin/reports", "layout");
  revalidatePath(`/admin/reports/trip/${tripId}`, "layout");
  return NextResponse.json({ message: `${created} walk-in passenger(s) added with names.`, count: created });
}
