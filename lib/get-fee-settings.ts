import { createClient } from "@/lib/supabase/server";
import { ADMIN_FEE_CENTS_PER_PASSENGER, GCASH_FEE_CENTS } from "@/lib/constants";

export type FeeSettings = {
  admin_fee_cents_per_passenger: number;
  gcash_fee_cents: number;
};

/** Read admin and GCash fee from DB; fallback to constants if table/row missing. */
export async function getFeeSettings(): Promise<FeeSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_settings")
    .select("admin_fee_cents_per_passenger, gcash_fee_cents")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return {
      admin_fee_cents_per_passenger: ADMIN_FEE_CENTS_PER_PASSENGER,
      gcash_fee_cents: GCASH_FEE_CENTS,
    };
  }

  return {
    admin_fee_cents_per_passenger: Number(data.admin_fee_cents_per_passenger) || ADMIN_FEE_CENTS_PER_PASSENGER,
    gcash_fee_cents: Number(data.gcash_fee_cents) ?? GCASH_FEE_CENTS,
  };
}
