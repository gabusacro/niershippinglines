"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "all" | "videos" | "attractions" | "partners";

type DiscoverItem = {
  id: string;
  type: "video" | "attraction" | "partner";
  title: string;
  tag: string;
  emoji: string;
  featured?: boolean;
  href?: string;
  isAdSlot?: boolean;
};

// ─── Route constant (matches your ROUTES.attractions path) ───────────────────
const ROUTES_ATTRACTIONS = "/attractions";

// ─── Curated content (edit freely, or wire to Supabase later) ────────────────
const CURATED_ITEMS: DiscoverItem[] = [
  {
    id: "cloud9",
    type: "video",
    title: "Cloud 9 — World-Class Surfing",
    tag: "📹 Video Tour",
    emoji: "🏄",
    featured: true,
    href: ROUTES_ATTRACTIONS,
  },
  {
    id: "sugba",
    type: "attraction",
    title: "Sugba Lagoon",
    tag: "🗺️ Attraction",
    emoji: "🏝️",
    href: ROUTES_ATTRACTIONS,
  },
  {
    id: "naked-island",
    type: "video",
    title: "Naked Island Day Trip",
    tag: "📹 Vlog",
    emoji: "🌅",
    href: ROUTES_ATTRACTIONS,
  },
  {
    id: "turtle-island",
    type: "attraction",
    title: "Turtle Island",
    tag: "🗺️ Attraction",
    emoji: "🐢",
    href: ROUTES_ATTRACTIONS,
  },
  {
    id: "magpupungko",
    type: "attraction",
    title: "Magpupungko Rock Pools",
    tag: "🗺️ Attraction",
    emoji: "🌊",
    href: ROUTES_ATTRACTIONS,
  },
  {
    id: "siargao-island-tour",
    type: "video",
    title: "Island Hopping Guide",
    tag: "📹 Travel Guide",
    emoji: "⛵",
    href: ROUTES_ATTRACTIONS,
  },
];

// ─── Partner / advertiser slots (admin would manage these via Supabase later) ─
const PARTNER_ITEMS: DiscoverItem[] = [
  {
    id: "partner-kermit",
    type: "partner",
    title: "Kermit Surf & Dine",
    tag: "🍽️ Restaurant",
    emoji: "🍹",
  },
  {
    id: "partner-bleu",
    type: "partner",
    title: "Siargao Bleu Resort",
    tag: "🏨 Hotel",
    emoji: "🏨",
  },
  {
    id: "ad-slot",
    type: "partner",
    title: "Your business here",
    tag: "📢 Advertise",
    emoji: "＋",
    isAdSlot: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function DiscoverSiargao() {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const allItems = [...CURATED_ITEMS, ...PARTNER_ITEMS];

  const filtered = allItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "videos") return item.type === "video";
    if (activeTab === "attractions") return item.type === "attraction";
    if (activeTab === "partners") return item.type === "partner";
    return true;
  });

  // Featured item is always the first video when showing "all" or "videos"
  const featured = filtered.find((i) => i.featured) ?? filtered[0];
  const rest = filtered.filter((i) => i.id !== featured?.id);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "videos", label: "📹 Videos" },
    { key: "attractions", label: "🗺️ Attractions" },
    { key: "partners", label: "🤝 Partners" },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] to-[#0c7b93] p-6 shadow-lg">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(26,181,163,0.2)_0%,transparent_60%)]" />

      {/* Header */}
      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-bold text-2xl text-white leading-tight">🌊 Discover Siargao</h2>
          <p className="mt-0.5 text-sm text-white/55">Curated places, travel videos &amp; featured partners</p>
        </div>
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "border-white bg-white text-[#085C52]"
                  : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-white/50 py-10 text-sm">No items in this category yet.</p>
      ) : (
        <div className="relative space-y-3">
          {/* Featured card (large) */}
          {featured && (
            <CardLarge item={featured} />
          )}

          {/* Rest — responsive grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((item) => (
                <CardSmall key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      <p className="relative mt-4 text-center text-xs text-white/30">
        Want to feature your Siargao business here?{" "}
        <a href="mailto:gabu.sacro@gmail.com" className="text-white/50 underline hover:text-white/80 transition-colors">
          Contact us
        </a>
      </p>
    </div>
  );
}

// ─── Large featured card ──────────────────────────────────────────────────────
function CardLarge({ item }: { item: DiscoverItem }) {
  const Wrapper = item.href ? Link : "div";
  return (
    <Wrapper
      href={item.href as string}
      className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white/8 transition-transform hover:scale-[1.01]"
    >
      {/* BG emoji */}
      <span className="pointer-events-none select-none text-[6rem] opacity-15 transition-transform duration-500 group-hover:scale-110">
        {item.emoji}
      </span>

      {/* Badges */}
      {item.featured && (
        <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          ✨ Featured
        </span>
      )}
      {item.type === "partner" && !item.isAdSlot && (
        <span className="absolute right-3 top-3 rounded border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] text-white/60">
          Partner Ad
        </span>
      )}

      {/* Play button for videos */}
      {item.type === "video" && (
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow-xl transition-all group-hover:scale-110 group-hover:bg-white">
          ▶
        </span>
      )}

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">{item.tag}</p>
        <p className="mt-0.5 text-lg font-bold text-white leading-snug">{item.title}</p>
      </div>
    </Wrapper>
  );
}

// ─── Small card ───────────────────────────────────────────────────────────────
function CardSmall({ item }: { item: DiscoverItem }) {
  if (item.isAdSlot) {
    return (
      <a
        href="mailto:gabu.sacro@gmail.com"
        className="group flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 text-center transition-all hover:border-white/40 hover:bg-white/10"
      >
        <span className="text-2xl text-white/30 group-hover:text-white/50 transition-colors">＋</span>
        <span className="mt-1 text-[11px] text-white/35 group-hover:text-white/55 transition-colors">Advertise here</span>
      </a>
    );
  }

  const Wrapper = item.href ? Link : "div";
  return (
    <Wrapper
      href={item.href as string}
      className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-white/8 transition-transform hover:scale-[1.03]"
    >
      <span className="pointer-events-none select-none text-[3rem] opacity-20 transition-transform duration-500 group-hover:scale-110">
        {item.emoji}
      </span>

      {item.type === "partner" && (
        <span className="absolute right-2 top-2 rounded border border-white/20 bg-white/15 px-1.5 py-0.5 text-[9px] text-white/55">
          Ad
        </span>
      )}
      {item.type === "video" && (
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm shadow-lg transition-all group-hover:scale-110 group-hover:bg-white">
          ▶
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">{item.tag}</p>
        <p className="mt-0.5 text-xs font-bold text-white leading-snug line-clamp-2">{item.title}</p>
      </div>
    </Wrapper>
  );
}
