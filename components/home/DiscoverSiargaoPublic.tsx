"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { DiscoverItem } from "@/lib/dashboard/get-discover-items";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id = u.searchParams.get("v") ?? u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&mute=0`;
    }
    if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true&show_text=false&mute=false`;
    }
    return null;
  } catch { return null; }
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

// ─── Fullscreen Video / Content Modal ────────────────────────────────────────
function FullscreenModal({
  item,
  onClose,
}: {
  item: DiscoverItem;
  onClose: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cover = item.photos[photoIndex]?.url ?? item.photos[0]?.url ?? null;
  const hasVideo = !!item.video_url;
  const embedUrl = item.video_url ? toEmbedUrl(item.video_url) : null;
  const isDirect = item.video_url ? isDirectVideo(item.video_url) : false;
  const desc = item.tag ?? "";
  const isLong = desc.length > 160;
  const displayDesc = isLong && !showFull ? desc.slice(0, 160) + "…" : desc;

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease both" }}
      onClick={onClose}
    >
      {/* Modal box — stops propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ animation: "slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Media area ── */}
        <div className="relative w-full" style={{ aspectRatio: hasVideo ? "16/9" : "16/9" }}>
          {hasVideo && embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={item.title}
            />
          ) : hasVideo && isDirect ? (
            <video
              src={item.video_url!}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              controls
              poster={cover ?? undefined}
            />
          ) : cover ? (
            <img
              src={cover}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93]" />
          )}

          {/* Photo dots */}
          {item.photos.length > 1 && !hasVideo && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {item.photos.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          )}

          {/* Close button — top right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/90 transition-all text-lg font-bold shadow-lg"
          >
            ×
          </button>
        </div>

        {/* ── Info panel below media ── */}
        <div className="px-5 py-4 sm:px-6 sm:py-5" style={{ background: "rgba(5,20,15,0.97)" }}>
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4dd9c0]">
              {item.type === "attraction" ? "🗺️ Attraction" : item.type === "video" ? "🎬 Video Tour" : "🤝 Partner"}
            </span>
            {item.is_featured && item.type !== "partner" && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">✨ Featured</span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white leading-tight mb-2">{item.title}</h3>

          {desc && (
            <p className="text-sm text-white/70 font-semibold leading-relaxed mb-3">
              {displayDesc}
              {isLong && (
                <button
                  type="button"
                  onClick={() => setShowFull((s) => !s)}
                  className="ml-1 text-[#4dd9c0] font-bold hover:underline text-xs"
                >
                  {showFull ? "show less" : "read more"}
                </button>
              )}
            </p>
          )}

          <div className="flex items-center gap-3">
            {item.href ? (
              <a
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c7b93] px-4 py-2 text-xs font-black text-white hover:bg-[#0f766e] transition-colors shadow-lg"
              >
                Learn more →
              </a>
            ) : (
              <a
                href="/book"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c7b93] px-4 py-2 text-xs font-black text-white hover:bg-[#0f766e] transition-colors shadow-lg"
              >
                🚢 Book your trip →
              </a>
            )}
            {item.photos.length > 1 && !hasVideo && (
              <span className="text-xs text-white/40 font-semibold">📸 {item.photos.length} photos</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Featured hero card (big card — top of grid like photo 3) ─────────────────
function FeaturedCard({
  item,
  onPlay,
}: {
  item: DiscoverItem;
  onPlay: () => void;
}) {
  const cover = item.photos[0]?.url ?? null;
  const hasVideo = !!item.video_url;

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative w-full overflow-hidden rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4dd9c0]"
      style={{ aspectRatio: "16/9" }}
      aria-label={`Play ${item.title}`}
    >
      {/* Cover image */}
      {cover ? (
        <img
          src={cover}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93]" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />

      {/* Featured badge */}
      {item.is_featured && (
        <span className="absolute left-4 top-4 z-10 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
          ✨ FEATURED
        </span>
      )}

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 text-white text-2xl shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
          {hasVideo ? "▶" : "+"}
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4dd9c0] mb-1">
          {item.type === "video" ? "🎬 VIDEO TOUR" : "🗺️ ATTRACTION"}
        </p>
        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-lg">
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-white/60 font-semibold">▶ Tap to watch</p>
      </div>
    </button>
  );
}

// ─── Small grid card ──────────────────────────────────────────────────────────
function GridCard({
  item,
  onClick,
}: {
  item: DiscoverItem;
  onClick: () => void;
}) {
  const cover = item.photos[0]?.url ?? null;
  const hasVideo = !!item.video_url;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4dd9c0] transition-transform duration-200 hover:scale-[1.02]"
      style={{ aspectRatio: "4/3" }}
      aria-label={`Open ${item.title}`}
    >
      {cover ? (
        <img
          src={cover}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93] flex items-center justify-center">
          <span className="text-3xl opacity-30">{item.type === "video" ? "🎬" : "🗺️"}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

      {/* Play circle on hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm border border-white/30 text-white text-base shadow-xl">
          {hasVideo ? "▶" : "+"}
        </span>
      </div>

      {/* Type badge */}
      <span className="absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/80"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
        {item.type === "video" ? "🎬 VIDEO" : item.type === "attraction" ? "🗺️ ATTRACTION" : "🤝 PARTNER"}
      </span>

      {item.is_featured && item.type !== "partner" && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-white">✨</span>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="line-clamp-2 text-xs font-black leading-tight text-white drop-shadow">
          {item.title}
        </p>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Filter = "all" | "video" | "attraction" | "partner";

export function DiscoverSiargaoPublic({ items }: { items: DiscoverItem[] }) {
  const [filter, setFilter]       = useState<Filter>("all");
  const [search, setSearch]       = useState("");
  const [modalItem, setModalItem] = useState<DiscoverItem | null>(null);
  const searchRef                 = useRef<HTMLInputElement>(null);

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

  // Featured item = first featured video, or just first item
  const featuredItem = filtered.find((i) => i.is_featured && i.type === "video") ?? filtered[0] ?? null;
  const gridItems    = featuredItem ? filtered.filter((i) => i.id !== featuredItem.id) : filtered;

  const counts = {
    all:        items.length,
    attraction: items.filter((i) => i.type === "attraction").length,
    video:      items.filter((i) => i.type === "video").length,
    partner:    items.filter((i) => i.type === "partner").length,
  };

  const openModal  = useCallback((item: DiscoverItem) => setModalItem(item), []);
  const closeModal = useCallback(() => setModalItem(null), []);

  return (
    <>
      {/* ── Fullscreen modal ── */}
      {modalItem && <FullscreenModal item={modalItem} onClose={closeModal} />}

      <section className="py-12 sm:py-16" aria-label="Discover Siargao — Island Guide">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* ── Section header — transparent, dark text on dark bg ── */}
          <div className="mb-8">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.28em] text-[#4dd9c0] mb-1">
              🌴 Island Guide
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Discover Siargao
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/55">
              Curated places, travel videos &amp; featured partners
            </p>
          </div>

          {/* ── Filter tabs — glass style ── */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {(["all", "video", "attraction", "partner"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wide transition-all ${
                  filter === f
                    ? "bg-[#4dd9c0] text-[#0a3d35] shadow-md shadow-[#4dd9c0]/25"
                    : "bg-white/8 border border-white/15 text-white/65 hover:bg-white/15 hover:text-white"
                }`}
              >
                {f === "all"        ? `All (${counts.all})`
                 : f === "video"     ? `🎬 Videos (${counts.video})`
                 : f === "attraction"? `🗺️ Attractions (${counts.attraction})`
                 :                    `🤝 Partners (${counts.partner})`}
              </button>
            ))}

            {/* Search — inline right side */}
            <div className="ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border border-white/15 bg-white/8 hover:bg-white/12 transition-colors">
              <span className="text-white/50">🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="bg-transparent text-white text-xs font-semibold placeholder:text-white/30 outline-none w-28 sm:w-40"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }} className="text-white/40 hover:text-white font-bold">×</button>
              )}
              <span className="text-white/30 font-bold text-[10px]">{filtered.length}</span>
            </div>
          </div>

          {/* ── Content ── */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 py-16 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-4xl mb-3">🌊</p>
              <p className="text-sm font-semibold text-white/50">No results found. Try a different search.</p>
            </div>
          ) : (
            <div>
              {/* Featured big card */}
              {featuredItem && (
                <div className="mb-3">
                  <FeaturedCard item={featuredItem} onPlay={() => openModal(featuredItem)} />
                </div>
              )}

              {/* Grid of remaining cards — 2 cols mobile, 4 cols desktop like photo 3 */}
              {gridItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {gridItems.map((item) => (
                    <GridCard key={item.id} item={item} onClick={() => openModal(item)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom promo line */}
          <p className="mt-6 text-center text-xs text-white/30 font-semibold">
            Want to feature your Siargao business here?{" "}
            <a href="/contact" className="text-[#4dd9c0] font-bold hover:underline">Contact us</a>
          </p>
        </div>

        <style>{`
          @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(32px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </section>
    </>
  );
}
