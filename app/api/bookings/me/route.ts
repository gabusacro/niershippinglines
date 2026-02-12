import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET: List bookings for the currently logged-in user (matched by customer_email). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, passenger_count, fare_type, total_amount_cents, status, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .eq("customer_email", user.email)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
