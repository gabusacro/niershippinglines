// lib/attractions/get-recent-attractions.ts
// Fetches recently added attractions for the sidebar/content area
// Excludes the current attraction being viewed

import { createClient as createBrowserClient } from "@supabase/supabase-js";
import type { Attraction } from "./types";

function getAnonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getRecentAttractions(
  excludeSlug: string,
  limit = 4
): Promise<Attraction[]> {
  const supabase = getAnonClient();

  const { data, error } = await supabase
    .from("attractions")
    .select("id, title, slug, image_url, category, type, cover_gradient, cover_emoji, is_featured, created_at")
    .eq("is_published", true)
    .neq("slug", excludeSlug)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getRecentAttractions]", error.message);
    return [];
  }
  return (data ?? []) as Attraction[];
}
