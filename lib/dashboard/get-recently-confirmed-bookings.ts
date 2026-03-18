import { createClient } from "@/lib/supabase/server";
import { isDeparturePlusHoursInPast } from "@/lib/admin/ph-time";

export type RecentlyConfirmedRow = {
  id: string;
  reference: string;
  updated_at: string;
  trip_snapshot_departure_date?: string | null;
  trip_snapshot_departure_time?: string | null;
  trip_snapshot_route_name?: string | null;   // ← added
  passenger_count?: number | null;            // ← added
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

  const SELECT =
    "id, reference, updated_at, " +
    "trip_snapshot_departure_date, trip_snapshot_departure_time, trip_snapshot_route_name, " +
    "passenger_count, refund_status, refund_requested_at, reschedule_requested_at";

  // Query 1: matched by created_by (bookings made while logged in)
  const { data: byOwnerRaw } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("created_by", profileId)
    .eq("status", "confirmed")
    .order("updated_at", { ascending: false })
    .limit(20);
  const byOwner = (byOwnerRaw ?? []) as unknown as RecentlyConfirmedRow[];

  // Query 2: matched by customer_email (guest bookings or claimed bookings)
  let byEmail: RecentlyConfirmedRow[] = [];
  if (email) {
    const { data } = await supabase
      .from("bookings")
      .select(SELECT)
      .eq("customer_email", email)
      .eq("status", "confirmed")
      .order("updated_at", { ascending: false })
      .limit(20);
    byEmail = (data ?? []) as unknown as RecentlyConfirmedRow[];
  }

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const merged: RecentlyConfirmedRow[] = [];
  for (const row of [...byOwner, ...byEmail]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }

  // Sort by updated_at descending
  merged.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // Filter out tickets that are 6+ hours past departure (server-side pre-filter)
  // The client component also re-checks this in real time
  return merged.filter(b => {
    const depDate = b.trip_snapshot_departure_date ?? "";
    const depTime = b.trip_snapshot_departure_time ?? "";
    if (!depDate || !depTime) return true; // No snapshot → always show (safe fallback)
    return !isDeparturePlusHoursInPast(depDate, depTime, HOURS_AFTER_DEPARTURE);
  }).slice(0, 10);
}
