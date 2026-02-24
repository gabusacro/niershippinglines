import { createClient } from "@/lib/supabase/server";

export type DiscoverItem = {
  id: string;
  type: "video" | "attraction" | "partner";
  title: string;
  tag: string;
  emoji: string;
  href: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

/**
 * Fetch all active discover items ordered by sort_order.
 * Returns an empty array if none exist — passenger dashboard
 * hides the section entirely when this returns [].
 */
export async function getDiscoverItems(): Promise<DiscoverItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discover_items")
    .select("id, type, title, tag, emoji, href, is_featured, is_active, sort_order, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getDiscoverItems] error:", error.message);
    return [];
  }

  return (data ?? []) as DiscoverItem[];
}

/**
 * Admin only — fetch ALL items including inactive ones.
 */
export async function getAllDiscoverItemsAdmin(): Promise<DiscoverItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discover_items")
    .select("id, type, title, tag, emoji, href, is_featured, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getAllDiscoverItemsAdmin] error:", error.message);
    return [];
  }

  return (data ?? []) as DiscoverItem[];
}
