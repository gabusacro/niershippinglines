import { MetadataRoute } from "next";
import { ROUTES } from "@/lib/constants";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}${ROUTES.schedule}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}${ROUTES.book}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}${ROUTES.attractions}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.5 },
    { url: `${baseUrl}${ROUTES.weather}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.5 },
    { url: `${baseUrl}${ROUTES.terms}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}${ROUTES.privacy}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
  ];
  return publicPaths.map((p) => ({
    url: p.url,
    lastModified: p.lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
