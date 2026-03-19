import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const supabase = await createClient();
  const { error } = await supabase
    .from("parking_settings")
    .upsert({
      id: 1,
      default_car_rate_cents:        Number(body.default_car_rate_cents)        || 25000,
      default_motorcycle_rate_cents: Number(body.default_motorcycle_rate_cents) || 25000,
      default_van_rate_cents:        body.default_van_rate_cents != null ? Number(body.default_van_rate_cents) : null,
      commission_per_vehicle_cents:  Number(body.commission_per_vehicle_cents)  || 10000,
      platform_fee_cents:            Number(body.platform_fee_cents)            || 3500,
      processing_fee_cents:          Number(body.processing_fee_cents)          || 3000,
      max_parking_days:              Number(body.max_parking_days)              || 45,
      overstay_warning_day:          Number(body.overstay_warning_day)          || 40,
      checkout_cutoff_hour:          Number(body.checkout_cutoff_hour)          || 8,
      required_documents_text:       String(body.required_documents_text        ?? ""),
      surrender_policy_text:         String(body.surrender_policy_text          ?? ""),
      overstay_instructions_text:    String(body.overstay_instructions_text     ?? ""),
      updated_at:                    new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) {
    console.error("[parking/settings]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
