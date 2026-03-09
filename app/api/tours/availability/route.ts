import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tour_id = searchParams.get("tour_id");

    if (!tour_id) {
      return NextResponse.json({ error: "tour_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const today = new Date().toISOString().split("T")[0];

    const { data: schedules, error } = await supabase
      .from("tour_schedules")
      .select(
        "id, available_date, departure_time, status, " +
        "joiner_slots_total, joiner_slots_booked, " +
        "private_slots_total, private_slots_booked, " +
        "exclusive_units_total, exclusive_units_booked, " +
        "accepts_joiners, accepts_private, accepts_exclusive"
      )
      .eq("tour_id", tour_id)
      .eq("status", "open")
      .gte("available_date", today)
      .order("available_date", { ascending: true });

    if (error) {
      console.error("Schedules fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}