import { createClient } from "@/lib/supabase/server";

export type RecentlyConfirmedRow = {
  id: string;
  reference: string;
  updated_at: string;
  trip_snapshot_departure_date?: string | null;
  trip_snapshot_departure_time?: string | null;
  trip_snapshot_route_name?: string | null;
  passenger_count?: number | null;
  refund_status?: string | null;
  refund_requested_at?: string | null;
};

/**
 * Returns ALL confirmed bookings for this passenger.
 * NO server-side time filtering — the PassengerActiveTickets client component
 * handles the 6hr post-departure hide logic in real time on the client.
 * This ensures no booking is ever silently dropped by a server timezone issue.
 */
export async function getRecentlyConfirmedBookings(
  profileId: string
): Promise<RecentlyConfirmedRow[]> {
  if (!profileId?.trim()) return [];
  const supabase = await createClient();

  // Get the user's email to also match guest / claimed bookings
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .maybeSingle();

  const email = profile?.email ?? null;

  const FIELDS =
    "id, reference, updated_at, " +
    "trip_snapshot_departure_date, trip_snapshot_departure_time, trip_snapshot_route_name, " +
    "passenger_count, refund_status, refund_requested_at";

  // Query 1: bookings made while logged in (created_by = passenger's profile id)
  const { data: byOwnerRaw } = await supabase
    .from("bookings")
    .select(FIELDS)
    .eq("created_by", profileId)
    .eq("status", "confirmed")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Query 2: bookings matched by email (guest bookings or bookings claimed later)
  let byEmailRaw: typeof byOwnerRaw = [];
  if (email) {
    const { data } = await supabase
      .from("bookings")
      .select(FIELDS)
      .eq("customer_email", email)
      .eq("status", "confirmed")
      .order("updated_at", { ascending: false })
      .limit(20);
    byEmailRaw = data ?? [];
  }

  // Cast to our type (Supabase can't infer types from string selects)
  const byOwner = (byOwnerRaw ?? []) as unknown as RecentlyConfirmedRow[];
  const byEmail = (byEmailRaw ?? []) as unknown as RecentlyConfirmedRow[];

  // Merge and deduplicate by booking id
  const seen = new Set<string>();
  const merged: RecentlyConfirmedRow[] = [];
  for (const row of [...byOwner, ...byEmail]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }

  // Sort newest first, return up to 10
  // The 6hr post-departure hide logic runs client-side in PassengerActiveTickets
  return merged
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);
}
