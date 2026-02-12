import { createClient } from "@/lib/supabase/server";

export type RecentlyConfirmedRow = {
  id: string;
  reference: string;
  updated_at: string;
};

/** Bookings for this customer that were confirmed in the last 4 hours (for in-app "payment confirmed" notice).
 *  After 4 hours they disappear from the banner and stay in My Bookings / ticket history. */
export async function getRecentlyConfirmedBookings(
  customerEmail: string
): Promise<RecentlyConfirmedRow[]> {
  if (!customerEmail?.trim()) return [];
  const supabase = await createClient();
  const since = new Date();
  since.setHours(since.getHours() - 4);
  const sinceIso = since.toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, updated_at")
    .eq("customer_email", customerEmail.trim())
    .eq("status", "confirmed")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as RecentlyConfirmedRow[];
}
