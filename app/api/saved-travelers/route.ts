import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const SELECT_FIELDS = "id, full_name, gender, birthdate, nationality, address, phone, fare_type, id_verified, id_verified_at, id_expires_at";

// GET: list saved travelers for logged-in user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_travelers")
    .select(SELECT_FIELDS)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ travelers: data ?? [] });
}

// POST: add a saved traveler
// Accepts optional fare_type + booking_reference to look up REAL verification status
// Never hardcodes verified=true — always checks live passenger_id_verifications table
export async function POST(request: NextRequest) {
  const supabase    = await createClient();
  const adminClient = createAdminClient() ?? supabase;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const passengerName = body.full_name.trim();
  const fareType      = typeof body.fare_type        === "string" ? body.fare_type.trim()        || null : null;
  const bookingRef    = typeof body.booking_reference === "string" ? body.booking_reference.trim().toUpperCase() : null;

  // ── Normalize name for fuzzy matching ──
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

  // ── Live verification lookup — never hardcode ──
  let idVerified    = false;
  let idVerifiedAt: string | null = null;
  let idExpiresAt:  string | null = null;
  let resolvedFare  = fareType;

  const DISCOUNT_TYPES = ["senior", "pwd", "student", "child"];
  const typesToCheck   = fareType ? [fareType] : DISCOUNT_TYPES;

  // Strategy 1: check by profile_id — IDs this user uploaded themselves
  const { data: ownVerifications } = await adminClient
    .from("passenger_id_verifications")
    .select("verification_status, verified_at, expires_at, discount_type, passenger_name")
    .eq("profile_id", user.id)
    .in("discount_type", typesToCheck)
    .order("verified_at", { ascending: false });

  const now = new Date();
  const ownMatch = (ownVerifications ?? []).find(v =>
    v.verification_status === "verified" &&
    (!v.expires_at || new Date(v.expires_at) > now) &&
    norm(v.passenger_name ?? "") === norm(passengerName)
  );

  if (ownMatch) {
    idVerified   = true;
    idVerifiedAt = ownMatch.verified_at;
    idExpiresAt  = ownMatch.expires_at;
    resolvedFare = ownMatch.discount_type;
  }

  // Strategy 2: check specific booking if provided
  // (catches cases where someone else booked this passenger and got verified)
  if (!idVerified && bookingRef) {
    const { data: bk } = await adminClient
      .from("bookings")
      .select("id")
      .eq("reference", bookingRef)
      .maybeSingle();

    if (bk?.id) {
      const { data: bkVerifications } = await adminClient
        .from("passenger_id_verifications")
        .select("verification_status, verified_at, expires_at, discount_type, passenger_name")
        .eq("booking_id", bk.id)
        .in("discount_type", typesToCheck)
        .order("verified_at", { ascending: false });

      const bkMatch = (bkVerifications ?? []).find(v => {
        const nameMatch =
          norm(v.passenger_name ?? "") === norm(passengerName) ||
          norm(v.passenger_name ?? "").includes(norm(passengerName)) ||
          norm(passengerName).includes(norm(v.passenger_name ?? ""));
        return (
          nameMatch &&
          v.verification_status === "verified" &&
          (!v.expires_at || new Date(v.expires_at) > now)
        );
      });

      if (bkMatch) {
        idVerified   = true;
        idVerifiedAt = bkMatch.verified_at;
        idExpiresAt  = bkMatch.expires_at;
        resolvedFare = bkMatch.discount_type;
      }
    }
  }

  // ── Check if already in saved_travelers (avoid duplicate) ──
  const { data: existing } = await supabase
    .from("saved_travelers")
    .select("id, id_verified, fare_type")
    .eq("profile_id", user.id)
    .ilike("full_name", passengerName)
    .maybeSingle();

  if (existing) {
    // Already saved — upgrade verification status if we found a better result
    const shouldUpgrade = idVerified && !existing.id_verified;
    if (shouldUpgrade) {
      await supabase
        .from("saved_travelers")
        .update({
          id_verified:    true,
          id_verified_at: idVerifiedAt,
          id_expires_at:  idExpiresAt,
          fare_type:      resolvedFare,
        })
        .eq("id", existing.id);
    }
    const { data: refreshed } = await supabase
      .from("saved_travelers")
      .select(SELECT_FIELDS)
      .eq("id", existing.id)
      .single();
    return NextResponse.json({ traveler: refreshed, already_existed: true });
  }

  // ── Insert new saved traveler with real verified status ──
  const { data, error } = await supabase
    .from("saved_travelers")
    .insert({
      profile_id:     user.id,
      full_name:      passengerName,
      gender:         body.gender      || null,
      birthdate:      body.birthdate   || null,
      nationality:    body.nationality || null,
      address:        body.address     || null,
      phone:          body.phone       || null,
      fare_type:      resolvedFare,
      id_verified:    idVerified,
      id_verified_at: idVerifiedAt,
      id_expires_at:  idExpiresAt,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ traveler: data });
}
