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

/** Fetches bookings for the given customer email with status pending_payment, newest first. */
export async function getPendingPaymentBookings(
  customerEmail: string
): Promise<PendingBookingRow[]> {
  if (!customerEmail?.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, total_amount_cents, created_at, payment_proof_path, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .ilike("customer_email", customerEmail.trim())
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as PendingBookingRow[];
}
