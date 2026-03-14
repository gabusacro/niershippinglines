import { SupabaseClient } from "@supabase/supabase-js";

type PriceFields = {
  joiner_price_cents?: number | null;
  private_price_cents?: number | null;
  per_person_price_cents?: number | null;
  exclusive_price_cents?: number | null;
};

export async function recordPriceHistory(
  supabase: SupabaseClient,
  packageId: string,
  oldPrices: PriceFields,
  newPrices: PriceFields,
  changedBy: string,
  changedByRole: string,
) {
  // Only record if a price actually changed
  const changed =
    oldPrices.joiner_price_cents !== newPrices.joiner_price_cents ||
    oldPrices.private_price_cents !== newPrices.private_price_cents ||
    oldPrices.per_person_price_cents !== newPrices.per_person_price_cents ||
    oldPrices.exclusive_price_cents !== newPrices.exclusive_price_cents;

  if (!changed) return;

  await supabase.from("tour_package_price_history").insert({
    package_id: packageId,
    changed_by: changedBy,
    changed_by_role: changedByRole,
    old_joiner_price_cents: oldPrices.joiner_price_cents ?? null,
    new_joiner_price_cents: newPrices.joiner_price_cents ?? null,
    old_private_price_cents: oldPrices.private_price_cents ?? null,
    new_private_price_cents: newPrices.private_price_cents ?? null,
    old_per_person_price_cents: oldPrices.per_person_price_cents ?? null,
    new_per_person_price_cents: newPrices.per_person_price_cents ?? null,
    old_exclusive_price_cents: oldPrices.exclusive_price_cents ?? null,
    new_exclusive_price_cents: newPrices.exclusive_price_cents ?? null,
  });
}
