// app/attractions/[slug]/page.tsx

import { notFound } from "next/navigation";
import { getAttractionBySlug } from "@/lib/attractions/get-attractions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const item = await getAttractionBySlug(params.slug);
  if (!item) return { title: "Not found | Travela Siargao" };
  return {
    title: `${item.title} — Siargao Island | Travela Siargao`,
    description: item.description
      ? item.description.slice(0, 160)
      : `Discover ${item.title} on Siargao Island, Philippines.`,
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

export default async function AttractionDetailPage({ params }: { params: { slug: string } }) {
  const item = await getAttractionBySlug(params.slug);
  if (!item) notFound();

  return (
    <div className="min-h-screen bg-white">

      {/* Hero */}
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

        {/* Back */}
        <div className="absolute top-5 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6">
          <a href="/attractions" className="inline-flex items-center gap-2 text-[12px] font-semibold text-white/70 hover:text-white transition-colors">
            ← Back to Explore &amp; Discover
          </a>
        </div>

        {/* Title */}
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6 pb-8">
          {item.is_featured && (
            <span className="inline-block bg-amber-400 text-amber-900 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full mb-3">
              ✦ Featured
            </span>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-semibold capitalize">
              {item.category ?? item.type}
            </span>
            {item.is_live && (
              <span className="inline-flex items-center gap-1.5 bg-red-500/20 border border-red-400/40 text-red-300 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <h1 className="text-[clamp(24px,5vw,48px)] font-black text-white leading-tight tracking-tight">
            {item.title}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="max-w-3xl">

          {/* SEO tags */}
          {item.seo_tags && item.seo_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {item.seo_tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-[#0c7b93]/10 border border-[#0c7b93]/20 text-[#0c7b93] rounded-full text-[11px] font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-base text-[#134e4a] leading-relaxed whitespace-pre-line font-medium">
              {item.description}
            </p>
          )}

          {/* CTA */}
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-center text-white shadow-lg">
            <h2 className="text-xl font-black">Ready to visit {item.title}? 🌊</h2>
            <p className="mt-2 text-white/75 font-semibold text-sm">
              Book your ferry to Siargao online — skip the queue, secure your seat.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <a href="/book" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-extrabold text-[#085C52] shadow-md hover:bg-[#fef9e7] hover:-translate-y-0.5 transition-all">
                🚢 Book a Trip
              </a>
              <a href="/attractions" className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3 text-sm font-extrabold text-white hover:bg-white/20 hover:-translate-y-0.5 transition-all">
                ← More Attractions
              </a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
