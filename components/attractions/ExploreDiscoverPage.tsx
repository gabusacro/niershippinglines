"use client";

import { useState, useEffect } from "react";
import type { Attraction } from "@/lib/attractions/types";
import { LiveTicker } from "@/components/attractions/LiveTicker";
import { CATEGORIES } from "@/lib/attractions/types";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

function GradientBox({ item, className = "" }: { item: Attraction; className?: string }) {
  return (
    <div className={`bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#0c7b93]"} flex items-center justify-center ${className}`}>
      <span style={{ fontSize: 40 }}>{item.cover_emoji ?? "🌴"}</span>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-800 text-[9px] font-semibold px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  );
}

function CategoryBadge({ item }: { item: Attraction }) {
  const label = item.category ? item.category.replace("-", " ") : item.type === "video" ? "video" : "attraction";
  const color =
    item.type === "video"          ? "bg-purple-50 text-purple-800 border-purple-200" :
    item.category === "surf"       ? "bg-teal-50 text-teal-800 border-teal-200" :
    item.category === "ferry-tips" ? "bg-amber-50 text-amber-800 border-amber-200" :
    item.category === "food"       ? "bg-orange-50 text-orange-800 border-orange-200" :
    item.category === "beaches"    ? "bg-blue-50 text-blue-800 border-blue-200" :
    item.category === "events"     ? "bg-pink-50 text-pink-800 border-pink-200" :
    item.category === "local-life" ? "bg-green-50 text-green-800 border-green-200" :
    "bg-emerald-50 text-emerald-800 border-emerald-200";
  return (
    <span className={`inline-block text-[9px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full border capitalize ${color}`}>
      {label}
    </span>
  );
}

function VideoModal({ item, onClose }: { item: Attraction; onClose: () => void }) {
  const embed = item.image_url ? toEmbedUrl(item.image_url) : null;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-[#04342C]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-lg font-bold">×</button>
        {embed
          ? <div className="aspect-video"><iframe src={embed} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen /></div>
          : <div className="aspect-video flex items-center justify-center text-white/40 text-sm">Video unavailable</div>
        }
        <div className="p-4">
          <h3 className="text-[15px] font-semibold text-white leading-snug">{item.title}</h3>
          {item.description && <p className="text-[12px] text-white/50 mt-1 leading-relaxed line-clamp-3">{item.description}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function CardXL({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="relative overflow-hidden rounded-2xl cursor-pointer group" style={{ aspectRatio: "3/4" }}>
      {item.image_url
        ? <img src={item.image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        : <GradientBox item={item} className="absolute inset-0" />
      }
      {item.type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-2xl text-white">▶</div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      {item.is_featured && (
        <div className="absolute top-3 left-3">
          <span className="bg-amber-400 text-amber-900 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full">✦ Featured</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="mb-2">{item.is_live ? <LiveBadge /> : <CategoryBadge item={item} />}</div>
        <h2 className="text-[15px] font-semibold text-white leading-snug mb-1">{item.title}</h2>
        {item.read_minutes ? <p className="text-[10px] text-white/40">{item.read_minutes} min read</p> : null}
      </div>
    </article>
  );
}

function CardHorizontal({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="flex overflow-hidden rounded-xl border border-slate-100 bg-white cursor-pointer group hover:border-[#0c7b93] transition-colors">
      <div className="w-[68px] shrink-0 overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          : <GradientBox item={item} className="w-full h-full" />
        }
      </div>
      <div className="flex flex-col justify-center px-3 py-2.5 min-w-0">
        <CategoryBadge item={item} />
        <h3 className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2 mt-1 mb-0.5">{item.title}</h3>
        <p className="text-[10px] text-slate-400" suppressHydrationWarning>{formatDate(item.created_at)}</p>
      </div>
    </article>
  );
}

function CardWide({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="rounded-2xl overflow-hidden cursor-pointer bg-[#04342C] group">
      <div className="flex min-h-[148px]">
        <div className="flex-1 flex flex-col justify-center p-5 pr-4">
          <div className="mb-3">{item.is_live ? <LiveBadge /> : <CategoryBadge item={item} />}</div>
          <h2 className="text-[17px] font-semibold text-white leading-snug mb-2 tracking-tight">{item.title}</h2>
          {item.description && <p className="text-[12px] text-white/45 leading-relaxed mb-3 line-clamp-2">{item.description}</p>}
          <span className="inline-flex items-center gap-1 text-[11px] text-[#5DCAA5] border border-[#1D9E75]/40 rounded-full px-3 py-1 w-fit group-hover:bg-[#1D9E75]/20 transition-colors">
            {item.type === "video" ? "Watch now →" : "Explore →"}
          </span>
        </div>
        <div
          className={`w-[200px] shrink-0 flex items-center justify-center text-5xl bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#1AB5A3]"}`}
          style={{ clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
        >
          {item.image_url
            ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
            : <span style={{ fontSize: 48 }}>{item.cover_emoji ?? "🌴"}</span>
          }
        </div>
      </div>
    </article>
  );
}

function CardMedium({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="rounded-xl overflow-hidden border border-slate-100 bg-white cursor-pointer group hover:border-[#0c7b93] hover:-translate-y-0.5 transition-all duration-200">
      <div className="h-[140px] overflow-hidden relative">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          : <GradientBox item={item} className="w-full h-full" />
        }
        {item.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="text-white text-xl opacity-70 group-hover:opacity-100 transition-opacity">▶</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <CategoryBadge item={item} />
        <h3 className="text-[13px] font-semibold text-slate-800 leading-snug mt-1.5 line-clamp-2">{item.title}</h3>
      </div>
    </article>
  );
}

function CardCinema({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="rounded-2xl overflow-hidden cursor-pointer group bg-[#04342C]">
      <div className="relative h-[280px]">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          : <GradientBox item={item} className="absolute inset-0" />
        }
        {item.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-3xl text-white">▶</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04342C] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[9px] tracking-[0.2em] uppercase text-[#5DCAA5] mb-2 font-semibold">
            {item.is_featured ? "✦ Featured · " : ""}{item.category ?? item.type}
          </p>
          <h2 className="text-[24px] font-semibold text-white leading-snug tracking-tight">{item.title}</h2>
        </div>
      </div>
      <div className="flex items-start gap-4 p-5">
        <p className="flex-1 text-[13px] text-white/50 leading-relaxed line-clamp-2">{item.description}</p>
        {item.read_minutes ? (
          <div className="text-right shrink-0">
            <div className="text-[34px] font-semibold text-[#1AB5A3] leading-none">{item.read_minutes}</div>
            <div className="text-[10px] text-white/30 mt-0.5">min</div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CardTall({ item, onClick }: { item: Attraction; onClick: () => void }) {
  return (
    <article onClick={onClick} className="rounded-xl overflow-hidden border border-slate-100 bg-white cursor-pointer group hover:border-[#0c7b93] transition-colors">
      <div className="h-[200px] overflow-hidden relative">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          : <GradientBox item={item} className="w-full h-full" />
        }
        {item.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="text-white text-2xl opacity-70">▶</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <CategoryBadge item={item} />
        <h3 className="text-[13px] font-semibold text-slate-800 leading-snug mt-1.5 mb-1">{item.title}</h3>
        <p className="text-[10px] text-slate-400" suppressHydrationWarning>{formatDate(item.created_at)}</p>
      </div>
    </article>
  );
}

function NewsTicker({ items }: { items: Attraction[] }) {
  const tickerItems = [...items].sort((a, b) => 
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
);
  if (!tickerItems.length) return null;
  const doubled = [...tickerItems, ...tickerItems];
  return (
    <div className="bg-[#04342C] overflow-hidden py-2 border-t border-white/[0.05]">
      <div className="flex whitespace-nowrap" style={{ animation: "ticker 30s linear infinite" }}>
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6 text-[11px] text-white/45 tracking-wide shrink-0">
            <b className="text-[#1AB5A3] font-semibold">{item.category?.replace("-", " ") ?? item.type}</b>
            {item.title}
            <span className="text-white/20 ml-2">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ExploreDiscoverPage({ items }: { items: Attraction[] }) {
  const [filter,      setFilter]      = useState("all");
  const [activeVideo, setActiveVideo] = useState<Attraction | null>(null);
  const [mounted,     setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const filtered =
    filter === "all"   ? items :
    filter === "video" ? items.filter((i) => i.type === "video") :
    items.filter((i) => i.category === filter);

  const featured   = filtered.find((i) => i.is_featured) ?? filtered[0];
  const rest       = filtered.filter((i) => i.id !== featured?.id);
  const sideStack  = rest.slice(0, 3);
  const after1     = rest.slice(3);
  const wideCard   = after1[0];
  const after2     = after1.slice(1);
  const threeRow   = after2.slice(0, 3);
  const after3     = after2.slice(3);
  const cinemaCard = after3.find((i) => (i.read_minutes ?? 0) >= 4) ?? after3[0];
  const after4     = after3.filter((i) => i.id !== cinemaCard?.id);
  const asymLeft   = after4[0];
  const asymRight  = after4[1];
  const remainder  = after4.slice(2);

  function handleClick(item: Attraction) {
    if (item.type === "video") { setActiveVideo(item); return; }
   window.location.href = `/attractions/${item.slug}`;
  }

  const WRAP = "mx-auto max-w-6xl px-4 sm:px-6";

  // Use the featured item's photo as hero background, fallback to first item
  const heroBg = featured?.image_url ?? items[0]?.image_url ?? null;

  return (
    <>
      <style>{`
        @keyframes ticker  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes heroZoom{ from{transform:scale(1.05)} to{transform:scale(1)} }
        .fade-up   { animation: fadeUp 0.5s ease both }
        .hero-zoom { animation: heroZoom 8s ease forwards }
        .hide-scroll::-webkit-scrollbar { display:none }
        .hide-scroll { -ms-overflow-style:none; scrollbar-width:none }
      `}</style>

      {activeVideo && <VideoModal item={activeVideo} onClose={() => setActiveVideo(null)} />}

      <div className="min-h-screen bg-white">

        {/* ── CINEMATIC HERO ── */}
        <section
          className="relative overflow-hidden"
          style={{ minHeight: 420, opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease", background: "#04342C" }}
          suppressHydrationWarning
        >
          {/* Real photo background — uses featured item's photo */}
          {heroBg && (
            <img
              src={heroBg}
              alt="Explore Siargao"
              className="hero-zoom absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "center 40%" }}
            />
          )}

          {/* Cinema-quality gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: heroBg
                ? "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 35%, rgba(2,20,40,0.6) 65%, rgba(2,20,40,0.92) 100%)"
                : "linear-gradient(135deg,#04342C 0%,#085C52 40%,#0c7b93 70%,#1AB5A3 100%)",
            }}
          />

          {/* Content */}
          <div
            className={`relative z-10 ${WRAP} flex flex-col justify-end pb-10`}
            style={{ minHeight: 420 }}
          >
            <div className="flex items-center gap-2 mb-3 text-[10px] tracking-[0.25em] uppercase text-white/50 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1AB5A3] animate-pulse" />
              Travela Siargao — updated by locals
            </div>
            <h1
              className="font-black text-white leading-[1.0] tracking-tight mb-5"
              style={{
                fontSize: "clamp(32px,5.5vw,58px)",
                textShadow: "0 2px 24px rgba(0,0,0,0.4)",
              }}
            >
              Explore &amp;{" "}
              <span className="text-[#5DCAA5]">Discover Siargao.</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {["Cloud 9 surf", "Hidden beaches", "Ferry tips", "Local eats", "Island life"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.2)",
                    backdropFilter: "blur(8px)",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {tag}
                </span>
              ))}
              <a
                href="/book"
                className="ml-auto inline-flex items-center gap-1.5 font-extrabold text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "#0c7b93",
                  padding: "10px 20px",
                  borderRadius: 999,
                  fontSize: 13,
                  boxShadow: "0 4px 20px rgba(12,123,147,0.4)",
                  textDecoration: "none",
                }}
              >
                🚢 Book ferry →
              </a>
            </div>
          </div>
        </section>

        {/* ── Ticker ── */}
        <NewsTicker items={items} />

        {/* ── Filter bar ── */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-teal-200/50">
          <div className={`${WRAP} py-3 flex gap-2 overflow-x-auto hide-scroll`}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide whitespace-nowrap border transition-all
                  ${filter === cat.key
                    ? "bg-[#085C52] text-[#9FE1CB] border-[#085C52]"
                    : "bg-transparent text-[#0f766e] border-teal-200 hover:border-[#0c7b93] hover:text-[#0c7b93]"}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div className="py-20 text-center px-4">
            <div className="text-4xl mb-3">🌊</div>
            <p className="text-[#0f766e] text-sm font-semibold">Nothing here yet — check back soon.</p>
          </div>
        )}

        {/* ── Broken grid ── */}
        {filtered.length > 0 && (
          <div className={`${WRAP} py-6 space-y-4`}>

            {featured && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "1.65fr 1fr" }}>
                <div className="fade-up" style={{ animationDelay: "0.05s" }}>
                  <CardXL item={featured} onClick={() => handleClick(featured)} />
                </div>
                <div className="flex flex-col gap-4">
                  {sideStack.map((item, i) => (
                    <div key={item.id} className="fade-up" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                      <CardHorizontal item={item} onClick={() => handleClick(item)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wideCard && (
              <div className="fade-up" style={{ animationDelay: "0.28s" }}>
                <CardWide item={wideCard} onClick={() => handleClick(wideCard)} />
              </div>
            )}

            {threeRow.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {threeRow.map((item, i) => (
                  <div key={item.id} className="fade-up" style={{ animationDelay: `${0.33 + i * 0.05}s` }}>
                    <CardMedium item={item} onClick={() => handleClick(item)} />
                  </div>
                ))}
              </div>
            )}

            {cinemaCard && (
              <div className="fade-up" style={{ animationDelay: "0.45s" }}>
                <CardCinema item={cinemaCard} onClick={() => handleClick(cinemaCard)} />
              </div>
            )}

            {(asymLeft || asymRight) && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
                {asymLeft && (
                  <div className="fade-up" style={{ animationDelay: "0.5s" }}>
                    <CardTall item={asymLeft} onClick={() => handleClick(asymLeft)} />
                  </div>
                )}
                {asymRight && (
                  <div className="fade-up" style={{ animationDelay: "0.55s" }}>
                    <CardTall item={asymRight} onClick={() => handleClick(asymRight)} />
                  </div>
                )}
              </div>
            )}

            {remainder.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {remainder.map((item, i) => (
                  <div key={item.id} className="fade-up" style={{ animationDelay: `${0.55 + i * 0.04}s` }}>
                    <CardMedium item={item} onClick={() => handleClick(item)} />
                  </div>
                ))}
              </div>
            )}

            <div className="fade-up" style={{ animationDelay: "0.65s" }}>
              <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-10 text-center text-white shadow-lg">
                <h2 className="text-2xl font-black">Ready to sail to Siargao? 🌊</h2>
                <p className="mt-2 text-white/75 font-semibold">Book your ferry in 2 minutes. Safe, reliable, hassle-free.</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
                  <a href="/book" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-extrabold text-[#085C52] shadow-md transition-all hover:bg-[#fef9e7] hover:-translate-y-0.5">
                    🚢 Book a Trip
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
