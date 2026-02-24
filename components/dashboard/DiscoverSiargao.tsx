"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DiscoverItem } from "@/lib/dashboard/get-discover-items";

type Tab = "all" | "video" | "attraction" | "partner";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "video",      label: "📹 Videos" },
  { key: "attraction", label: "🗺️ Attractions" },
  { key: "partner",    label: "🤝 Partners" },
];

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

// ─── Gallery Modal ────────────────────────────────────────────────────────────
function GalleryModal({ item, onClose }: { item: DiscoverItem; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const hasPhotos   = item.photos.length > 0;
  const hasVideo    = !!item.video_url; // all types can have video in modal
  const embedUrl    = item.video_url ? toEmbedUrl(item.video_url) : null;
  const isDirect    = item.video_url ? isDirectVideo(item.video_url) : false;

  // When viewing a video item, first "slide" is the video, then photos
  // For non-video items, slides are just photos
  const slides: Array<{ kind: "photo"; url: string } | { kind: "video" }> = [
    ...(hasVideo ? [{ kind: "video" as const }] : []),
    ...item.photos.map((p) => ({ kind: "photo" as const, url: p.url })),
  ];

  const total       = slides.length;
  const currentSlide = slides[photoIndex] ?? null;

  function prev() { setPhotoIndex((i) => (i - 1 + total) % total); }
  function next() { setPhotoIndex((i) => (i + 1) % total); }

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   prev();
      if (e.key === "ArrowRight")  next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [photoIndex, total]);

  // Touch swipe
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

      <div
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-[#0c2e2a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close */}
        <button onClick={onClose} type="button"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110">
          ✕
        </button>

        {/* Slide counter */}
        {total > 1 && (
          <div className="absolute left-3 top-3 z-20 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {photoIndex + 1} / {total}
          </div>
        )}

        {/* ── Slide content ── */}
        <div className="relative">

          {/* VIDEO slide */}
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
                    className="relative z-10 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#085C52] shadow-xl hover:bg-teal-50">
                    ▶ Watch video
                  </a>
                </div>
              )}
            </div>
          )}

          {/* PHOTO slide */}
          {currentSlide?.kind === "photo" && (
            <div className="relative max-h-[70vh] overflow-hidden flex items-center justify-center bg-black">
              <img src={currentSlide.url} alt={item.title}
                className="max-h-[70vh] w-full object-contain" />
            </div>
          )}

          {/* No media */}
          {!currentSlide && (
            <div className="flex h-48 items-center justify-center text-5xl opacity-20">
              {item.type === "attraction" ? "🏝️" : item.type === "partner" ? "🏪" : "🎬"}
            </div>
          )}

          {/* ── Prev / Next arrows ── */}
          {total > 1 && (
            <>
              <button type="button" onClick={prev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 text-lg">
                ‹
              </button>
              <button type="button" onClick={next}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 text-lg">
                ›
              </button>
            </>
          )}
        </div>

        {/* ── Dot indicators ── */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 bg-[#0c2e2a] pt-3 pb-1">
            {slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setPhotoIndex(i)}
                className={`rounded-full transition-all ${
                  i === photoIndex
                    ? "w-5 h-2 bg-white"
                    : "w-2 h-2 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Thumbnail strip (if 2+ photos) ── */}
        {item.photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto bg-[#0a2420] px-4 py-3 scrollbar-hide">
            {slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setPhotoIndex(i)}
                className={`shrink-0 overflow-hidden rounded-lg transition-all ${
                  i === photoIndex ? "ring-2 ring-white scale-105" : "opacity-50 hover:opacity-80"
                }`}
              >
                {s.kind === "video" ? (
                  <div className="flex h-12 w-16 items-center justify-center bg-black/60 text-lg">▶</div>
                ) : (
                  <img src={s.url} alt="" className="h-12 w-16 object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Info strip ── */}
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

// ─── Main component ───────────────────────────────────────────────────────────
export function DiscoverSiargao({ items }: { items: DiscoverItem[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [modalItem, setModalItem] = useState<DiscoverItem | null>(null);

  if (!items || items.length === 0) return null;

  const filtered = items.filter((item) => activeTab === "all" || item.type === activeTab);
  const featured = filtered.find((i) => i.is_featured) ?? filtered[0];
  const rest      = filtered.filter((i) => i.id !== featured?.id);

  function openModal(item: DiscoverItem) {
    // Open modal if there is anything to show — photos or video
    if (item.photos.length > 0 || item.video_url) { setModalItem(item); return; }
    // No media — fall back to href
    if (item.href) window.open(item.href, item.href.startsWith("http") ? "_blank" : "_self");
  }

  const coverUrl = (item: DiscoverItem) => item.photos[0]?.url ?? null;

  return (
    <>
      {modalItem && <GalleryModal item={modalItem} onClose={() => setModalItem(null)} />}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] to-[#0c7b93] p-6 shadow-lg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(26,181,163,0.2)_0%,transparent_60%)]" />

        {/* Header + tabs */}
        <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold leading-tight text-white">🌊 Discover Siargao</h2>
            <p className="mt-0.5 text-sm text-white/55">Curated places, travel videos &amp; featured partners</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? "border-white bg-white text-[#085C52]"
                    : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/50">No items in this category yet.</p>
        ) : (
          <div className="relative space-y-3">
            {featured && <CardLarge item={featured} cover={coverUrl(featured)} onClick={() => openModal(featured)} />}
            {rest.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {rest.map((item) => (
                  <CardSmall key={item.id} item={item} cover={coverUrl(item)} onClick={() => openModal(item)} />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="relative mt-4 text-center text-xs text-white/30">
          Want to feature your Siargao business here?{" "}
          <a href="mailto:gabu.sacro@gmail.com" className="text-white/50 underline transition-colors hover:text-white/80">Contact us</a>
        </p>
      </div>
    </>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function CardLarge({ item, cover, onClick }: { item: DiscoverItem; cover: string | null; onClick: () => void }) {
  const photoCount = item.photos.length;
  return (
    <button type="button" onClick={onClick}
      className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-left transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">

      {cover ? (
        <img src={cover} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.06]">
          <span className="select-none text-[5rem] opacity-20">{item.type === "video" ? "🎬" : item.type === "attraction" ? "🏝️" : "🏪"}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/25 transition-opacity group-hover:bg-black/40" />

      {item.is_featured && (
        <span className="absolute left-3 top-3 z-10 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">✨ Featured</span>
      )}
      {item.type === "partner" && (
        <span className="absolute right-3 top-3 z-10 rounded border border-white/30 bg-black/30 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">Partner Ad</span>
      )}

      {/* Photo count badge */}
      {photoCount > 1 && (
        <span className="absolute right-3 bottom-14 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
          📸 {photoCount}
        </span>
      )}

      {item.video_url ? (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl shadow-2xl transition-all group-hover:scale-110 group-hover:bg-white">▶</span>
      ) : cover ? (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/0 text-xl opacity-0 shadow-2xl transition-all group-hover:bg-white/90 group-hover:opacity-100">🔍</span>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{item.tag}</p>
        <p className="mt-0.5 text-xl font-bold leading-snug text-white drop-shadow">{item.title}</p>
        <p className="mt-1 text-xs text-white/55">
          {item.video_url
            ? "▶ Tap to watch"
            : photoCount > 1
              ? `🖼 ${photoCount} photos — tap to view`
              : "🔍 Tap to view"}
        </p>
      </div>
    </button>
  );
}

function CardSmall({ item, cover, onClick }: { item: DiscoverItem; cover: string | null; onClick: () => void }) {
  const photoCount = item.photos.length;
  return (
    <button type="button" onClick={onClick}
      className="group relative flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl text-left transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">

      {cover ? (
        <img src={cover} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.06]">
          <span className="select-none text-[3rem] opacity-20">{item.type === "video" ? "🎬" : item.type === "attraction" ? "🏝️" : "🏪"}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/20 transition-opacity group-hover:bg-black/40" />

      {item.type === "partner" && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[9px] text-white/70 backdrop-blur-sm">Ad</span>
      )}
      {photoCount > 1 && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">📸{photoCount}</span>
      )}

      {item.video_url ? (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm shadow-lg transition-all group-hover:scale-110 group-hover:bg-white">▶</span>
      ) : cover ? (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/0 text-sm opacity-0 transition-all group-hover:bg-white/90 group-hover:opacity-100">🔍</span>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/75 to-transparent p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/65">{item.tag}</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">{item.title}</p>
      </div>
    </button>
  );
}
