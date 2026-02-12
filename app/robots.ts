import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/login", "/signup", "/first-admin-setup", "/crew", "/captain"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
