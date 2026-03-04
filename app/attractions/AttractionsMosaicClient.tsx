// app/attractions/AttractionsMosaicClient.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { AttractionImageModal } from "./AttractionImageModal";

export type AttractionItem = {
  id: string | number;
  title: string;
  short?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  category?: string | null;
};

type ModalState = { title: string; imageUrls: string[]; initialIndex: number } | null;

const CATEGORY_EMOJI: Record<string, string> = {
  Surfing: "🏄", Islands: "🏝️", Beaches: "🌅",
  Adventure: "🧗", "Rivers & Caves": "🌿",
};
const CATEGORIES = ["All", "Beaches", "Islands", "Surfing", "Rivers & Caves", "Adventure"];

function resolveImageUrls(a: AttractionItem): string[] {
  if (a.image_urls && a.image_urls.length > 0) return a.image_urls;
  if (a.image_url) return [a.image_url];
  return [];
}
function getEmoji(category?: string | null) {
  return CATEGORY_EMOJI[category ?? ""] ?? "📍";
}

// ─── Expanded Card (col-span-3, row-span-3) ───────────────────────────────────
function ExpandedCard({
  attraction,
  onClose,
  onImageClick,
}: {
  attraction: AttractionItem;
  onClose: () => void;
  onImageClick: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const imageUrls = resolveImageUrls(attraction);
  const cover = imageUrls[photoIdx] ?? imageUrls[0] ?? null;
  const desc = attraction.description ?? attraction.short ?? "";
  const emoji = getEmoji(attraction.category);

  return (
    <div
      className="overflow-hidden rounded-2xl shadow-2xl ring-2 ring-[#0c7b93]/60 bg-[#071f1c] flex flex-col sm:flex-row"
      style={{
        gridColumn: "span 3",
        gridRow: "span 3",
        animation: "expandIn 0.4s cubic-bezier(0.34,1.3,0.64,1) both",
        minHeight: 320,
      }}
    >
      {/* Left: photo */}
      <div className="relative sm:w-3/5 w-full flex-shrink-0" style={{ minHeight: 260 }}>
        {cover ? (
          <>
            <img
              src={cover}
              alt={attraction.title}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ animation: "slowZoom 12s ease-out both" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#071f1c] hidden sm:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071f1c]/80 via-transparent to-transparent sm:hidden" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93] flex items-center justify-center">
            <span className="text-6xl opacity-20">{emoji}</span>
          </div>
        )}

        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#0c7b93] via-[#1AB5A3] to-transparent" />

        {/* View photos */}
        {imageUrls.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onImageClick(); }}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-[10px] font-bold text-white border border-white/20 hover:bg-black/70 transition-all"
          >
            🖼 {imageUrls.length > 1 ? `${imageUrls.length} photos` : "View photo"}
          </button>
        )}

        {/* Photo dots */}
        {imageUrls.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {imageUrls.slice(0, 8).map((_, i) => (
              <button key={i} type="button"
                onClick={(e) => { e.stopPropagation(); setPhotoIdx(i); }}
                className={`h-1.5 rounded-full transition-all ${i === photoIdx ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: description panel */}
      <div className="flex flex-col gap-4 p-5 sm:p-6 flex-1 overflow-y-auto relative">
        {/* Close */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all font-bold text-base"
        >
          ×
        </button>

        {/* Category */}
        {attraction.category && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#0c7b93]/30 border border-[#0c7b93]/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#5de0d0]">
            {emoji} {attraction.category}
          </span>
        )}

        {/* Title */}
        <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight pr-8">
          {attraction.title}
        </h3>

        {/* Short tagline */}
        {attraction.short && attraction.description && (
          <p className="text-sm font-semibold text-white/55 italic leading-relaxed border-l-2 border-[#0c7b93]/60 pl-3">
            {attraction.short}
          </p>
        )}

        {/* Full description — always shown */}
        {desc && (
          <p className="text-sm sm:text-base font-semibold text-white/80 leading-relaxed flex-1">
            {desc}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-auto">
          <Link
            href={ROUTES.book}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-black text-white hover:bg-[#0f766e] transition-colors shadow-lg"
          >
            Book your trip →
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/20 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Regular Card (landscape 16/9) ───────────────────────────────────────────
function AttractionCard({
  attraction,
  isAnyExpanded,
  onClick,
}: {
  attraction: AttractionItem;
  isAnyExpanded: boolean;
  onClick: () => void;
}) {
  const imageUrls = resolveImageUrls(attraction);
  const cover = imageUrls[0] ?? null;
  const emoji = getEmoji(attraction.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl shadow-md cursor-pointer aspect-video w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7b93]"
      style={{
        opacity: isAnyExpanded ? 0.45 : 1,
        transform: isAnyExpanded ? "scale(0.97)" : "scale(1)",
        filter: isAnyExpanded ? "brightness(0.6) saturate(0.5)" : "none",
        transition: "opacity 0.35s ease, transform 0.35s ease, filter 0.35s ease",
      }}
    >
      {cover ? (
        <img
          src={cover}
          alt={attraction.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#085C52] to-[#0c7b93] flex items-center justify-center">
          <span className="text-4xl opacity-30">{emoji}</span>
        </div>
      )}

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Hover hint */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/40 text-white text-xl shadow-xl transition-transform group-hover:scale-110">
          +
        </span>
      </div>

      {/* Photo count */}
      {imageUrls.length > 1 && (
        <span className="absolute top-2 right-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
          📸{imageUrls.length}
        </span>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 truncate mb-0.5">
          {emoji} {attraction.category ?? "Attraction"}
        </p>
        <p className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow">
          {attraction.title}
        </p>
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AttractionsMosaicClient({ attractions }: { attractions: AttractionItem[] }) {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setExpandedId(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const filtered = useMemo(() => {
    let list = attractions;
    if (activeCategory !== "All") list = list.filter((a) => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        (a.short ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [attractions, activeCategory, search]);

  const handleImageClick = useCallback((attraction: AttractionItem) => {
    const urls = resolveImageUrls(attraction);
    if (!urls.length) return;
    setModal({ title: attraction.title, imageUrls: urls, initialIndex: 0 });
  }, []);

  const hasCategories = attractions.some((a) => a.category);

  return (
    <>
      {modal && (
        <AttractionImageModal
          title={modal.title}
          imageUrls={modal.imageUrls}
          initialIndex={modal.initialIndex}
          onClose={() => setModal(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Beach search bar */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-2xl">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#0c7b93] via-[#1AB5A3] to-[#085C52] opacity-40 blur-sm pointer-events-none" />
            <div className="relative flex items-center rounded-2xl bg-white border border-teal-200 shadow-lg overflow-hidden">
              <span className="pl-4 text-xl shrink-0">🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setExpandedId(null); }}
                placeholder="Search beaches, surf spots, caves…"
                className="flex-1 bg-transparent px-3 py-4 text-sm font-semibold text-[#134e4a] placeholder:text-[#0f766e]/40 outline-none"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="px-3 text-[#0f766e]/50 hover:text-[#0c7b93] transition-colors font-bold text-lg">×</button>
              )}
              <div className="w-px h-6 bg-teal-100 mx-1 shrink-0" />
              <span className="pr-4 text-xs font-bold text-[#0f766e]/50 shrink-0 whitespace-nowrap">
                {filtered.length} spot{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {hasCategories && (
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button"
                  onClick={() => { setActiveCategory(cat); setExpandedId(null); }}
                  className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wide transition-all ${
                    activeCategory === cat
                      ? "bg-[#0c7b93] text-white shadow-md"
                      : "bg-white border border-teal-200 text-[#0f766e] hover:border-[#0c7b93] hover:text-[#0c7b93]"
                  }`}>
                  {cat === "All" ? `All (${attractions.length})` : `${CATEGORY_EMOJI[cat] ?? ""} ${cat}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4-column landscape grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-16 text-center">
            <p className="text-4xl mb-3">🌊</p>
            <p className="text-sm font-semibold text-[#0f766e] mb-4">No attractions found.</p>
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#0f766e] hover:border-[#0c7b93] transition-all">
              Clear filters
            </button>
          </div>
        ) : (
          <div
            className="grid gap-3 sm:gap-4"
            style={{ gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "1fr" }}
          >
            {filtered.map((attraction) => {
              const isExpanded = expandedId === attraction.id;
              if (isExpanded) {
                return (
                  <ExpandedCard
                    key={`${String(attraction.id)}-exp`}
                    attraction={attraction}
                    onClose={() => setExpandedId(null)}
                    onImageClick={() => handleImageClick(attraction)}
                  />
                );
              }
              return (
                <AttractionCard
                  key={String(attraction.id)}
                  attraction={attraction}
                  isAnyExpanded={expandedId !== null}
                  onClick={() => setExpandedId(attraction.id)}
                />
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 sm:mt-14 rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] p-6 sm:p-8 text-center text-white shadow-lg">
          <p className="text-lg font-black mb-1">Ready to go? 🌊</p>
          <p className="text-sm text-white/75 font-semibold mb-4">Book your ferry from Surigao to Siargao and start your island adventure.</p>
          <Link href={ROUTES.book}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-[#085C52] hover:bg-teal-50 transition-colors shadow-md w-full sm:w-auto">
            Book a trip →
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes expandIn {
          0%   { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes slowZoom {
          0%   { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        @media (max-width: 640px) {
          [style*="repeat(4, 1fr)"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}
