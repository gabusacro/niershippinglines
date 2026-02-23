import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getFeeSettings } from "@/lib/get-fee-settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("route_id");
  if (!routeId) {
    return NextResponse.json({ error: "Missing route_id" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const [feeSettings, { data, error }] = await Promise.all([
    getFeeSettings(),
    supabase
      .from("fare_rules")
      .select("base_fare_cents, discount_percent, valid_until")
      .eq("route_id", routeId)
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rule = data
    ? { base_fare_cents: data.base_fare_cents, discount_percent: data.discount_percent }
    : { base_fare_cents: 55000, discount_percent: 20 };

  return NextResponse.json({
    ...rule,
    gcash_fee_cents: feeSettings.gcash_fee_cents,
    admin_fee_cents_per_passenger: feeSettings.admin_fee_cents_per_passenger,
    // Labels
    admin_fee_label: feeSettings.admin_fee_label,
    gcash_fee_label: feeSettings.gcash_fee_label,
    // Toggles
    admin_fee_applies_walkin: feeSettings.admin_fee_applies_walkin,
    gcash_fee_show_breakdown: feeSettings.gcash_fee_show_breakdown,
  });
}
