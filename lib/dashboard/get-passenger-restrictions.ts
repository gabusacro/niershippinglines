import { createClient } from "@/lib/supabase/server";

export type PassengerRestriction = {
  booking_warnings: number;
  booking_blocked_at: string | null;
  blocked_until: string | null;
};

export async function getPassengerRestrictions(profileId: string): Promise<PassengerRestriction | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("passenger_booking_restrictions")
    .select("booking_warnings, booking_blocked_at, blocked_until")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data) return null;
  return {
    booking_warnings: data.booking_warnings ?? 0,
    booking_blocked_at: data.booking_blocked_at ?? null,
    blocked_until: data.blocked_until ?? null,
  };
}

export function isBlockedNow(restriction: PassengerRestriction | null): boolean {
  if (!restriction) return false;
  if (restriction.booking_blocked_at) return true;
  if (restriction.blocked_until) {
    return new Date(restriction.blocked_until) > new Date();
  }
  return false;
}
