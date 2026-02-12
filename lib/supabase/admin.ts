import { createClient } from "@supabase/supabase-js";

/**
 * Admin client that bypasses RLS. Use ONLY in server-side admin API routes
 * after verifying the requestor is an admin. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
