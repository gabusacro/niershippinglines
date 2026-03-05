import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET  /api/admin/fare-rules?route_id=xxx  — get current fare rule for a route
 * POST /api/admin/fare-rules               — upsert fare rule for a route
 *
 * Only admin can manage fare rules.
 */

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("route_id");
  if (!routeId) {
    return NextResponse.json({ error: "Missing route_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get the currently active fare rule for this route
  const { data, error } = await supabase
    .from("fare_rules")
    .select("id, route_id, base_fare_cents, discount_percent, valid_from, valid_until")
    .eq("route_id", routeId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const routeId = b.route_id;
  const baseFareCents = b.base_fare_cents;

  if (!routeId || typeof routeId !== "string") {
    return NextResponse.json({ error: "Missing route_id" }, { status: 400 });
  }
  if (typeof baseFareCents !== "number" || baseFareCents < 0) {
    return NextResponse.json({ error: "base_fare_cents must be a non-negative number" }, { status: 400 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Check if an active rule already exists for this route
  const { data: existing } = await supabase
    .from("fare_rules")
    .select("id")
    .eq("route_id", routeId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Update the existing active rule
    const { data, error } = await supabase
      .from("fare_rules")
      .update({ base_fare_cents: baseFareCents })
      .eq("id", existing.id)
      .select("id, route_id, base_fare_cents, valid_from, valid_until")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ updated: true, fare_rule: data });
  } else {
    // Insert a new rule with no expiry (open-ended)
    const { data, error } = await supabase
      .from("fare_rules")
      .insert({
        route_id: routeId,
        base_fare_cents: baseFareCents,
        discount_percent: 20, // default; actual discounts come from fee_settings
        valid_from: today,
        valid_until: null,
      })
      .select("id, route_id, base_fare_cents, valid_from, valid_until")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ created: true, fare_rule: data });
  }
}
