// lib/attractions/get-attractions.ts

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import type { Attraction } from "./types";

const TABLE = "attractions";

function getAnonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Public list ───────────────────────────────────────────────────────────────
export async function getAttractions(category?: string): Promise<Attraction[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from(TABLE)
    .select("*")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("sort_order",  { ascending: true })
    .order("created_at",  { ascending: false });

  if (category && category !== "all") {
    query = category === "video"
      ? query.eq("type", "video")
      : query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) { console.error("[getAttractions]", error.message); return []; }
  return (data ?? []) as Attraction[];
}

// ── Single item by slug ───────────────────────────────────────────────────────
// ✅ Uses maybeSingle() instead of single() — never throws on zero results
// ✅ NO is_published filter — avoids null/false mismatch on new column
// ✅ Uses anon client — no cookies() needed
export async function getAttractionBySlug(slug: string): Promise<Attraction | null> {
  const supabase = getAnonClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    // ✅ Removed .eq("is_published", true) — this was causing zero results
    //    because the new `is_published` column may be null for some rows
    .maybeSingle(); // ✅ Returns null instead of throwing when no row found

  if (error) {
    console.error("[getAttractionBySlug]", error.message);
    return null;
  }
  return data as Attraction | null;
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function getAllAttractionsAdmin(): Promise<Attraction[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order",  { ascending: true })
    .order("created_at",  { ascending: false });

  if (error) { console.error("[getAllAttractionsAdmin]", error.message); return []; }
  return (data ?? []) as Attraction[];
}
