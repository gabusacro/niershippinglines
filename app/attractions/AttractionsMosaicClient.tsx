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

// Row heights — small / medium / large variety
const HEIGHT_POOL = [200, 320, 240, 360, 200, 280, 200, 340, 260, 200, 220, 320, 200];

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
  onViewPhotos,
}: {
  attraction: AttractionItem;
  baseHeight: number;
  isExpanded: boolean;
  isAnyExpanded: boolean;
  onToggle: () => void;
  onViewPhotos: () => void;
}) {
  const imageUrls = resolveImageUrls(attraction);
  const hasImages = imageUrls.length > 0;
  const emoji     = getEmoji(attraction.category);
  const isTall    = baseHeight >= 300;

  // When expanded: span 3 cols and grow very tall
  const expandedH = 580;
  const finalH    = isExpanded ? expandedH : baseHeight;

  return (
    <div
      onClick={onToggle}
      style={{
        // CSS Grid placement — expanded card spans 3 columns
        gridColumn:   isExpanded ? "span 3" : "span 1",
        gridRow:      "span 1",
        height:       finalH,
        borderRadius: isExpanded ? 18 : 13,
        overflow:     "hidden",
        position:     "relative",
        cursor:       "pointer",
        border:       isExpanded ? "2.5px solid #0c7b93" : "1.5px solid #d1fae5",
        background:   "#b2d8d8",
        transition: [
          "height 0.55s cubic-bezier(0.34,1.05,0.64,1)",
          "opacity 0.32s ease",
          "transform 0.32s ease",
          "box-shadow 0.28s ease",
          "border-radius 0.35s ease",
        ].join(", "),
        opacity:    isAnyExpanded && !isExpanded ? 0.38 : 1,
        transform:  isExpanded ? "scale(1.01)" : isAnyExpanded ? "scale(0.97)" : "scale(1)",
        filter:     isAnyExpanded && !isExpanded ? "brightness(0.58) saturate(0.5)" : "none",
        boxShadow:  isExpanded
          ? "0 16px 56px rgba(12,123,147,0.28), 0 0 0 4px rgba(12,123,147,0.1)"
          : isAnyExpanded ? "0 2px 6px rgba(0,0,0,0.06)"
          : "0 3px 12px rgba(0,0,0,0.09)",
        willChange: "height, transform, opacity",
        zIndex:     isExpanded ? 10 : 1,
      }}
    >
      {/* ── Photo background ── */}
      <div style={{
        position:           "absolute", inset: 0,
        backgroundImage:    hasImages ? `url(${imageUrls[0]})` : "none",
        backgroundSize:     "cover",
        backgroundPosition: "center",
        backgroundColor:    "#a8d5d1",
        transition:         "transform 0.65s ease",
        transform:          isExpanded ? "scale(1.04)" : "scale(1)",
        zIndex:             0,
      }}>
        {!hasImages && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 52, background: "linear-gradient(135deg,#ccede9,#a7f3d0)",
          }}>
            {emoji}
          </div>
        )}
      </div>

      {/* ── Gradient — deep dark at bottom when expanded so text pops ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: isExpanded
          ? "linear-gradient(to top, rgba(10,55,52,0.98) 0%, rgba(10,55,52,0.9) 38%, rgba(10,55,52,0.25) 65%, transparent 100%)"
          : "linear-gradient(to top, rgba(10,60,58,0.92) 0%, rgba(10,60,58,0.28) 50%, transparent 100%)",
        transition: "background 0.45s ease",
      }} />

      {/* ── Top accent bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 2,
        background: "linear-gradient(90deg,#0c7b93,#0d9488,transparent)",
        opacity: isExpanded ? 1 : 0.4, transition: "opacity 0.3s", pointerEvents: "none",
      }} />

      {/* ── Category badge ── */}
      <div style={{
        position: "absolute", top: 11, left: 11, zIndex: 3,
        padding: "3px 10px", borderRadius: 999,
        fontSize: 11, fontWeight: 700, color: "#fff",
        background: "rgba(13,78,74,0.82)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.2)", letterSpacing: "0.04em",
        opacity: isExpanded ? 0 : 1, transition: "opacity 0.22s",
        userSelect: "none", pointerEvents: "none",
      }}>
        {emoji} {attraction.category ?? "Attraction"}
      </div>

      {/* ── ×/+ button ── */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          position: "absolute", top: 11, right: 11, zIndex: 4,
          width: 30, height: 30, borderRadius: "50%",
          background: isExpanded ? "#0c7b93" : "rgba(13,78,74,0.75)",
          backdropFilter: "blur(8px)",
          border: `1.5px solid ${isExpanded ? "#0c7b93" : "rgba(255,255,255,0.28)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.3s",
          boxShadow: isExpanded ? "0 0 16px rgba(12,123,147,0.6)" : "none",
          userSelect: "none",
        }}
      >
        <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ transform: isExpanded ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>

      {/* ── Bottom content ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3,
        padding: isExpanded ? "22px 20px 20px" : "11px 13px 10px",
        transition: "padding 0.4s",
      }}>
        <h2 style={{
          fontSize:      isExpanded ? 28 : (isTall ? 17 : 15),
          fontWeight:    800, color: "#fff", lineHeight: 1.15,
          marginTop: 0, marginBottom: isExpanded ? 10 : 0,
          marginLeft: 0, marginRight: 0,
          transition:    "font-size 0.38s",
          textShadow:    "0 2px 12px rgba(0,0,0,0.5)",
          letterSpacing: "-0.02em",
        }}>
          {attraction.title}
        </h2>

        {!isExpanded && isTall && attraction.short && (
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.7)",
            lineHeight: 1.5, marginTop: 4, marginBottom: 0,
          }}>
            {attraction.short}
          </p>
        )}

        {/* Expanded detail */}
        <div style={{
          maxHeight:  isExpanded ? 600 : 0,
          overflow:   "hidden",
          opacity:    isExpanded ? 1 : 0,
          transition: "max-height 0.55s ease, opacity 0.38s ease 0.1s",
        }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 12 }} />

          {attraction.short && (
            <p style={{
              fontSize: 14, color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5, marginBottom: 8, fontStyle: "italic",
            }}>
              {attraction.short}
            </p>
          )}

          <p style={{
            fontSize: 14, color: "rgba(255,255,255,0.9)",
            lineHeight: 1.7, marginBottom: 16,
          }}>
            {attraction.description ?? ""}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
            {attraction.category && (
              <span style={{
                padding: "4px 12px", borderRadius: 999,
                fontSize: 12, fontWeight: 700, color: "#fff",
                background: "rgba(12,123,147,0.55)",
                border: "1px solid rgba(12,123,147,0.8)",
              }}>
                {emoji} {attraction.category}
              </span>
            )}
            {hasImages && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onViewPhotos(); }}
                style={{
                  padding: "4px 12px", borderRadius: 999,
                  fontSize: 12, fontWeight: 700, color: "#fff",
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                }}>
                🖼 {imageUrls.length > 1 ? `View ${imageUrls.length} photos` : "View photo"}
              </button>
            )}
          </div>

          <Link href={ROUTES.book} onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0c7b93] hover:bg-[#0f766e] text-white text-sm font-bold transition-colors"
            style={{ textDecoration: "none" }}>
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

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

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

  const handleViewPhotos = useCallback((attraction: AttractionItem) => {
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

  const shuffledAttractions = seededShuffle(attractions, seed);
  const shuffledHeights      = seededShuffle(HEIGHT_POOL, seed + 7);

  const visible = shuffledAttractions.filter((a) => {
    const mc = activeCategory === "All" || a.category === activeCategory;
    const ms = !search
      || a.title.toLowerCase().includes(search.toLowerCase())
      || (a.description ?? "").toLowerCase().includes(search.toLowerCase());
    return mc && ms;
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
                className="text-[#7a9088] hover:text-[#134e4a] transition-colors text-base leading-none">✕
              </button>
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

        {/* ── CSS Grid masonry — expanded card spans 3 cols, others reflow ── */}
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
          <div
            className="attractions-grid"
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridAutoRows:        "1px",
              gap:                 12,
              opacity:             fading ? 0.12 : 1,
              transform:           fading ? "scale(0.988)" : "scale(1)",
              transition:          "opacity 0.32s ease, transform 0.32s ease",
            }}
          >
            {visible.map((attraction, i) => {
              const bh = shuffledHeights[i % HEIGHT_POOL.length] ?? 220;
              const isExp = expanded === attraction.id;
              const finalH = isExp ? 580 : bh;
              // gridRowEnd = height + 12 gap (1px rows)
              const rowSpan = finalH + 12;
              return (
                <div
                  key={`${String(attraction.id)}-${seed}`}
                  style={{
                    gridColumn:    isExp ? "span 3" : "span 1",
                    gridRowEnd:    `span ${rowSpan}`,
                    transition:    "grid-column 0.55s ease",
                  }}
                >
                  <MosaicCard
                    attraction={attraction}
                    baseHeight={bh}
                    isExpanded={isExp}
                    isAnyExpanded={expanded !== null}
                    onToggle={() => handleToggle(attraction.id)}
                    onViewPhotos={() => handleViewPhotos(attraction)}
                  />
                </div>
              );
            })}
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
        @media (max-width: 960px) {
          .attractions-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .attractions-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .attractions-grid [style*="span 3"] { grid-column: span 2 !important; }
        }
      `}</style>
    </>
  );
}
