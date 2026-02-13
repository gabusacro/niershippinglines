import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets created_by on any pending/confirmed bookings that have this customer_email
 * but created_by null (guest bookings). Call when a passenger loads dashboard so
 * their past guest bookings are tied to their account (Warning/Spam then show in admin).
 */
export async function bindBookingsToProfile(
  admin: SupabaseClient,
  profileId: string,
  email: string
): Promise<number> {
  const emailTrim = email?.trim().toLowerCase();
  if (!emailTrim) return 0;

  const { data: rows, error } = await admin
    .from("bookings")
    .select("id")
    .is("created_by", null)
    .ilike("customer_email", emailTrim);

  if (error || !rows?.length) return 0;

  const { error: updateErr } = await admin
    .from("bookings")
    .update({ created_by: profileId, updated_at: new Date().toISOString() })
    .in("id", rows.map((r) => r.id));

  return updateErr ? 0 : rows.length;
}
