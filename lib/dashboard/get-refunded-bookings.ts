import { createClient } from "@/lib/supabase/server";

export type RefundedBookingRow = {
  id: string;
  reference: string;
  total_amount_cents: number;
  passenger_count: number;
  customer_full_name?: string | null;
  passenger_names?: string[] | null;
  trip_snapshot_route_name?: string | null;
  trip?: {
    departure_date?: string;
    departure_time?: string;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;
};

/** Fetches refunded bookings owned by this profile (created_by) where passenger has NOT yet acknowledged. Notice disappears after acknowledge. */
export async function getRefundedBookings(
  profileId: string
): Promise<RefundedBookingRow[]> {
  if (!profileId?.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, total_amount_cents, passenger_count, customer_full_name, passenger_names, trip_snapshot_route_name, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .eq("created_by", profileId)
    .eq("status", "refunded")
    .is("refund_acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as RefundedBookingRow[];
}
