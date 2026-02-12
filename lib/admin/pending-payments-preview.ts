import { createClient } from "@/lib/supabase/server";

export type PendingPreviewItem = {
  reference: string;
  total_amount_cents: number;
  customer_full_name: string;
};

export async function getPendingPaymentsPreview(): Promise<{
  count: number;
  items: PendingPreviewItem[];
}> {
  const supabase = await createClient();
  const { data: all, error } = await supabase
    .from("bookings")
    .select("reference, total_amount_cents, customer_full_name")
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { count: 0, items: [] };
  const list = (all ?? []) as PendingPreviewItem[];
  return {
    count: list.length,
    items: list.slice(0, 5),
  };
}
