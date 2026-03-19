import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parking_settings")
    .select("platform_fee_cents, processing_fee_cents, max_parking_days, default_car_rate_cents, default_motorcycle_rate_cents")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    platform_fee_cents:   data?.platform_fee_cents             ?? 3500,
    processing_fee_cents: data?.processing_fee_cents           ?? 3000,
    max_parking_days:     data?.max_parking_days               ?? 45,
    default_car_rate:     data?.default_car_rate_cents         ?? 25000,
    default_moto_rate:    data?.default_motorcycle_rate_cents  ?? 25000,
  });
}
