import { createClient } from "@/lib/supabase/server";
import { ADMIN_FEE_CENTS_PER_PASSENGER, GCASH_FEE_CENTS } from "@/lib/constants";

export type FeeSettings = {
  admin_fee_cents_per_passenger: number;
  gcash_fee_cents: number;
  admin_fee_label: string;
  gcash_fee_label: string;
  admin_fee_applies_walkin: boolean;
  gcash_fee_show_breakdown: boolean;
  child_min_age: number;
  child_max_age: number;
  child_discount_percent: number;
  infant_max_age: number;
  infant_is_free: boolean;
  senior_discount_percent: number;
  pwd_discount_percent: number;
};

/** Read all fee settings from DB; fallback to defaults if missing. */
export async function getFeeSettings(): Promise<FeeSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return defaults();
  }

  return {
    admin_fee_cents_per_passenger: Number(data.admin_fee_cents_per_passenger) || ADMIN_FEE_CENTS_PER_PASSENGER,
    gcash_fee_cents: Number(data.gcash_fee_cents) || GCASH_FEE_CENTS,
    admin_fee_label: data.admin_fee_label ?? "Platform Service Fee",
    gcash_fee_label: data.gcash_fee_label ?? "Payment Processing Fee",
    admin_fee_applies_walkin: data.admin_fee_applies_walkin ?? true,
    gcash_fee_show_breakdown: data.gcash_fee_show_breakdown ?? true,
    child_min_age: data.child_min_age ?? 3,
    child_max_age: data.child_max_age ?? 10,
    child_discount_percent: Number(data.child_discount_percent ?? 50),
    infant_max_age: data.infant_max_age ?? 2,
    infant_is_free: data.infant_is_free ?? true,
    senior_discount_percent: Number(data.senior_discount_percent ?? 20),
    pwd_discount_percent: Number(data.pwd_discount_percent ?? 20),
  };
}

function defaults(): FeeSettings {
  return {
    admin_fee_cents_per_passenger: ADMIN_FEE_CENTS_PER_PASSENGER,
    gcash_fee_cents: GCASH_FEE_CENTS,
    admin_fee_label: "Platform Service Fee",
    gcash_fee_label: "Payment Processing Fee",
    admin_fee_applies_walkin: true,
    gcash_fee_show_breakdown: true,
    child_min_age: 3,
    child_max_age: 10,
    child_discount_percent: 50,
    infant_max_age: 2,
    infant_is_free: true,
    senior_discount_percent: 20,
    pwd_discount_percent: 20,
  };
}
