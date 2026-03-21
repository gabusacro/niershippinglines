// lib/attractions/get-attractions.ts
// Uses anon Supabase client for public reads — no cookies() needed
// This works correctly in both server components AND generateStaticParams

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import type { Attraction } from "./types";

const TABLE = "attractions";

// ── Public anon client — no cookies, safe to use anywhere ───────────────────
// Used for public reads (detail pages, static params)
function getAnonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Main list — authenticated client (respects RLS) ─────────────────────────
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
    if (category === "video") {
      query = query.eq("type", "video");
    } else {
      query = query.eq("category", category);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getAttractions]", error.message);
    return [];
  }
  return (data ?? []) as Attraction[];
}

// ── Single item by slug — uses ANON client, no cookies needed ────────────────
// ✅ This is what [slug]/page.tsx calls — works without HTTP request context
export async function getAttractionBySlug(slug: string): Promise<Attraction | null> {
  const supabase = getAnonClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    console.error("[getAttractionBySlug]", error.message);
    return null;
  }
  return data as Attraction;
}

// ── Admin — all items including unpublished ──────────────────────────────────
export async function getAllAttractionsAdmin(): Promise<Attraction[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order",  { ascending: true })
    .order("created_at",  { ascending: false });

  if (error) {
    console.error("[getAllAttractionsAdmin]", error.message);
    return [];
  }
  return (data ?? []) as Attraction[];
}
