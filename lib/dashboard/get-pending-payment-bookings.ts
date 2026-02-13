import { createClient } from "@/lib/supabase/server";

export type PendingBookingRow = {
  id: string;
  reference: string;
  total_amount_cents: number;
  created_at: string;
  payment_proof_path: string | null;
  trip?: {
    departure_date?: string;
    departure_time?: string;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;
};

/** Fetches bookings owned by this profile (created_by) with status pending_payment, newest first. */
export async function getPendingPaymentBookings(
  profileId: string
): Promise<PendingBookingRow[]> {
  if (!profileId?.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, total_amount_cents, created_at, payment_proof_path, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .eq("created_by", profileId)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as PendingBookingRow[];
}
