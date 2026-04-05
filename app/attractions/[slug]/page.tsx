import { notFound } from "next/navigation";
import { getAttractionBySlug } from "@/lib/attractions/get-attractions";
import { getActiveAds } from "@/lib/attractions/get-ads";
import { getRecentAttractions } from "@/lib/attractions/get-recent-attractions";
import type { Ad } from "@/lib/attractions/get-ads";
import type { Attraction } from "@/lib/attractions/types";
import { AttractionGallery } from "@/components/attractions/AttractionGallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  const item = await getAttractionBySlug(slug);
  if (!item) return { title: "Not found | Travela Siargao" };

  const metaDesc = (item as any).meta_description
    || item.description?.slice(0, 160)
    || `Discover ${item.title} on Siargao Island, Philippines.`;

  return {
    title: `${item.title} — Siargao Island | Travela Siargao`,
    description: metaDesc,
    keywords: [
      item.title.toLowerCase(),
      "siargao island", "siargao tourist spots", "siargao attractions",
      ...(item.seo_tags ?? []),
    ],
    openGraph: {
      title: `${item.title} — Siargao Island`,
      description: metaDesc,
      url: `https://www.travelasiargao.com/attractions/${item.slug}`,
      siteName: "Travela Siargao",
      images: item.image_url ? [{ url: item.image_url, alt: item.title }] : [],
      type: "article",
    },
  };
}

function AdSlot({ ad, variant = "sidebar" }: { ad: Ad; variant?: "sidebar" | "banner" }) {
  if (ad.type === "adsense" && ad.adsense_client && ad.adsense_slot) {
    return (
      <div className={`overflow-hidden border border-slate-100 bg-slate-50 text-center ${variant === "banner" ? "rounded-xl py-2 px-3 my-6" : "rounded-2xl p-3 mb-4"}`}>
        <p className="text-[9px] uppercase tracking-widest text-slate-300 mb-2 font-semibold">Advertisement</p>
        <ins className="adsbygoogle" style={{ display: "block" }}
          data-ad-client={ad.adsense_client} data-ad-slot={ad.adsense_slot}
          data-ad-format={variant === "banner" ? "horizontal" : "auto"}
          data-full-width-responsive="true" />
        <script dangerouslySetInnerHTML={{ __html: "(adsbygoogle = window.adsbygoogle || []).push({});" }} />
      </div>
    );
  }
  if (ad.type === "custom") {
    const inner = variant === "banner" ? (
      // ── Landscape banner variant ──
      <div className="relative overflow-hidden rounded-xl group cursor-pointer flex items-center gap-4"
        style={{ background: ad.image_url ? undefined : "linear-gradient(135deg,#085C52,#0c7b93)", minHeight: 80 }}>
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.image_alt ?? ad.title ?? "Ad"}
            className="w-24 h-20 object-cover shrink-0 rounded-l-xl transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0" style={{ background: ad.image_url ? "linear-gradient(to right,rgba(0,0,0,0) 40%,rgba(4,52,44,0.85) 100%)" : undefined }} />
        <div className="relative flex-1 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold mb-0.5">Sponsored</p>
            {ad.title && <p className="text-[13px] font-black text-white leading-snug">{ad.title}</p>}
            {ad.description && <p className="text-[11px] text-white/65 font-medium line-clamp-1">{ad.description}</p>}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#5DCAA5] ml-4">Learn more →</span>
        </div>
      </div>
    ) : (
      // ── Sidebar variant ──
      <div className="relative overflow-hidden rounded-2xl group cursor-pointer"
        style={{ background: ad.image_url ? undefined : "linear-gradient(135deg,#085C52,#0c7b93)" }}>
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.image_alt ?? ad.title ?? "Ad"}
            className="w-full h-[130px] object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0" style={{ background: ad.image_url ? "linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(4,52,44,0.92) 100%)" : undefined }} />
        <div className={`${ad.image_url ? "absolute bottom-0 left-0 right-0" : ""} p-4`}>
          <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold mb-1">Sponsored</p>
          {ad.title && <p className="text-[13px] font-black text-white leading-snug mb-1">{ad.title}</p>}
          {ad.description && <p className="text-[11px] text-white/65 font-medium mb-2 line-clamp-2">{ad.description}</p>}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5DCAA5]">Learn more →</span>
        </div>
      </div>
    );

    return (
      <div className={variant === "banner" ? "my-6" : "mb-4"}>
        {ad.link_url ? <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">{inner}</a> : inner}
      </div>
    );
  }
  return null;
}

// ── Mid-content CTA banner (shown when no ad available) ──
function MidContentCta({ title }: { title: string }) {
  return (
    <div className="my-8 rounded-xl overflow-hidden border border-[#9FE1CB]" style={{ background: "linear-gradient(135deg,#F0FDF8,#E0F7F4)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#085C52", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Planning your Siargao trip?</p>
          <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500 }}>Book everything in one place — ferry, tours, and parking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/book" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#085C52", color: "white", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            🚢 Book Ferry
          </a>
          <a href="/tours" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", color: "#085C52", border: "1.5px solid #9FE1CB", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            🌴 Book Tour
          </a>
          <a href="/parking" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", color: "#085C52", border: "1.5px solid #9FE1CB", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            🅿️ Parking
          </a>
          <a href="/weather" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", color: "#085C52", border: "1.5px solid #9FE1CB", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            ☀️ Weather
          </a>
        </div>
      </div>
    </div>
  );
}

function SidebarRecent({ items }: { items: Attraction[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 rounded-full" style={{ background: "#1AB5A3" }} />
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280" }}>Recently added</p>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <a key={item.id} href={`/attractions/${item.slug}`}
            className="group flex gap-3 items-center rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] transition-colors p-2"
            style={{ textDecoration: "none" }}>
            <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#0c7b93]"} flex items-center justify-center`}>
                  <span style={{ fontSize: 20 }}>{item.cover_emoji ?? "🌴"}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", marginBottom: 2 }}>
                {item.category?.replace("-", " ") ?? item.type}
              </p>
              <p className="group-hover:text-[#0c7b93] transition-colors line-clamp-2"
                style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                {item.title}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Inject mid-content banner into HTML after 3rd paragraph ──
function injectMidBanner(html: string, bannerHtml: string): string {
  const parts = html.split("</p>");
  if (parts.length <= 3) return html + bannerHtml;
  parts.splice(3, 0, `</p>${bannerHtml}<p style="display:none">`);
  return parts.join("</p>").replace(`<p style="display:none"></p>`, "");
}

export default async function AttractionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  if (!slug) notFound();

  // Updated — fetch left and right ads separately
const [item, ads, recentItems] = await Promise.all([
  getAttractionBySlug(slug),
  getActiveAds(["attraction_sidebar_left", "attraction_sidebar_right", "attraction_detail"]),
  getRecentAttractions(slug, 4),
]);


// Left col gets left ad, falls back to detail ad
const adLeft  = ads["attraction_sidebar_left"]  ?? ads["attraction_detail"] ?? null;
// Right col gets right ad, falls back to detail ad
const adRight = ads["attraction_sidebar_right"] ?? ads["attraction_detail"] ?? null;
  if (!item) notFound();

  const categoryLabel = item.category?.replace("-", " ") ?? item.type;
  const heroPosition = (item as any).hero_position ?? "center 40%";

  const rawPhotos = (item as any).photos as { url: string; alt: string; credit_name?: string; credit_url?: string; credit_type?: string }[] | null;
  const photos = rawPhotos && rawPhotos.length > 0
    ? rawPhotos
    : item.image_url ? [{ url: item.image_url, alt: item.title }] : [];

  const descriptionHtml = (item as any).description_html as string | null;

  // ── Mid-content CTA banner HTML string (server-rendered) ──
  const midBannerHtml = `
    <div style="margin:32px 0;border-radius:12px;overflow:hidden;border:1.5px solid #9FE1CB;background:linear-gradient(135deg,#F0FDF8,#E0F7F4)">
      <div style="padding:16px 20px">
        <p style="font-size:10px;font-weight:700;color:#085C52;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Planning your Siargao trip?</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
          <a href="/book" style="display:inline-flex;align-items:center;gap:6px;background:#085C52;color:white;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">🚢 Book Ferry</a>
          <a href="/tours" style="display:inline-flex;align-items:center;gap:6px;background:white;color:#085C52;border:1.5px solid #9FE1CB;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">🌴 Book a Tour</a>
          <a href="/parking" style="display:inline-flex;align-items:center;gap:6px;background:white;color:#085C52;border:1.5px solid #9FE1CB;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">🅿️ Book Parking</a>
          <a href="/weather" style="display:inline-flex;align-items:center;gap:6px;background:white;color:#085C52;border:1.5px solid #9FE1CB;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">☀️ Check Weather</a>
          <a href="/attractions" style="display:inline-flex;align-items:center;gap:6px;background:white;color:#085C52;border:1.5px solid #9FE1CB;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">🗺️ See Attractions</a>
        </div>
      </div>
    </div>
  `;

  // Inject mid-banner into description HTML after 3rd closing </p>
  const processedHtml = descriptionHtml
    ? (() => {
        const parts = descriptionHtml.split("</p>");
        if (parts.length <= 3) return descriptionHtml + midBannerHtml;
        return parts.slice(0, 3).join("</p>") + "</p>" + midBannerHtml + parts.slice(3).join("</p>");
      })()
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["TouristAttraction", "LocalBusiness"],
    "name": item.title,
    "description": (item as any).meta_description
      || item.description?.slice(0, 200)
      || `Discover ${item.title} on Siargao Island, Philippines.`,
    "url": `https://www.travelasiargao.com/attractions/${item.slug}`,
    "image": photos[0]?.url ? { "@type": "ImageObject", "url": photos[0].url, "description": photos[0].alt || item.title } : undefined,
    "touristType": categoryLabel,
    "isAccessibleForFree": true,
    "inLanguage": "en-PH",
    "telephone": "+639502778440",
    "priceRange": "₱650 - ₱7,500",
    "currenciesAccepted": "PHP",
    "paymentAccepted": "Cash, GCash",
    "openingHours": "Mo-Su 00:00-23:59",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Borromeo Street",
      "addressLocality": "Surigao City",
      "addressRegion": "Surigao del Norte",
      "postalCode": "8400",
      "addressCountry": "PH",
    },
    "geo": { "@type": "GeoCoordinates", "latitude": "9.8482", "longitude": "126.0458" },
    "areaServed": {
      "@type": "Place",
      "name": "Siargao Island",
      "address": { "@type": "PostalAddress", "addressRegion": "Surigao del Norte", "postalCode": "8419", "addressCountry": "PH" },
    },
    "provider": {
      "@type": "TravelAgency",
      "name": "Travela Siargao",
      "url": "https://www.travelasiargao.com",
      "image": "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/logo/01.png",
      "telephone": "+639502778440",
      "email": "support@travelasiargao.com",
      "priceRange": "₱650 - ₱7,500",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "General Luna",
        "addressLocality": "Siargao Island",
        "addressRegion": "Surigao del Norte",
        "postalCode": "8419",
        "addressCountry": "PH",
      },
    },
    "sameAs": ["https://www.facebook.com/travelasiargao", "https://www.instagram.com/travelasiargao"],
    ...(item.seo_tags?.length ? { "keywords": item.seo_tags.join(", ") } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        @keyframes heroZoom { from{transform:scale(1.06)} to{transform:scale(1)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ticker   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .left-tag-link:hover { background: #DCFCE7 !important; }
        .hero-zoom  { animation: heroZoom 8s ease forwards }
        .fade-up    { animation: fadeUp 0.6s ease both }
        .fade-up-2  { animation: fadeUp 0.6s ease 0.12s both }
        .fade-up-3  { animation: fadeUp 0.6s ease 0.24s both }
        .ticker-run { animation: ticker 28s linear infinite }
        .rich-description a { color: #0c7b93; text-decoration: underline; }
        .rich-description a:hover { color: #085C52; }
        .rich-description h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 28px 0 12px; }
        .rich-description b, .rich-description strong { font-weight: 700; }
        .rich-description i, .rich-description em { font-style: italic; }
        .rich-description p { margin-bottom: 16px; }
        @media (prefers-reduced-motion: reduce) {
          .hero-zoom,.fade-up,.fade-up-2,.fade-up-3,.ticker-run { animation: none }
        }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden" style={{ height: 480, background: "#04342C" }}>
          {photos[0] && (
            <img src={photos[0].url} alt={photos[0].alt || item.title}
              className="hero-zoom absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: heroPosition }} />
          )}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 38%,rgba(2,20,40,0.55) 68%,rgba(2,20,40,0.92) 100%)",
          }} />
          <div className="absolute top-5 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6">
            <a href="/attractions" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.16)",
              color: "rgba(255,255,255,0.88)", padding: "7px 16px", borderRadius: 999,
              fontSize: 12, fontWeight: 600, textDecoration: "none",
            }}>← Explore &amp; Discover</a>
          </div>
          {item.is_featured && (
            <div className="absolute top-5 right-4 sm:right-6">
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(251,191,36,0.18)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(251,191,36,0.38)", color: "#FCD34D",
                padding: "6px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              }}>✦ Featured spot</div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6 pb-8">
            <div className="fade-up">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(26,181,163,0.18)", border: "1px solid rgba(26,181,163,0.38)",
                color: "#5DCAA5", padding: "4px 12px", borderRadius: 999,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
                textTransform: "uppercase", marginBottom: 12,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1AB5A3", display: "inline-block" }} />
                {categoryLabel} · Siargao Island
              </span>
            </div>
            <h1 className="fade-up-2 font-black text-white" style={{
              fontSize: "clamp(28px,5.5vw,52px)", lineHeight: 1.0,
              letterSpacing: "-0.03em", textShadow: "0 2px 28px rgba(0,0,0,0.4)",
            }}>
              {item.title}
            </h1>
          </div>
        </div>

        {/* ── Live ticker ── */}
        <div className="bg-[#04342C] overflow-hidden py-2 border-t border-white/[0.05]">
          <div className="flex whitespace-nowrap ticker-run">
            {[
              { label: "Ferry tickets", text: "Book Surigao → Dapa online now", href: "/book" },
              { label: "Island tours", text: "Tri-island, Sohoton & more available", href: "/tours" },
              { label: "Weather", text: "Check live Siargao conditions", href: "/weather" },
              { label: "Ferry tickets", text: "Skip the pier queue — book ahead", href: "/book" },
              { label: "Land tours", text: "Book a local guide for Siargao", href: "/tours" },
              { label: "Ferry schedule", text: "View all departure times today", href: "/book" },
              { label: "Ferry tickets", text: "Book Surigao → Dapa online now", href: "/book" },
              { label: "Island tours", text: "Tri-island, Sohoton & more available", href: "/tours" },
              { label: "Weather", text: "Check live Siargao conditions", href: "/weather" },
              { label: "Ferry tickets", text: "Skip the pier queue — book ahead", href: "/book" },
              { label: "Land tours", text: "Book a local guide for Siargao", href: "/tours" },
              { label: "Ferry schedule", text: "View all departure times today", href: "/book" },
            ].map((t, i) => (
              <a key={i} href={t.href}
                className="inline-flex items-center gap-2 px-6 text-[11px] text-white/50 tracking-wide shrink-0 hover:text-white/80 transition-colors"
                style={{ textDecoration: "none" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1AB5A3] animate-pulse shrink-0" />
                <b className="text-[#1AB5A3] font-semibold">{t.label}</b>
                {t.text}
                <span className="text-white/20 ml-2">·</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Stat cards */}
          <div className="fade-up-3 grid grid-cols-3 gap-3 relative z-10" style={{ marginTop: 24, marginBottom: 28 }}>
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: "16px 12px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c7b93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px" }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Category</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 700, textTransform: "capitalize" }}>{categoryLabel}</div>
            </div>
            <a href="/tours" className="block rounded-2xl border border-[#E5E7EB] bg-white hover:border-[#0c7b93] hover:shadow-[0_4px_24px_rgba(12,123,147,0.15)] transition-all"
              style={{ padding: "16px 12px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", textDecoration: "none" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c7b93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px" }}>
                <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Get here</div>
              <div style={{ fontSize: 13, color: "#0c7b93", fontWeight: 700 }}>Book a tour →</div>
            </a>
            <a href="/book" className="block rounded-2xl border border-[#E5E7EB] bg-white hover:border-[#0c7b93] hover:shadow-[0_4px_24px_rgba(12,123,147,0.15)] transition-all"
              style={{ padding: "16px 12px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", textDecoration: "none" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c7b93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px" }}>
                <circle cx="12" cy="5" r="3" /><line x1="12" y1="22" x2="12" y2="8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" />
              </svg>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Ferry</div>
              <div style={{ fontSize: 13, color: "#0c7b93", fontWeight: 700 }}>Book ticket →</div>
            </a>
          </div>

          {/* ── Layout-aware body ── */}
          {(() => {
            const layout = (item as any).layout_style ?? "standard";

            if (layout === "magazine") {
              return (
                <div className="grid grid-cols-12 gap-6 pb-12">

                  {/* Left col — clickable tags + ad */}
                  <div className="col-span-2 hidden lg:block pt-1">
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 12 }}>Category</p>
                    <div className="space-y-1.5 mb-4">
                    {(item.seo_tags ?? []).map((tag) => (
                        <a key={tag} href={`/attractions?q=${encodeURIComponent(tag)}`}
                          className="left-tag-link"
                          style={{ display: "block", padding: "6px 10px", background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                          {tag}
                        </a>
                      ))}
                      <a href={`/attractions?category=${item.category ?? ""}`}
                        style={{ display: "block", padding: "6px 10px", background: "#E0F7F4", border: "1px solid #9FE1CB", color: "#085C52", borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: "capitalize", textDecoration: "none" }}>
                        {categoryLabel}
                      </a>
                    </div>

                    {/* Quick nav links */}
                    <div className="space-y-1.5 mb-4">
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 8, marginTop: 16 }}>Quick links</p>
                      {[
                        { href: "/book", label: "🚢 Book Ferry" },
                        { href: "/tours", label: "🌴 Book Tour" },
                        { href: "/parking", label: "🅿️ Parking" },
                        { href: "/weather", label: "☀️ Weather" },
                        { href: "/attractions", label: "🗺️ Attractions" },
                      ].map((link) => (
                        <a key={link.href} href={link.href}
                          style={{ display: "block", padding: "6px 10px", background: "white", border: "1px solid #E5E7EB", color: "#374151", borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                          {link.label}
                        </a>
                      ))}
                    </div>

                    {/* Left col ad */}
                    {adLeft && <AdSlot ad={adLeft} variant="sidebar" />}
                  </div>

                  {/* Center col — main content */}
                  <div className="col-span-12 lg:col-span-7 min-w-0">
                    {photos.length > 0 && <AttractionGallery photos={photos} title={item.title} />}

                    {processedHtml ? (
                      <div
                        className="rich-description"
                        dangerouslySetInnerHTML={{ __html: processedHtml }}
                        style={{ fontSize: 16, color: "#1f2937", lineHeight: 1.85, fontWeight: 400, marginBottom: 36 }}
                      />
                    ) : item.description ? (
                      <>
                        <p style={{ fontSize: 16, color: "#1f2937", lineHeight: 1.85, fontWeight: 400, marginBottom: 36, whiteSpace: "pre-line" }}>{item.description}</p>
                        <MidContentCta title={item.title} />
                      </>
                    ) : null}

                    {/* Ferry CTA */}
                    <div className="rounded-2xl text-center" style={{ background: "linear-gradient(135deg,#085C52 0%,#0c7b93 50%,#1AB5A3 100%)", padding: "36px 24px" }}>
                      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Ready to visit?</p>
                      <h2 className="font-black text-white" style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 8 }}>Book your ferry to Siargao 🌊</h2>
                      <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: 500, marginBottom: 22 }}>Skip the queue — book online in 2 minutes, pay via GCash.</p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a href="/book" className="inline-flex items-center justify-center gap-2 font-extrabold hover:-translate-y-0.5 transition-all"
                          style={{ background: "white", color: "#085C52", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>🚢 Book a Ferry</a>
                        <a href="/tours" className="inline-flex items-center justify-center gap-2 font-bold hover:-translate-y-0.5 transition-all"
                          style={{ background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.25)", color: "white", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>🌴 Book a Tour</a>
                      </div>
                    </div>
                  </div>

                  {/* Right col — ad + booking CTA + recent */}
                  <div className="col-span-3 hidden lg:block">
                    {adRight && <AdSlot ad={adRight} variant="sidebar" />}

                    <div className="rounded-2xl border border-[#9FE1CB] bg-[#F0FDF8] p-4 mb-4">
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#085C52", marginBottom: 8 }}>Book your Siargao trip</p>
                      <a href="/book" className="flex items-center gap-2 rounded-xl bg-[#085C52] text-white px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#0c7b93] transition-colors" style={{ textDecoration: "none" }}>
                        🚢 Ferry — Surigao to Dapa
                      </a>
                      <a href="/tours" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                        🌴 Island tours
                      </a>
                      <a href="/parking" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                        🅿️ Book parking
                      </a>
                      <a href="/weather" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                        ☀️ Check weather
                      </a>
                    </div>
                    <SidebarRecent items={recentItems} />
                  </div>
                </div>
              );
            }

            // standard / feature / guide — 2-column layout
            return (
              <div className="flex gap-8 items-start pb-12">
                <div className="flex-1 min-w-0">
                  {item.seo_tags && item.seo_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                      {item.seo_tags.map((tag) => (
                        <a key={tag} href={`/attractions?q=${encodeURIComponent(tag)}`}
                          style={{ padding: "5px 13px", background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", borderRadius: 999, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                          {tag}
                        </a>
                      ))}
                    </div>
                  )}
                  {photos.length > 0 && <AttractionGallery photos={photos} title={item.title} />}

                  {processedHtml ? (
                    <div
                      className="rich-description"
                      dangerouslySetInnerHTML={{ __html: processedHtml }}
                      style={{ fontSize: 16, color: "#1f2937", lineHeight: 1.85, fontWeight: 400, marginBottom: 36 }}
                    />
                  ) : item.description ? (
                    <>
                      <p style={{ fontSize: 16, color: "#1f2937", lineHeight: 1.85, fontWeight: 400, marginBottom: 36, whiteSpace: "pre-line" }}>{item.description}</p>
                      <MidContentCta title={item.title} />
                    </>
                  ) : null}

                  <div className="rounded-2xl text-center" style={{ background: "linear-gradient(135deg,#085C52 0%,#0c7b93 50%,#1AB5A3 100%)", padding: "36px 24px" }}>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Ready to visit?</p>
                    <h2 className="font-black text-white" style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 8 }}>Book your ferry to Siargao 🌊</h2>
                    <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: 500, marginBottom: 22 }}>Skip the queue — book online in 2 minutes, pay via GCash.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <a href="/book" className="inline-flex items-center justify-center gap-2 font-extrabold hover:-translate-y-0.5 transition-all"
                        style={{ background: "white", color: "#085C52", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>🚢 Book a Ferry</a>
                      <a href="/tours" className="inline-flex items-center justify-center gap-2 font-bold hover:-translate-y-0.5 transition-all"
                        style={{ background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.25)", color: "white", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>🌴 Book a Tour</a>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 w-64 hidden lg:block">
                  {adRight && <AdSlot ad={adRight} variant="sidebar" />}
                  <div className="rounded-2xl border border-[#9FE1CB] bg-[#F0FDF8] p-4 mb-4">
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#085C52", marginBottom: 8 }}>Book your Siargao trip</p>
                    <a href="/book" className="flex items-center gap-2 rounded-xl bg-[#085C52] text-white px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#0c7b93] transition-colors" style={{ textDecoration: "none" }}>
                      🚢 Ferry — Surigao to Dapa
                    </a>
                    <a href="/tours" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                      🌴 Island tours
                    </a>
                    <a href="/parking" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold mb-2 hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                      🅿️ Book parking
                    </a>
                    <a href="/weather" className="flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-white text-[#085C52] px-3 py-2.5 text-[12px] font-bold hover:bg-[#E0F7F4] transition-colors" style={{ textDecoration: "none" }}>
                      ☀️ Check weather
                    </a>
                  </div>
                  <SidebarRecent items={recentItems} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
