"use client";

import { useState } from "react";
import Link from "next/link";
import type { DiscoverItem } from "@/lib/dashboard/get-discover-items";

type Tab = "all" | "video" | "attraction" | "partner";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "video",      label: "📹 Videos" },
  { key: "attraction", label: "🗺️ Attractions" },
  { key: "partner",    label: "🤝 Partners" },
];

// ─── Props come from server component (page.tsx fetches & passes items) ───────
export function DiscoverSiargao({ items }: { items: DiscoverItem[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Section completely hidden if no active items exist
  if (!items || items.length === 0) return null;

  const filtered = items.filter(
    (item) => activeTab === "all" || item.type === activeTab
  );

  // Featured = first item marked is_featured, fallback to first item overall
  const featured = filtered.find((i) => i.is_featured) ?? filtered[0];
  const rest      = filtered.filter((i) => i.id !== featured?.id);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] to-[#0c7b93] p-6 shadow-lg">
      {/* Radial glow overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(26,181,163,0.2)_0%,transparent_60%)]" />

      {/* Header + tabs */}
      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-white">🌊 Discover Siargao</h2>
          <p className="mt-0.5 text-sm text-white/55">Curated places, travel videos &amp; featured partners</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
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

      {/* Content grid */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/50">No items in this category yet.</p>
      ) : (
        <div className="relative space-y-3">
          {featured && <CardLarge item={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((item) => (
                <CardSmall key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <p className="relative mt-4 text-center text-xs text-white/30">
        Want to feature your Siargao business here?{" "}
        <a
          href="mailto:gabu.sacro@gmail.com"
          className="text-white/50 underline transition-colors hover:text-white/80"
        >
          Contact us
        </a>
      </p>
    </div>
  );
}

// ─── Shared link wrapper logic ────────────────────────────────────────────────
function CardWrapper({
  href,
  className,
  children,
}: {
  href?: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  if (href.startsWith("http"))
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}

// ─── Large featured card ──────────────────────────────────────────────────────
function CardLarge({ item }: { item: DiscoverItem }) {
  return (
    <CardWrapper
      href={item.href}
      className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08] transition-transform hover:scale-[1.01]"
    >
      <span className="pointer-events-none select-none text-[6rem] opacity-15 transition-transform duration-500 group-hover:scale-110">
        {item.emoji}
      </span>

      {item.is_featured && (
        <span className="absolute left-3 top-3 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          ✨ Featured
        </span>
      )}
      {item.type === "partner" && (
        <span className="absolute right-3 top-3 rounded border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] text-white/60">
          Partner Ad
        </span>
      )}
      {item.type === "video" && (
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow-xl transition-all group-hover:scale-110 group-hover:bg-white">
          ▶
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">{item.tag}</p>
        <p className="mt-0.5 text-lg font-bold leading-snug text-white">{item.title}</p>
      </div>
    </CardWrapper>
  );
}

// ─── Small card ───────────────────────────────────────────────────────────────
function CardSmall({ item }: { item: DiscoverItem }) {
  return (
    <CardWrapper
      href={item.href}
      className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-white/[0.08] transition-transform hover:scale-[1.03]"
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
        <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-white">{item.title}</p>
      </div>
    </CardWrapper>
  );
}
