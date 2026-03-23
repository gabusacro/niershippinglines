import { MetadataRoute } from "next";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.travelasiargao.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                           lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${baseUrl}${ROUTES.schedule}`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}${ROUTES.book}`,        lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${baseUrl}/tours`,                lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}${ROUTES.attractions}`, lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}/faq`,                  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${baseUrl}${ROUTES.weather}`,     lastModified: new Date(), changeFrequency: "daily",   priority: 0.5 },
    { url: `${baseUrl}${ROUTES.terms}`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}${ROUTES.privacy}`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic attraction pages
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: attractions } = await supabase
      .from("attractions")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    const attractionPages: MetadataRoute.Sitemap = (attractions ?? []).map((a) => ({
      url:             `${baseUrl}/attractions/${a.slug}`,
      lastModified:    new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority:        0.7,
    }));

    return [...staticPages, ...attractionPages];
  } catch {
    return staticPages;
  }
}
