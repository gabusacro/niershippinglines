// lib/attractions/get-attractions.ts
// Reads from your real `attractions` table

import { createClient } from "@/lib/supabase/server";
import type { Attraction } from "./types";

const TABLE = "attractions";

// ── Public page — only published items ───────────────────────────────────────
export async function getAttractions(category?: string): Promise<Attraction[]> {
  const supabase = await createClient();

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

// ── Admin — all items including unpublished ───────────────────────────────────
export async function getAllAttractionsAdmin(): Promise<Attraction[]> {
  const supabase = await createClient();
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

// ── Single item by slug ───────────────────────────────────────────────────────
export async function getAttractionBySlug(slug: string): Promise<Attraction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) return null;
  return data as Attraction;
}
