// lib/stories/get-stories.ts
// Server-side data fetcher — use in your Next.js page (app router)

import { createClient } from "@/lib/supabase/server"; // adjust to your supabase client path
import type { StoryCategory } from "@/components/stories/SiargaoStoriesPage";

export type StoryRow = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: StoryCategory;
  cover_url: string | null;
  cover_alt: string | null;
  cover_emoji: string;
  cover_gradient: string;
  author: string;
  slug: string;
  tags: string[];
  read_minutes: number;
  is_featured: boolean;
  is_live: boolean;
  status: "draft" | "published" | "scheduled";
  published_at: string;
  created_at: string;
};

export async function getPublishedStories(category?: StoryCategory): Promise<StoryRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("stories")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(40);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching stories:", error.message);
    return [];
  }
  return data as StoryRow[];
}

export async function getStoryBySlug(slug: string): Promise<StoryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error) return null;
  return data as StoryRow;
}
