"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { DiscoverItem } from "@/lib/dashboard/get-discover-items";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id = u.searchParams.get("v") ?? u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true&show_text=false`;
    }
    return null;
  } catch { return null; }
}
function isDirectVideo(url: string) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

// Assign aspect ratio pattern: landscape, portrait, square, landscape, portrait, square...
// This creates visual rhythm in the masonry-style grid
type AspectKey = "landscape" | "portrait" | "square";
const ASPECT_PATTERN: AspectKey[] = [
  "landscape", "portrait", "square",
  "portrait", "landscape", "landscape",
  "square", "portrait", "landscape",
  "portrait", "square", "landscape",
];
const ASPECT_CLASSES: Record<AspectKey, string> = {
  landscape: "aspect-[16/9]",
  portrait:  "aspect-[3/4]",
  square:    "aspect-square",
};

// ─── Expanded card overlay ────────────────────────────────────────────────────
function ExpandedCard({
  item,
  aspectClass,
  onClose,
}: {
  item: DiscoverItem;
  aspectClass: string;
  onClose: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cover = item.photos[photoIndex]?.url ?? item.photos[0]?.url ?? null;
  const hasVideo = !!item.video_url;
  const embedUrl = item.video_url ? toEmbedUrl(item.video_url) : null;
  const isDirect = item.video_url ? isDirectVideo(item.video_url) : false;
  const desc = item.tag ?? "";
  const isLong = desc.length > 120;
  const displayDesc = isLong && !showFull ? desc.slice(0, 120) + "…" : desc;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-2xl ring-2 ring-[#0c7b93]/60 ${aspectClass} w-full`}
      style={{ animation: "expandCard 0.38s cubic-bezier(0.34,1.56,0.64,1) both" }}
    >
      {/* Background photo / video */}
      {hasVideo && embedUrl ? (
        <div className="absolute inset-0">
          <iframe src={embedUrl} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen title={item.title} />
        </div>
      ) : hasVideo && isDirect ? (
        <video src={item.video_url!} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop poster={cover ?? undefined} />
      ) : cover ? (
        <img src={cover} alt={item.title} className="absolute inset-0 h-full w-full object-cover" style={{ animation: "slowZoom 8s ease-out both" }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93]" />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/80 transition-all text-sm font-bold"
      >
        ×
      </button>

      {/* Photo strip if multiple */}
      {item.photos.length > 1 && (
        <div className="absolute top-3 left-3 z-20 flex gap-1.5">
          {item.photos.slice(0, 5).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
              className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}

      {/* Content overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-5">
        {item.is_featured && item.type !== "partner" && (
          <span className="mb-1.5 inline-block rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
            ✨ Featured
          </span>
        )}
        {item.type === "partner" && (
          <span className="mb-1.5 inline-block rounded border border-white/20 bg-black/30 px-2 py-0.5 text-[9px] text-white/60 backdrop-blur-sm">
            Sponsored
          </span>
        )}

        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">
          {item.type === "attraction" ? "🗺️ Attraction" : item.type === "video" ? "🎬 Video" : "🤝 Partner"}
        </p>
        <h3 className="text-lg font-black text-white leading-tight mb-2 drop-shadow-lg">
          {item.title}
        </h3>

        {/* Description */}
        {desc && (
          <div className="mb-3">
            <p className="text-sm font-semibold text-white/85 leading-relaxed">
              {displayDesc}
              {isLong && !showFull && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFull(true); }}
                  className="ml-1 text-[#5de0d0] font-bold hover:underline text-xs"
                >
                  read more
                </button>
              )}
              {isLong && showFull && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFull(false); }}
                  className="ml-1 text-[#5de0d0] font-bold hover:underline text-xs"
                >
                  show less
                </button>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {item.href && (
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c7b93] px-4 py-2 text-xs font-black text-white hover:bg-[#0f766e] transition-colors shadow-lg"
            >
              Learn more →
            </a>
          )}
          {item.photos.length > 1 && !hasVideo && (
            <span className="text-xs text-white/50 font-semibold">
              📸 {item.photos.length} photos
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Regular card ─────────────────────────────────────────────────────────────
function AttractionCard({
  item,
  aspectClass,
  onClick,
}: {
  item: DiscoverItem;
  aspectClass: string;
  onClick: () => void;
}) {
  const cover = item.photos[0]?.url ?? null;
  const hasVideo = !!item.video_url;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl shadow-md cursor-pointer ${aspectClass} w-full transition-all duration-300 hover:shadow-xl hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7b93]`}
    >
      {/* Photo */}
      {cover ? (
        <img
          src={cover}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93] flex items-center justify-center">
          <span className="text-4xl opacity-30">
            {item.type === "video" ? "🎬" : item.type === "attraction" ? "🗺️" : "🤝"}
          </span>
        </div>
      )}

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      {/* Hover hint */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xl shadow-xl">
          {hasVideo ? "▶" : "+"}
        </span>
      </div>

      {/* Badges */}
      {item.is_featured && item.type !== "partner" && (
        <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow">✨</span>
      )}
      {item.type === "partner" && (
        <span className="absolute right-2 top-2 rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70 backdrop-blur-sm">Ad</span>
      )}
      {item.photos.length > 1 && (
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">📸{item.photos.length}</span>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 truncate">
          {item.type === "attraction" ? "🗺️" : item.type === "video" ? "🎬" : "🤝"} {item.type}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm font-black leading-tight text-white drop-shadow">
          {item.title}
        </p>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Filter = "all" | "video" | "attraction" | "partner";

export function DiscoverSiargaoPublic({ items }: { items: DiscoverItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== "all") list = list.filter((i) => i.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.tag?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filter, search]);

  // Close expanded on outside click / escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setExpandedId(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const counts = {
    all: items.length,
    attraction: items.filter((i) => i.type === "attraction").length,
    video: items.filter((i) => i.type === "video").length,
    partner: items.filter((i) => i.type === "partner").length,
  };

  return (
    <section className="border-t border-teal-200/50 bg-gradient-to-b from-[#f0fdfa] to-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Hero header ── */}
        <div className="relative mb-10 overflow-hidden rounded-3xl">
          {/* Beach gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3]" />
          {/* Wave pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 15 30 30 Q45 45 60 30' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative px-6 py-10 sm:py-14 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60 mb-2">
              🌴 Island Guide
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
              Explore Siargao
            </h2>
            <p className="text-white/70 font-semibold text-base sm:text-lg max-w-md mx-auto">
              What to see and do on the island.{" "}
              <span className="text-white/90">Click any card to explore.</span>
            </p>
          </div>
        </div>

        {/* ── Beach-vibe search bar ── */}
        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-xl">
            {/* Glow ring */}
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#0c7b93] via-[#1AB5A3] to-[#085C52] opacity-40 blur-sm" />
            <div className="relative flex items-center rounded-2xl bg-white border border-teal-200 shadow-lg overflow-hidden">
              <span className="pl-4 text-xl">🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setExpandedId(null); }}
                placeholder="Search beaches, surf spots, attractions…"
                className="flex-1 bg-transparent px-3 py-3.5 text-sm font-semibold text-[#134e4a] placeholder:text-[#0f766e]/40 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="pr-4 text-[#0f766e]/50 hover:text-[#0c7b93] transition-colors font-bold"
                >
                  ×
                </button>
              )}
              <div className="w-px h-6 bg-teal-100 mx-1" />
              <span className="pr-4 text-xs font-bold text-[#0f766e]/50">
                {filtered.length} spot{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {(["all", "attraction", "video", "partner"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFilter(f); setExpandedId(null); }}
                className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wide transition-all ${
                  filter === f
                    ? "bg-[#0c7b93] text-white shadow-md"
                    : "bg-white border border-teal-200 text-[#0f766e] hover:border-[#0c7b93] hover:text-[#0c7b93]"
                }`}
              >
                {f === "all" ? `All (${counts.all})`
                  : f === "attraction" ? `🗺️ Places (${counts.attraction})`
                  : f === "video" ? `🎬 Videos (${counts.video})`
                  : `🤝 Partners (${counts.partner})`}
              </button>
            ))}
          </div>
        </div>

        {/* ── Cards grid ── */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-16 text-center">
            <p className="text-4xl mb-3">🌊</p>
            <p className="text-sm font-semibold text-[#0f766e]">No results found. Try a different search.</p>
          </div>
        ) : (
          <div
            className="grid gap-3 sm:gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
          >
            {filtered.map((item, idx) => {
              const aspectKey = ASPECT_PATTERN[idx % ASPECT_PATTERN.length] ?? "square";
              const aspectClass = ASPECT_CLASSES[aspectKey];
              const isExpanded = expandedId === item.id;

              if (isExpanded) {
                return (
                  <div
                    key={item.id}
                    className="col-span-2 row-span-2"
                    style={{
                      gridColumn: "span 2",
                    }}
                  >
                    <ExpandedCard
                      item={item}
                      aspectClass="aspect-video"
                      onClose={() => setExpandedId(null)}
                    />
                  </div>
                );
              }

              return (
                <AttractionCard
                  key={item.id}
                  item={item}
                  aspectClass={aspectClass}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : item.id);
                  }}
                />
              );
            })}
          </div>
        )}

        {/* ── Empty state for search ── */}
        {filtered.length > 0 && search && (
          <p className="mt-4 text-center text-xs text-[#0f766e]/50 font-semibold">
            Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"
          </p>
        )}

      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes expandCard {
          0%   { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes slowZoom {
          0%   { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
      `}</style>
    </section>
  );
}
