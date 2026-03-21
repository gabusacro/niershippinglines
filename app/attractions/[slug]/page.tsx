// app/attractions/[slug]/page.tsx
// Fixes the 404 when clicking any attraction card
// Each attraction gets its own SEO-optimized page

import { notFound } from "next/navigation";
import { getAttractionBySlug, getAttractions } from "@/lib/attractions/get-attractions";
import type { Attraction } from "@/lib/attractions/types";

// ── Generate all static slugs at build time (good for SEO) ──────────────────
export async function generateStaticParams() {
  const items = await getAttractions();
  return items.map((item) => ({ slug: item.slug }));
}

// ── Per-page SEO metadata ────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const item = await getAttractionBySlug(params.slug);
  if (!item) return { title: "Not found" };

  return {
    title: `${item.title} — Siargao Island | Travela Siargao`,
    description: item.description
      ? item.description.slice(0, 160)
      : `Discover ${item.title} on Siargao Island, Philippines. Book your ferry with Travela Siargao.`,
    keywords: [
      item.title.toLowerCase(),
      "siargao island",
      "siargao tourist spots",
      "siargao attractions",
      ...(item.seo_tags ?? []),
    ],
    openGraph: {
      title: `${item.title} — Siargao Island`,
      description: item.description?.slice(0, 160) ?? `Discover ${item.title} on Siargao Island.`,
      url: `https://www.travelasiargao.com/attractions/${item.slug}`,
      siteName: "Travela Siargao",
      images: item.image_url ? [{ url: item.image_url, alt: item.title }] : [],
      type: "article",
    },
  };
}

// ── Page component ───────────────────────────────────────────────────────────
export default async function AttractionDetailPage({ params }: { params: { slug: string } }) {
  const item = await getAttractionBySlug(params.slug);
  if (!item) notFound();

  return (
    <div className="min-h-screen bg-white">

      {/* Hero image */}
      <div className="relative h-[420px] sm:h-[520px] bg-[#04342C] overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
          : (
            <div className={`absolute inset-0 bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#0c7b93]"} flex items-center justify-center`}>
              <span style={{ fontSize: 80 }}>{item.cover_emoji ?? "🌴"}</span>
            </div>
          )
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Back button */}
        <div className="absolute top-5 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <a
            href="/attractions"
            className="inline-flex items-center gap-2 text-[12px] text-white/70 hover:text-white transition-colors"
          >
            ← Back to Explore & Discover
          </a>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {item.is_featured && (
            <span className="inline-block bg-amber-400 text-amber-900 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full mb-3">
              ✦ Featured
            </span>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-semibold">
              {item.category ?? item.type}
            </span>
            {item.is_live && (
              <span className="inline-flex items-center gap-1.5 bg-red-500/20 border border-red-400/40 text-red-300 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <h1 className="text-[clamp(24px,5vw,48px)] font-semibold text-white leading-tight tracking-tight">
            {item.title}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-3xl">

          {/* SEO tags */}
          {item.seo_tags && item.seo_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {item.seo_tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-[11px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="prose prose-slate max-w-none">
              <p className="text-[16px] text-slate-700 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </div>
          )}

          {/* Ferry CTA */}
          <div className="mt-10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-[#085C52] to-[#0c7b93]">
              <div className="flex-1">
                <p className="text-[16px] font-semibold text-white mb-1">
                  Ready to visit {item.title}?
                </p>
                <p className="text-[13px] text-white/55">
                  Book your ferry to Siargao online — skip the queue, secure your seat.
                </p>
              </div>
              <a
                href="/book"
                className="shrink-0 px-5 py-2.5 bg-white text-[#085C52] rounded-full text-[13px] font-semibold hover:bg-[#f0fdfa] transition-colors whitespace-nowrap"
              >
                Book a trip →
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* Back link at bottom */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <a href="/attractions" className="text-[13px] text-[#0c7b93] hover:underline">
          ← Back to all attractions
        </a>
      </div>

    </div>
  );
}
