"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── Gallery Modal (identical behaviour to dashboard) ─────────────────────────
function GalleryModal({ item, onClose }: { item: DiscoverItem; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const hasVideo  = !!item.video_url;
  const embedUrl  = item.video_url ? toEmbedUrl(item.video_url) : null;
  const isDirect  = item.video_url ? isDirectVideo(item.video_url) : false;

  const slides: Array<{ kind: "photo"; url: string } | { kind: "video" }> = [
    ...(hasVideo ? [{ kind: "video" as const }] : []),
    ...item.photos.map((p) => ({ kind: "photo" as const, url: p.url })),
  ];
  const total        = slides.length;
  const currentSlide = slides[photoIndex] ?? null;

  function prev() { setPhotoIndex((i) => (i - 1 + total) % total); }
  function next() { setPhotoIndex((i) => (i + 1) % total); }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [photoIndex, total]);

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-[#085C52]/85 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-[#0c2e2a] shadow-2xl"
        onClick={(e) => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        <button onClick={onClose} type="button"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110">✕</button>

        {total > 1 && (
          <div className="absolute left-3 top-3 z-20 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {photoIndex + 1} / {total}
          </div>
        )}

        <div className="relative">
          {currentSlide?.kind === "video" && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              {embedUrl ? (
                <iframe src={embedUrl} className="absolute inset-0 h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.title} />
              ) : isDirect ? (
                <video src={item.video_url!} className="absolute inset-0 h-full w-full object-contain bg-black"
                  controls autoPlay poster={item.photos[0]?.url} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  {item.photos[0] && <img src={item.photos[0].url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
                  <a href={item.video_url!} target="_blank" rel="noopener noreferrer"
                    className="relative z-10 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#085C52] shadow-xl hover:bg-teal-50">▶ Watch video</a>
                </div>
              )}
            </div>
          )}
          {currentSlide?.kind === "photo" && (
            <div className="relative max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={currentSlide.url} alt={item.title} className="max-h-[70vh] w-full object-contain" />
            </div>
          )}
          {!currentSlide && (
            <div className="flex h-48 items-center justify-center text-5xl opacity-20">
              {item.type === "attraction" ? "🏝️" : item.type === "partner" ? "🏪" : "🎬"}
            </div>
          )}
          {total > 1 && (
            <>
              <button type="button" onClick={prev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 text-lg">‹</button>
              <button type="button" onClick={next}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 text-lg">›</button>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 bg-[#0c2e2a] pt-3 pb-1">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => setPhotoIndex(i)}
                className={`rounded-full transition-all ${i === photoIndex ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/30 hover:bg-white/60"}`} />
            ))}
          </div>
        )}

        {item.photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto bg-[#0a2420] px-4 py-3">
            {slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setPhotoIndex(i)}
                className={`shrink-0 overflow-hidden rounded-lg transition-all ${i === photoIndex ? "ring-2 ring-white scale-105" : "opacity-50 hover:opacity-80"}`}>
                {s.kind === "video"
                  ? <div className="flex h-12 w-16 items-center justify-center bg-black/60 text-lg">▶</div>
                  : <img src={s.url} alt="" className="h-12 w-16 object-cover" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-4 bg-[#0c2e2a] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{item.tag}</p>
            <p className="mt-0.5 text-lg font-bold leading-snug text-white">{item.title}</p>
            {item.type === "partner" && (
              <span className="mt-1 inline-block rounded border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/50">Partner Ad</span>
            )}
          </div>
          {item.href && (
            <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#0c7b93] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0f766e]">
              Learn more →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Netflix-style portrait card ──────────────────────────────────────────────
function NetflixCard({ item, onClick }: { item: DiscoverItem; onClick: () => void }) {
  const cover      = item.photos[0]?.url ?? null;
  const hasVideo   = !!item.video_url;
  const photoCount = item.photos.length;

  return (
    <button type="button" onClick={onClick}
      className="group relative shrink-0 w-44 sm:w-52 overflow-hidden rounded-2xl text-left shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7b93]">

      {/* Portrait 3:4 ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-teal-100 to-[#99d6d4]/60">
        {cover ? (
          <img src={cover} alt={item.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl opacity-20">
              {item.type === "video" ? "🎬" : item.type === "attraction" ? "🏝️" : "🏪"}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {/* Play button */}
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg shadow-lg transition-all group-hover:scale-110 group-hover:bg-white">▶</span>
          </div>
        )}

        {/* Zoom icon for photo-only on hover */}
        {!hasVideo && cover && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-sm shadow-lg">🔍</span>
          </div>
        )}

        {/* Top badges */}
        {item.is_featured && item.type !== "partner" && (
          <span className="absolute left-2 top-2 rounded-lg bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">✨</span>
        )}
        {item.type === "partner" && (
          <span className="absolute right-2 top-2 rounded border border-white/30 bg-black/40 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">Ad</span>
        )}
        {photoCount > 1 && (
          <span className="absolute left-2 top-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">📸{photoCount}</span>
        )}

        {/* Bottom text */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/55 truncate">{item.tag}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight text-white drop-shadow">{item.title}</p>
        </div>
      </div>
    </button>
  );
}

// ─── Main public section ──────────────────────────────────────────────────────
type Tab = "all" | "video" | "attraction" | "partner";
const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "video",      label: "📹 Videos" },
  { key: "attraction", label: "🗺️ Attractions" },
  { key: "partner",    label: "🤝 Partners" },
];

export function DiscoverSiargaoPublic({ items }: { items: DiscoverItem[] }) {
  const [activeTab, setActiveTab]         = useState<Tab>("all");
  const [modalItem, setModalItem]         = useState<DiscoverItem | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const filtered = items.filter((i) => activeTab === "all" || i.type === activeTab);

  function openModal(item: DiscoverItem) {
    if (item.photos.length > 0 || item.video_url) { setModalItem(item); return; }
    if (item.href) window.open(item.href, item.href.startsWith("http") ? "_blank" : "_self");
  }

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  // Check on mount and tab change
  useEffect(() => {
    setTimeout(checkScroll, 50);
  }, [activeTab]);

  function scrollBy(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  }

  return (
    <>
      {modalItem && <GalleryModal item={modalItem} onClose={() => setModalItem(null)} />}

      <section className="border-t border-teal-200/50 bg-[#fef9e7]/40 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Header row */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">
                Explore the Island
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#134e4a] sm:text-3xl">
                🌊 Discover Siargao
              </h2>
              <p className="mt-1 text-sm text-[#0f766e]">
                Attractions, videos &amp; featured local businesses
              </p>
            </div>

            {/* Tab filters */}
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    activeTab === tab.key
                      ? "border-[#0c7b93] bg-[#0c7b93] text-white shadow-sm"
                      : "border-teal-200 bg-white text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scroll row */}
          <div className="relative">

            {/* Left arrow */}
            {canScrollLeft && (
              <button type="button" onClick={() => scrollBy("left")}
                className="absolute -left-4 top-1/2 z-10 -translate-y-6 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-teal-200 text-[#134e4a] text-xl shadow-lg transition-all hover:border-[#0c7b93] hover:scale-110">
                ‹
              </button>
            )}

            {/* Right arrow */}
            {canScrollRight && (
              <button type="button" onClick={() => scrollBy("right")}
                className="absolute -right-4 top-1/2 z-10 -translate-y-6 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-teal-200 text-[#134e4a] text-xl shadow-lg transition-all hover:border-[#0c7b93] hover:scale-110">
                ›
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#0f766e]/50">No items in this category yet.</p>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  onScroll={checkScroll}
                  className="flex gap-4 overflow-x-auto pb-4"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {filtered.map((item) => (
                    <NetflixCard key={item.id} item={item} onClick={() => openModal(item)} />
                  ))}
                  {/* Spacer so last card doesn't sit against the edge */}
                  <div className="shrink-0 w-4" aria-hidden />
                </div>

                {/* Right fade hint */}
                {canScrollRight && (
                  <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-[#fef9e7]/80 to-transparent" />
                )}
              </>
            )}
          </div>

          {/* Mobile swipe hint */}
          {filtered.length > 2 && (
            <p className="mt-1 text-center text-xs text-[#0f766e]/40 sm:hidden">← Swipe to explore →</p>
          )}

        </div>
      </section>
    </>
  );
}
