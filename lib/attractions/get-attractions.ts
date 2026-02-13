import { createClient } from "@/lib/supabase/server";

export type AttractionRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  image_urls?: string[];
};

/**
 * Fetches published attractions from Supabase, with gallery images (image_url + attraction_images).
 */
export async function getAttractionsFromSupabase(): Promise<AttractionRow[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("attractions")
    .select("id, title, slug, description, image_url, sort_order")
    .eq("is_published", true)
    .order("sort_order")
    .order("title");

  if (error || !rows?.length) return [];

  const ids = rows.map((r) => r.id);
  const { data: imgRows } = await supabase
    .from("attraction_images")
    .select("attraction_id, image_url, sort_order")
    .in("attraction_id", ids)
    .order("sort_order");

  const imagesByAttractionId = new Map<string, string[]>();
  for (const row of imgRows ?? []) {
    const r = row as { attraction_id: string; image_url: string; sort_order: number };
    const arr = imagesByAttractionId.get(r.attraction_id) ?? [];
    arr.push(r.image_url);
    imagesByAttractionId.set(r.attraction_id, arr);
  }

  return (rows as AttractionRow[]).map((a) => {
    const mainUrl = a.image_url ?? null;
    const extraUrls = imagesByAttractionId.get(a.id) ?? [];
    const image_urls = mainUrl ? [mainUrl, ...extraUrls] : extraUrls;
    return {
      ...a,
      image_urls: image_urls.length > 0 ? image_urls : undefined,
    };
  });
}
