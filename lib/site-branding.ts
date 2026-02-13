import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/constants";

export interface SiteBranding {
  site_name: string;
  routes_text: string;
  tagline: string;
}

const DEFAULT_BRANDING: SiteBranding = {
  site_name: APP_NAME,
  routes_text: "Siargao Island ↔ Surigao · Dinagat ↔ Surigao City",
  tagline: "Feel the island before you arrive. Sun, waves, and a smooth sail away.",
};

/** Fetches site branding from DB (single row). Used in layout, pages, tickets, manifest, emails. */
export async function getSiteBranding(): Promise<SiteBranding> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_branding")
    .select("site_name, routes_text, tagline")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_BRANDING;
  return {
    site_name: (data.site_name ?? DEFAULT_BRANDING.site_name).trim() || DEFAULT_BRANDING.site_name,
    routes_text: (data.routes_text ?? DEFAULT_BRANDING.routes_text).trim() || DEFAULT_BRANDING.routes_text,
    tagline: (data.tagline ?? DEFAULT_BRANDING.tagline).trim() || DEFAULT_BRANDING.tagline,
  };
}
