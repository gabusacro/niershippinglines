import { createClient } from "@/lib/supabase/server";

export type DiscoverPhoto = {
  id: string;
  storage_path: string;
  url: string;
  sort_order: number;
};

export type DiscoverItem = {
  id: string;
  type: "video" | "attraction" | "partner";
  title: string;
  tag: string;
  emoji: string;
  video_path: string | null;
  video_url:  string | null;
  href: string | null;
  is_featured: boolean;
  is_active:   boolean;
  sort_order:  number;
  created_at:  string;
  photos: DiscoverPhoto[];  // up to 6, ordered by sort_order
};

export async function getDiscoverItems(): Promise<DiscoverItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discover_items")
    .select(`
      id, type, title, tag, emoji, video_path, video_url, href,
      is_featured, is_active, sort_order, created_at,
      photos:discover_item_photos(id, storage_path, url, sort_order)
    `)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getDiscoverItems] error:", error.message);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    photos: ((item.photos ?? []) as DiscoverPhoto[]).sort((a, b) => a.sort_order - b.sort_order),
  })) as DiscoverItem[];
}

export async function getAllDiscoverItemsAdmin(): Promise<DiscoverItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discover_items")
    .select(`
      id, type, title, tag, emoji, video_path, video_url, href,
      is_featured, is_active, sort_order, created_at,
      photos:discover_item_photos(id, storage_path, url, sort_order)
    `)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getAllDiscoverItemsAdmin] error:", error.message);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    photos: ((item.photos ?? []) as DiscoverPhoto[]).sort((a, b) => a.sort_order - b.sort_order),
  })) as DiscoverItem[];
}
