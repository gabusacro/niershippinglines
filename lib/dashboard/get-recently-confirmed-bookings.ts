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

/** Bookings owned by this profile (created_by) with status confirmed, shown in "Payment confirmed — tickets ready" until
 *  6 hours after the scheduled departure has passed. After that they disappear from the banner
 *  (ticket assumed consumed) and stay in My Bookings / ticket history. */
const HOURS_AFTER_DEPARTURE = 6;

export async function getRecentlyConfirmedBookings(
  profileId: string
): Promise<RecentlyConfirmedRow[]> {
  if (!profileId?.trim()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, updated_at, trip_snapshot_departure_date, trip_snapshot_departure_time, refund_status, refund_requested_at, reschedule_requested_at")
    .eq("created_by", profileId)
    .eq("status", "confirmed")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return [];

  const rows = (data ?? []) as RecentlyConfirmedRow[];
  return rows.filter((b) => {
    const depDate = b.trip_snapshot_departure_date ?? "";
    const depTime = b.trip_snapshot_departure_time ?? "";
    if (!depDate || !depTime) return true;
    return !isDeparturePlusHoursInPast(depDate, depTime, HOURS_AFTER_DEPARTURE);
  }).slice(0, 10);
}
