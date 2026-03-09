import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: tours, error } = await supabase
      .from("tour_packages")
      .select(
        "id, title, slug, accepts_joiners, accepts_private, accepts_exclusive, " +
        "joiner_price_cents, private_price_cents, exclusive_price_cents, " +
        "is_hourly, hourly_price_min_cents, hourly_price_max_cents, " +
        "is_per_person, per_person_price_cents, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Tours fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tours: tours ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}