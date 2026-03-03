// app/attractions/AttractionsMosaicClient.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { AttractionImageModal } from "./AttractionImageModal";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AttractionItem = {
  id: string | number;
  title: string;
  short?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  category?: string | null;
};

type ModalState = {
  title: string;
  imageUrls: string[];
  initialIndex: number;
} | null;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  Surfing:          "🏄",
  Islands:          "🏝️",
  Beaches:          "🌅",
  Adventure:        "🧗",
  "Rivers & Caves": "🌿",
};

const CATEGORIES = ["All", "Beaches", "Islands", "Surfing", "Rivers & Caves", "Adventure"];

// Heights per card slot — varied to create the bento feel
const HEIGHT_POOL = [220, 340, 260, 380, 220, 300, 240, 360, 260, 220, 220, 340, 220];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInterval(): number {
  return Math.floor(Math.random() * 15_000) + 30_000;
}

function resolveImageUrls(a: AttractionItem): string[] {
  if (a.image_urls && a.image_urls.length > 0) return a.image_urls;
  if (a.image_url) return [a.image_url];
  return [];
}

function getEmoji(category?: string | null): string {
  if (!category) return "📍";
  return CATEGORY_EMOJI[category] ?? "📍";
}

// ─── Single Card ──────────────────────────────────────────────────────────────
function MosaicCard({
  attraction,
  baseHeight,
  isExpanded,
  isAnyExpanded,
  onToggle,
  onImageClick,
}: {
  attraction: AttractionItem;
  baseHeight: number;
  isExpanded: boolean;
  isAnyExpanded: boolean;
  onToggle: () => void;
  onImageClick: () => void;
}) {
  const imageUrls = resolveImageUrls(attraction);
  const hasImages = imageUrls.length > 0;
  const emoji     = getEmoji(attraction.category);
  const expandedH = Math.min(baseHeight + 300, 620);
  const finalH    = isExpanded ? expandedH : baseHeight;
  const isTall    = baseHeight >= 300;

  return (
    <div
      style={{
        height:       finalH,
        borderRadius: 14,
        overflow:     "hidden",
        position:     "relative",
        cursor:       "pointer",
        marginBottom: 12,
        flexShrink:   0,
        border:       isExpanded ? "2px solid #0c7b93" : "1.5px solid #d1fae5",
        background:   "#c8e6e4",
        transition: [
          "height 0.52s cubic-bezier(0.34,1.1,0.64,1)",
          "opacity 0.35s ease",
          "transform 0.35s ease",
          "box-shadow 0.28s ease",
          "border-color 0.25s ease",
        ].join(", "),
        opacity:    isAnyExpanded && !isExpanded ? 0.44 : 1,
        transform:  isExpanded ? "scale(1.012)" : isAnyExpanded ? "scale(0.968)" : "scale(1)",
        filter:     isAnyExpanded && !isExpanded ? "brightness(0.7) saturate(0.7)" : "none",
        boxShadow:  isExpanded
          ? "0 10px 40px rgba(12,123,147,0.22), 0 0 0 3px rgba(12,123,147,0.09)"
          : isAnyExpanded ? "0 2px 6px rgba(0,0,0,0.07)"
          : "0 3px 12px rgba(0,0,0,0.09)",
        willChange: "height, transform, opacity",
      }}
      onClick={onToggle}
    >
      {/* ── Photo (click = open modal) ── */}
      <div
        onClick={(e) => { e.stopPropagation(); if (hasImages) onImageClick(); }}
        className="photo-tap"
        style={{
          position:           "absolute",
          inset:              0,
          backgroundImage:    hasImages ? `url(${imageUrls[0]})` : "none",
          backgroundSize:     "cover",
          backgroundPosition: "center",
          backgroundColor:    "#a8d5d1",
          transition:         "transform 0.6s ease",
          transform:          isExpanded ? "scale(1.06)" : "scale(1)",
          cursor:             hasImages ? "zoom-in" : "default",
          zIndex:             0,
        }}
      >
        {!hasImages && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 44, background: "linear-gradient(135deg,#ccede9,#a7f3d0)",
          }}>
            {emoji}
          </div>
        )}
        {hasImages && (
          <div className="photo-hint" style={{
            position: "absolute", inset: 0,
            background: "rgba(12,123,147,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0, transition: "opacity 0.2s", pointerEvents: "none",
          }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 999,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
              color: "white", fontSize: 11, fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              🖼 {imageUrls.length > 1 ? `${imageUrls.length} photos` : "View photo"}
            </span>
          </div>
        )}
      </div>

      {/* ── Gradient ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: isExpanded
          ? "linear-gradient(to top, rgba(13,78,74,0.97) 0%, rgba(13,78,74,0.82) 30%, rgba(13,78,74,0.18) 62%, transparent 100%)"
          : "linear-gradient(to top, rgba(10,60,58,0.9) 0%, rgba(10,60,58,0.35) 46%, transparent 100%)",
        transition: "background 0.45s ease",
      }} />

      {/* ── Top accent ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 2,
        background: "linear-gradient(90deg,#0c7b93,#0d9488,transparent)",
        opacity: isExpanded ? 1 : 0.4, transition: "opacity 0.3s", pointerEvents: "none",
      }} />

      {/* ── Category badge (top-left) ── */}
      <div
        onClick={onToggle}
        style={{
          position: "absolute", top: 10, left: 10, zIndex: 3,
          padding: "3px 10px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, color: "#fff",
          background: "rgba(13,78,74,0.82)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.2)",
          letterSpacing: "0.04em", cursor: "pointer",
          opacity: isExpanded ? 0 : 1, transition: "opacity 0.2s",
          userSelect: "none",
        }}
      >
        {emoji} {attraction.category ?? "Attraction"}
      </div>

      {/* ── +/× button (top-right) ── */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 3,
          width: 28, height: 28, borderRadius: "50%",
          background: isExpanded ? "#0c7b93" : "rgba(13,78,74,0.72)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${isExpanded ? "#0c7b93" : "rgba(255,255,255,0.22)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.3s",
          boxShadow: isExpanded ? "0 0 14px rgba(12,123,147,0.55)" : "none",
          userSelect: "none",
        }}
      >
        <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ transform: isExpanded ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>

      {/* ── Bottom content ── */}
      <div
        onClick={onToggle}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
          padding: isExpanded ? "18px 16px 16px" : "11px 13px 10px",
          transition: "padding 0.4s", cursor: "pointer",
        }}
      >
        <h2 style={{
          fontSize:      isExpanded ? 22 : (isTall ? 17 : 15),
          fontWeight:    700, color: "#fff", lineHeight: 1.2,
          marginTop:     0, marginBottom: isExpanded ? 6 : 0,
          marginLeft:    0, marginRight: 0,
          transition:    "font-size 0.3s",
          textShadow:    "0 2px 10px rgba(0,0,0,0.45)",
          letterSpacing: "-0.01em",
        }}>
          {attraction.title}
        </h2>

        {!isExpanded && isTall && attraction.short && (
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.72)",
            lineHeight: 1.5, marginTop: 4, marginBottom: 0,
          }}>
            {attraction.short}
          </p>
        )}

        {/* Expanded detail — slides open */}
        <div style={{
          maxHeight:  isExpanded ? 500 : 0,
          overflow:   "hidden",
          opacity:    isExpanded ? 1 : 0,
          transition: "max-height 0.52s ease, opacity 0.38s ease",
        }}>
          <div style={{ height: 8 }} />
          {attraction.short && (
            <p style={{
              fontSize: 13, color: "rgba(255,255,255,0.72)",
              lineHeight: 1.5, marginBottom: 7, fontStyle: "italic",
            }}>
              {attraction.short}
            </p>
          )}
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.87)",
            lineHeight: 1.65, marginBottom: 13,
          }}>
            {attraction.description ?? ""}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {attraction.category && (
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                fontSize: 11, fontWeight: 700, color: "#fff",
                background: "rgba(12,123,147,0.5)",
                border: "1px solid rgba(12,123,147,0.7)",
              }}>
                {emoji} {attraction.category}
              </span>
            )}
            {hasImages && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onImageClick(); }}
                style={{
                  padding: "3px 10px", borderRadius: 999,
                  fontSize: 11, fontWeight: 700, color: "#fff",
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                🖼 {imageUrls.length > 1 ? `${imageUrls.length} photos` : "View photo"}
              </button>
            )}
          </div>

          <Link
            href={ROUTES.book}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 min-h-[40px] px-4 py-2 rounded-xl bg-[#0c7b93] hover:bg-[#0f766e] text-white text-sm font-semibold transition-colors"
            style={{ textDecoration: "none" }}
          >
            Book your trip to Siargao →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AttractionsMosaicClient({ attractions }: { attractions: AttractionItem[] }) {
  const [seed, setSeed]                     = useState(1);
  const [fading, setFading]                 = useState(false);
  const [expanded, setExpanded]             = useState<string | number | null>(null);
  const [modal, setModal]                   = useState<ModalState>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch]                 = useState("");
  const [numCols, setNumCols]               = useState(4);

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  // Responsive columns
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setNumCols(w < 640 ? 2 : w < 960 ? 3 : 4);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-shuffle
  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pausedRef.current) { scheduleNext(); return; }
      setFading(true);
      setTimeout(() => {
        setSeed((s) => s + 1);
        setExpanded(null);
        setFading(false);
        scheduleNext();
      }, 320);
    }, randomInterval());
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scheduleNext]);

  const handleToggle = useCallback((id: string | number) => {
    setExpanded((prev) => (prev === id ? null : id));
    pausedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      pausedRef.current = false;
      scheduleNext();
    }, 8000);
  }, [scheduleNext]);

  const handleImageClick = useCallback((attraction: AttractionItem) => {
    const urls = resolveImageUrls(attraction);
    if (!urls.length) return;
    setModal({ title: attraction.title, imageUrls: urls, initialIndex: 0 });
    pausedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleModalClose = useCallback(() => {
    setModal(null);
    timerRef.current = setTimeout(() => {
      pausedRef.current = false;
      scheduleNext();
    }, 5000);
  }, [scheduleNext]);

  // Shuffle & filter
  const shuffledAttractions = seededShuffle(attractions, seed);
  const shuffledHeights      = seededShuffle(HEIGHT_POOL, seed + 7);

  const visible = shuffledAttractions.filter((a) => {
    const mc = activeCategory === "All" || a.category === activeCategory;
    const ms = !search
      || a.title.toLowerCase().includes(search.toLowerCase())
      || (a.description ?? "").toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  // Distribute into columns shortest-first (true masonry)
  const cols: AttractionItem[][] = Array.from({ length: numCols }, () => []);
  const colHeights               = new Array<number>(numCols).fill(0);
  const colCardHeights: number[][] = Array.from({ length: numCols }, () => []);

  visible.forEach((a, i) => {
    const h = shuffledHeights[i % HEIGHT_POOL.length] ?? 220;
    const shortest = colHeights.indexOf(Math.min(...colHeights));
    cols[shortest].push(a);
    colHeights[shortest] += h + 12;
    colCardHeights[shortest].push(h);
  });

  const hasCategories = attractions.some((a) => a.category);

  return (
    <>
      {modal && (
        <AttractionImageModal
          title={modal.title}
          imageUrls={modal.imageUrls}
          initialIndex={modal.initialIndex}
          onClose={handleModalClose}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-teal-200 rounded-xl px-3 py-2 focus-within:border-[#0c7b93] focus-within:ring-2 focus-within:ring-[#0c7b93]/15 transition-all w-full sm:w-64">
            <svg className="w-4 h-4 text-[#0f766e] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Search attractions…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-[#134e4a] placeholder-[#7a9088] focus:outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="text-[#7a9088] hover:text-[#134e4a] transition-colors text-base leading-none">✕</button>
            )}
          </div>

          {hasCategories && (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all border ${
                    activeCategory === cat
                      ? "bg-[#134e4a] text-white border-[#134e4a] shadow-sm"
                      : "bg-white text-[#0f766e] border-teal-200 hover:border-[#0c7b93] hover:text-[#0c7b93]"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          <span className="sm:ml-auto text-xs text-[#7a9088] font-medium whitespace-nowrap">
            {visible.length} attraction{visible.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Masonry grid — flex columns, no CSS grid, no gaps */}
        {visible.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-[#0f766e] font-semibold">No attractions found</p>
            <button onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="mt-4 px-4 py-2 rounded-xl border border-teal-200 text-sm text-[#0f766e] font-semibold hover:border-[#0c7b93] hover:text-[#0c7b93] transition-all bg-white">
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{
            display:    "flex",
            gap:        12,
            alignItems: "flex-start",
            opacity:    fading ? 0.12 : 1,
            transform:  fading ? "scale(0.988)" : "scale(1)",
            transition: "opacity 0.32s ease, transform 0.32s ease",
          }}>
            {cols.map((colItems, ci) => (
              <div key={`col-${ci}-${seed}`} style={{ flex: 1, minWidth: 0 }}>
                {colItems.map((attraction, ri) => (
                  <MosaicCard
                    key={`${String(attraction.id)}-${seed}`}
                    attraction={attraction}
                    baseHeight={colCardHeights[ci][ri] ?? 220}
                    isExpanded={expanded === attraction.id}
                    isAnyExpanded={expanded !== null}
                    onToggle={() => handleToggle(attraction.id)}
                    onImageClick={() => handleImageClick(attraction)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 sm:mt-12 rounded-xl bg-[#fef3c7]/50 border border-teal-100 p-4 sm:p-6 text-center">
          <p className="text-[#134e4a] font-medium text-sm sm:text-base">Ready to go?</p>
          <p className="mt-1 text-xs sm:text-sm text-[#0f766e]">
            Book your ferry from Surigao to Siargao and start your island adventure.
          </p>
          <Link href={ROUTES.book}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors w-full sm:w-auto">
            Book a trip
          </Link>
        </div>
      </div>

      <style>{`
        .photo-tap:hover .photo-hint { opacity: 1 !important; }
      `}</style>
    </>
  );
}
