import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type Ad = {
  id: string;
  name: string;
  type: "custom" | "adsense";
  is_active: boolean;
  placement: string;
  image_url: string | null;
  image_alt: string | null;
  link_url: string | null;
  title: string | null;
  description: string | null;
  adsense_client: string | null;
  adsense_slot: string | null;
  created_at?: string;
  updated_at?: string;
};

function getAnonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Public: get one active ad by placement ────────────────────────────────────
export async function getActiveAd(placement: string): Promise<Ad | null> {
  const supabase = getAnonClient();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("placement", placement)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error("[getActiveAd]", error.message); return null; }
  return data as Ad | null;
}

// ── Public: get two different active ads for left + right columns ─────────────
export async function getActiveAds(placements: string[]): Promise<Record<string, Ad | null>> {
  const supabase = getAnonClient();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .in("placement", placements)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) { console.error("[getActiveAds]", error.message); return {}; }

  // Return one ad per placement — latest one wins
  const result: Record<string, Ad | null> = {};
  for (const placement of placements) {
    result[placement] = (data ?? []).find((a) => a.placement === placement) ?? null;
  }
  return result;
}

// ── Admin: get all ads ────────────────────────────────────────────────────────
export async function getAllAds(): Promise<Ad[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { console.error("[getAllAds]", error.message); return []; }
  return (data ?? []) as Ad[];
}