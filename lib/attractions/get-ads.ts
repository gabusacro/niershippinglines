// lib/attractions/get-ads.ts

import { createClient as createBrowserClient } from "@supabase/supabase-js";

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
};

function getAnonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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

  if (error) {
    console.error("[getActiveAd]", error.message);
    return null;
  }
  return data as Ad | null;
}
