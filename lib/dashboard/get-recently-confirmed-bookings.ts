import { createClient } from "@/lib/supabase/server";
import { isDeparturePlusHoursInPast } from "@/lib/admin/ph-time";

export type RecentlyConfirmedRow = {
  id: string;
  reference: string;
  updated_at: string;
  trip_snapshot_departure_date?: string | null;
  trip_snapshot_departure_time?: string | null;
  refund_status?: string | null;
  refund_requested_at?: string | null;
  reschedule_requested_at?: string | null;
};

/** Bookings owned by this profile with status confirmed.
 *  Matches by created_by (logged-in bookings) OR customer_email (guest bookings claimed later).
 *  Shown until 6 hours after departure, then disappears (ticket assumed consumed). */
const HOURS_AFTER_DEPARTURE = 6;

export async function getRecentlyConfirmedBookings(
  profileId: string
): Promise<RecentlyConfirmedRow[]> {
  if (!profileId?.trim()) return [];
  const supabase = await createClient();

  // Get the user's email so we can also match guest bookings by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .maybeSingle();

  const email = profile?.email ?? null;

  // Query 1: matched by created_by (bookings made while logged in)
  const { data: byOwner } = await supabase
    .from("bookings")
    .select("id, reference, updated_at, trip_snapshot_departure_date, trip_snapshot_departure_time, refund_status, refund_requested_at, reschedule_requested_at")
    .eq("created_by", profileId)
    .eq("status", "confirmed")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Query 2: matched by customer_email (guest bookings or claimed bookings)
  let byEmail: typeof byOwner = [];
  if (email) {
    const { data } = await supabase
      .from("bookings")
      .select("id, reference, updated_at, trip_snapshot_departure_date, trip_snapshot_departure_time, refund_status, refund_requested_at, reschedule_requested_at")
      .eq("customer_email", email)
      .eq("status", "confirmed")
      .order("updated_at", { ascending: false })
      .limit(20);
    byEmail = data ?? [];
  }

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const merged: RecentlyConfirmedRow[] = [];
  for (const row of [...(byOwner ?? []), ...(byEmail ?? [])]) {
    const r = row as RecentlyConfirmedRow;
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  // Sort by updated_at descending
  merged.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // Filter out tickets that are 6+ hours past departure
  return merged.filter(b => {
    const depDate = b.trip_snapshot_departure_date ?? "";
    const depTime = b.trip_snapshot_departure_time ?? "";
    if (!depDate || !depTime) return true;
    return !isDeparturePlusHoursInPast(depDate, depTime, HOURS_AFTER_DEPARTURE);
  }).slice(0, 10);
}
