import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "payment-proofs";
const EXPIRE_SEC = 3600; // 1 hour

/** Get a signed URL for viewing payment proof. Admin-only; uses service role. */
export async function getPaymentProofSignedUrl(
  path: string | null | undefined
): Promise<string | null> {
  if (!path || typeof path !== "string" || !path.trim()) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path.trim(), EXPIRE_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
