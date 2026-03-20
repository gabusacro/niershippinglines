"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type StoryCategory =
  | "breaking"
  | "surf"
  | "events"
  | "ferry-tips"
  | "food"
  | "local-life"
  | "beaches"
  | "attractions";

export type Story = {
  id: string;
  title: string;
  excerpt: string;
  category: StoryCategory;
  cover_url: string | null;         // main photo
  cover_emoji: string;              // fallback if no photo
  cover_gradient: string;           // tailwind gradient classes
  author: string;                   // "Travela Siargao Team" or custom
  published_at: string;             // ISO date string
  read_minutes: number;
  is_featured?: boolean;
  is_live?: boolean;                // shows pulsing LIVE badge
  slug: string;                     // URL slug
  tags?: string[];
};

// ─── Sample data (replace with Supabase fetch) ────────────────────────────────
const SAMPLE_STORIES: Story[] = [
  {
    id: "1",
    title: "Cloud 9 Surf Cup returns — everything you need to know before April",
    excerpt: "The biggest surf competition in the Philippines is back. We spoke to local organizers, boat operators, and tour guides on what's new this year and how visitors can join the action.",
    category: "surf",
    cover_url: null,
    cover_emoji: "🏄‍♂️",
    cover_gradient: "from-[#085C52] via-[#0c7b93] to-[#1AB5A3]",
    author: "Travela Siargao Team",
    published_at: "2026-03-20",
    read_minutes: 4,
    is_featured: true,
    slug: "cloud-9-surf-cup-2026",
    tags: ["cloud 9 siargao", "siargao surf 2026", "surf cup philippines"],
  },
  {
    id: "2",
    title: "New fast ferry — Surigao to Dapa in 75 minutes",
    excerpt: "A new vessel started operating the route this week, cutting travel time dramatically. Here's the schedule and what passengers need to know.",
    category: "breaking",
    cover_url: null,
    cover_emoji: "🚢",
    cover_gradient: "from-[#04342C] to-[#085C52]",
    author: "Travela Siargao Team",
    published_at: "2026-03-20",
    read_minutes: 2,
    is_live: true,
    slug: "new-fast-ferry-surigao-dapa-2026",
    tags: ["surigao to siargao ferry", "dapa ferry 2026", "fast ferry siargao"],
  },
  {
    id: "3",
    title: "5 new restaurants in General Luna — honest reviews from a local",
    excerpt: "We visited every single one so you don't have to guess. Spoiler: two are already worth the trip alone.",
    category: "food",
    cover_url: null,
    cover_emoji: "🍜",
    cover_gradient: "from-[#BA7517] to-[#EF9F27]",
    author: "Travela Siargao Team",
    published_at: "2026-03-17",
    read_minutes: 3,
    slug: "new-restaurants-general-luna-siargao-2026",
    tags: ["siargao food", "general luna restaurants", "where to eat siargao"],
  },
  {
    id: "4",
    title: "Best sunset spots ranked by a local who's watched thousands",
    excerpt: "After years on the island, here are the exact coordinates, best times, and what to bring.",
    category: "beaches",
    cover_url: null,
    cover_emoji: "🌅",
    cover_gradient: "from-[#534AB7] to-[#AFA9EC]",
    author: "Travela Siargao Team",
    published_at: "2026-03-15",
    read_minutes: 3,
    slug: "best-sunset-spots-siargao",
    tags: ["siargao sunset", "siargao beaches", "siargao tourist spots"],
  },
  {
    id: "5",
    title: "Ferry ticket sold out this morning — here's exactly what to do next",
    excerpt: "Walk-in queues at Dapa port hit capacity by 6 AM. If you're heading to Siargao this weekend, read this before you leave.",
    category: "ferry-tips",
    cover_url: null,
    cover_emoji: "⚠️",
    cover_gradient: "from-[#085C52] to-[#1AB5A3]",
    author: "Travela Siargao Team",
    published_at: "2026-03-18",
    read_minutes: 2,
    is_live: true,
    slug: "ferry-ticket-sold-out-siargao-what-to-do",
    tags: ["siargao ferry ticket", "book ferry siargao online", "dapa port"],
  },
  {
    id: "6",
    title: "Coral restoration at Naked Island needs volunteers this weekend",
    excerpt: "A local conservation team is running a reef cleanup dive — no experience needed, just show up.",
    category: "local-life",
    cover_url: null,
    cover_emoji: "🪸",
    cover_gradient: "from-[#1D9E75] to-[#5DCAA5]",
    author: "Travela Siargao Team",
    published_at: "2026-03-15",
    read_minutes: 2,
    slug: "coral-restoration-naked-island-siargao",
    tags: ["naked island siargao", "siargao activities", "siargao island hopping"],
  },
  {
    id: "7",
    title: "Safest paid parking near the Surigao pier — full guide",
    excerpt: "Driving to Siargao but can't take your car? Here are every secure parking option near the port, with rates and contact numbers.",
    category: "ferry-tips",
    cover_url: null,
    cover_emoji: "🚗",
    cover_gradient: "from-[#BA7517] to-[#EF9F27]",
    author: "Travela Siargao Team",
    published_at: "2026-03-10",
    read_minutes: 2,
    slug: "paid-parking-surigao-pier-siargao-trip",
    tags: ["surigao parking", "surigao pier parking", "travel to siargao by car"],
  },
  {
    id: "8",
    title: "Siargao Music Fest lineup announced — free entry for locals",
    excerpt: "The annual festival returns with a full weekend of live bands, local artists, and food stalls at the main boardwalk.",
    category: "events",
    cover_url: null,
    cover_emoji: "🎵",
    cover_gradient: "from-[#534AB7] to-[#7F77DD]",
    author: "Travela Siargao Team",
    published_at: "2026-03-12",
    read_minutes: 2,
    slug: "siargao-music-fest-2026",
    tags: ["siargao events 2026", "siargao festival", "things to do siargao"],
  },
  {
    id: "9",
    title: "The complete Siargao survival guide for first-timers in 2026",
    excerpt: "From the moment you step off the ferry at Dapa port to your last sunset at Cloud 9 — every tip, every shortcut, every thing a local wishes they could tell you before you arrived.",
    category: "attractions",
    cover_url: null,
    cover_emoji: "🗺️",
    cover_gradient: "from-[#085C52] via-[#0c7b93] to-[#1AB5A3]",
    author: "Travela Siargao Team",
    published_at: "2026-03-08",
    read_minutes: 12,
    is_featured: true,
    slug: "complete-siargao-travel-guide-2026",
    tags: ["siargao travel guide 2026", "how to get to siargao", "siargao itinerary"],
  },
  {
    id: "10",
    title: "Alegria Beach is still Siargao's best-kept secret — for now",
    excerpt: "Most tourists never make it here. We're telling you anyway because you deserve to see it at least once.",
    category: "beaches",
    cover_url: null,
    cover_emoji: "🌊",
    cover_gradient: "from-[#534AB7] to-[#7F77DD]",
    author: "Travela Siargao Team",
    published_at: "2026-03-10",
    read_minutes: 2,
    slug: "alegria-beach-siargao",
    tags: ["alegria beach siargao", "siargao hidden beaches", "siargao tourist spots"],
  },
  {
    id: "11",
    title: "How to book a surf lesson without getting overcharged as a tourist",
    excerpt: "The real rates, the right questions to ask, and which instructors locals actually recommend.",
    category: "surf",
    cover_url: null,
    cover_emoji: "🏄‍♀️",
    cover_gradient: "from-[#A32D2D] to-[#E24B4A]",
    author: "Travela Siargao Team",
    published_at: "2026-03-08",
    read_minutes: 4,
    slug: "surf-lesson-siargao-honest-guide",
    tags: ["siargao surf lessons", "cloud 9 surfing", "siargao activities"],
  },
];

const TICKER_ITEMS = [
  { label: "Breaking", text: "New fast ferry cuts Surigao–Dapa to 75 min" },
  { label: "Event", text: "Cloud 9 Surf Cup — April 12–18, 2026" },
  { label: "Tip", text: "Book ferry online — avoid losing ₱400 on sold-out days" },
  { label: "Local", text: "Magpupungko rock pools re-open after tide season" },
  { label: "Food", text: "5 new restaurants just opened in General Luna" },
];

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "breaking", label: "Breaking" },
  { key: "surf", label: "Surf" },
  { key: "events", label: "Events" },
  { key: "ferry-tips", label: "Ferry tips" },
  { key: "food", label: "Food" },
  { key: "local-life", label: "Local life" },
  { key: "beaches", label: "Beaches" },
  { key: "attractions", label: "Attractions" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function CategoryBadge({ category }: { category: StoryCategory }) {
  const map: Record<StoryCategory, string> = {
    breaking:     "bg-red-50 text-red-800 border-red-200",
    surf:         "bg-teal-50 text-teal-800 border-teal-200",
    events:       "bg-blue-50 text-blue-800 border-blue-200",
    "ferry-tips": "bg-amber-50 text-amber-800 border-amber-200",
    food:         "bg-orange-50 text-orange-800 border-orange-200",
    "local-life": "bg-green-50 text-green-800 border-green-200",
    beaches:      "bg-purple-50 text-purple-800 border-purple-200",
    attractions:  "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  const labels: Record<StoryCategory, string> = {
    breaking: "Breaking", surf: "Surf", events: "Event",
    "ferry-tips": "Ferry tip", food: "Food", "local-life": "Local life",
    beaches: "Beach", attractions: "Attraction",
  };
  return (
    <span className={`inline-block text-[9px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full border ${map[category]}`}>
      {labels[category]}
    </span>
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

// ─── Card variants ─────────────────────────────────────────────────────────────

/** Big portrait hero card (left of row 1) */
function CardXL({ story }: { story: Story }) {
  return (
    <article className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{ aspectRatio: "3/4" }}>
      {story.cover_url ? (
        <img src={story.cover_url} alt={story.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${story.cover_gradient} flex items-center justify-center text-6xl`}>
          {story.cover_emoji}
        </div>
      )}
      {/* overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-center gap-2 mb-2">
          {story.is_live ? <LiveBadge /> : null}
          <span className="text-[9px] tracking-widest uppercase text-white/50 font-semibold">
            {story.is_live ? "" : story.category.replace("-", " ")}
          </span>
        </div>
        <h2 className="text-[15px] font-semibold text-white leading-snug mb-2">{story.title}</h2>
        <p className="text-[11px] text-white/50">{formatDate(story.published_at)} · {story.read_minutes} min read</p>
      </div>
    </article>
  );
}

/** Compact horizontal card (right stack) */
function CardHorizontal({ story }: { story: Story }) {
  return (
    <article className="flex overflow-hidden rounded-xl border border-[#e2e8f0] bg-white cursor-pointer group hover:border-[#0c7b93] transition-colors">
      <div className={`w-[70px] shrink-0 flex items-center justify-center text-2xl bg-gradient-to-br ${story.cover_gradient}`}>
        {story.cover_url
          ? <img src={story.cover_url} alt={story.title} className="w-full h-full object-cover" />
          : story.cover_emoji}
      </div>
      <div className="flex flex-col justify-center px-3 py-2.5 min-w-0">
        <div className="text-[9px] tracking-widest uppercase text-slate-400 font-semibold mb-1">
          {story.category.replace("-", " ")}
        </div>
        <h3 className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2 mb-1">{story.title}</h3>
        <p className="text-[10px] text-slate-400">{formatDate(story.published_at)} · {story.read_minutes} min</p>
      </div>
    </article>
  );
}

/** Diagonal-cut wide alert card */
function CardWide({ story }: { story: Story }) {
  return (
    <article className="rounded-2xl overflow-hidden cursor-pointer bg-[#04342C] group">
      <div className="flex min-h-[152px]">
        <div className="flex-1 flex flex-col justify-center p-5 pr-4">
          <div className="flex items-center gap-2 mb-3">
            {story.is_live && <LiveBadge />}
          </div>
          <h2 className="text-[17px] font-semibold text-white leading-snug mb-2 tracking-tight">{story.title}</h2>
          <p className="text-[12px] text-white/50 leading-relaxed mb-3 line-clamp-2">{story.excerpt}</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#5DCAA5] border border-[#1D9E75]/40 rounded-full px-3 py-1 w-fit group-hover:bg-[#1D9E75]/20 transition-colors">
            Read now →
          </span>
        </div>
        <div
          className={`w-[160px] shrink-0 flex items-center justify-center text-5xl bg-gradient-to-br ${story.cover_gradient}`}
          style={{ clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
        >
          {story.cover_emoji}
        </div>
      </div>
    </article>
  );
}

/** Medium card for 3-column row */
function CardMedium({ story }: { story: Story }) {
  return (
    <article className="rounded-xl overflow-hidden border border-[#e2e8f0] bg-white cursor-pointer group hover:border-[#0c7b93] hover:-translate-y-1 transition-all duration-200">
      <div className={`h-[96px] flex items-center justify-center text-3xl bg-gradient-to-br ${story.cover_gradient}`}>
        {story.cover_url
          ? <img src={story.cover_url} alt={story.title} className="w-full h-full object-cover" />
          : story.cover_emoji}
      </div>
      <div className="p-3">
        <CategoryBadge category={story.category} />
        <h3 className="text-[12px] font-semibold text-slate-800 leading-snug mt-2 line-clamp-3">{story.title}</h3>
      </div>
    </article>
  );
}

/** Full-width cinematic card */
function CardCinema({ story }: { story: Story }) {
  return (
    <article className="rounded-2xl overflow-hidden cursor-pointer group bg-[#04342C]">
      <div className={`relative h-[200px] flex items-center justify-center text-7xl bg-gradient-to-br ${story.cover_gradient} group-hover:opacity-90 transition-opacity`}>
        {story.cover_url
          ? <img src={story.cover_url} alt={story.title} className="absolute inset-0 w-full h-full object-cover" />
          : story.cover_emoji}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04342C] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[9px] tracking-[0.2em] uppercase text-[#5DCAA5] mb-2 font-semibold">
            Local guide · Deep dive
          </p>
          <h2 className="text-[20px] font-semibold text-white leading-snug tracking-tight">{story.title}</h2>
        </div>
      </div>
      <div className="flex items-start gap-4 p-5">
        <p className="flex-1 text-[13px] text-white/55 leading-relaxed">{story.excerpt}</p>
        <div className="text-right shrink-0">
          <div className="text-[36px] font-semibold text-[#1AB5A3] leading-none">{story.read_minutes}</div>
          <div className="text-[10px] text-white/35 mt-0.5">min read</div>
        </div>
      </div>
    </article>
  );
}

/** Tall card for asymmetric row */
function CardTall({ story }: { story: Story }) {
  return (
    <article className="rounded-xl overflow-hidden border border-[#e2e8f0] bg-white cursor-pointer group hover:border-[#0c7b93] transition-colors">
      <div className={`h-[160px] flex items-center justify-center text-4xl bg-gradient-to-br ${story.cover_gradient}`}>
        {story.cover_url
          ? <img src={story.cover_url} alt={story.title} className="w-full h-full object-cover" />
          : story.cover_emoji}
      </div>
      <div className="p-3">
        <CategoryBadge category={story.category} />
        <h3 className="text-[13px] font-semibold text-slate-800 leading-snug mt-2 mb-1">{story.title}</h3>
        <p className="text-[10px] text-slate-400">{formatDate(story.published_at)} · {story.read_minutes} min</p>
      </div>
    </article>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function NewsTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="bg-[#04342C] overflow-hidden py-2 border-t border-white/[0.06]">
      <div
        className="flex gap-0 whitespace-nowrap"
        style={{ animation: "ticker 28s linear infinite" }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6 text-[11px] text-white/50 tracking-wide">
            <b className="text-[#1AB5A3] font-semibold">{item.label}</b>
            {item.text}
            <span className="text-white/20 ml-2">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SiargaoStoriesPage({ stories = SAMPLE_STORIES }: { stories?: Story[] }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [visible, setVisible] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // staggered entrance
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const filtered = activeFilter === "all"
    ? stories
    : stories.filter((s) => s.category === activeFilter);

  // pick layout slots
  const featured     = filtered.find((s) => s.is_featured) ?? filtered[0];
  const sideStack    = filtered.filter((s) => s.id !== featured?.id).slice(0, 3);
  const liveAlert    = filtered.find((s) => s.is_live && s.id !== featured?.id);
  const threeCards   = filtered.filter((s) => s.id !== featured?.id && s.id !== liveAlert?.id).slice(0, 3);
  const cinemaCard   = filtered.find((s) => s.read_minutes >= 8 && s.id !== featured?.id);
  const asymLeft     = filtered.filter((s) => s.id !== featured?.id && s.id !== cinemaCard?.id).slice(3, 4)[0];
  const asymRight    = filtered.filter((s) => s.id !== featured?.id && s.id !== cinemaCard?.id).slice(4, 5)[0];

  return (
    <>
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .story-enter { animation: fadeUp 0.5s ease both }
      `}</style>

      <div ref={pageRef} className="min-h-screen bg-white">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden bg-[#04342C]" style={{ minHeight: 400 }}>
          {/* grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]" preserveAspectRatio="none">
            {[100,200,300].map(y => <line key={y} x1="0" y1={`${y}`} x2="100%" y2={`${y}`} stroke="white" strokeWidth="0.5"/>)}
            {["25%","50%","75%"].map(x => <line key={x} x1={x} y1="0" x2={x} y2="100%" stroke="white" strokeWidth="0.5"/>)}
          </svg>

          <div
            className="relative z-10 flex flex-col justify-end px-5 pb-8"
            style={{ minHeight: 400, opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}
          >
            {/* eyebrow */}
            <div className="flex items-center gap-2 mb-3 text-[10px] tracking-[0.25em] uppercase text-white/40 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1AB5A3] animate-pulse" />
              Siargao Stories — live from the island
            </div>

            {/* title */}
            <h1 className="text-[clamp(28px,7vw,52px)] font-semibold text-white leading-[1.05] tracking-[-0.03em] mb-5">
              The island speaks.<br />
              <span className="text-[#5DCAA5]">We write it down.</span>
            </h1>

            {/* hero tags + CTA */}
            <div className="flex flex-wrap items-center gap-2">
              {["New ferry route", "Cloud 9 surf cup", "Local eats", "Hidden beaches"].map(tag => (
                <span key={tag} className="px-3 py-1 border border-white/20 rounded-full text-[11px] text-white/60">
                  {tag}
                </span>
              ))}
              <a href="/book"
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#1AB5A3] text-[#04342C] rounded-full text-[12px] font-semibold hover:bg-[#5DCAA5] transition-colors">
                Book your ferry →
              </a>
            </div>
          </div>
        </div>

        {/* ── Ticker ── */}
        <NewsTicker />

        {/* ── Filter bar ── */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-slate-100 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveFilter(cat.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-all duration-150
                ${activeFilter === cat.key
                  ? "bg-[#085C52] text-[#9FE1CB] border-[#085C52]"
                  : "bg-transparent text-slate-500 border-slate-200 hover:border-[#0c7b93] hover:text-[#0c7b93]"}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ── Broken grid ── */}
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">

          {/* ROW 1 — Portrait hero + 3 horizontal stack */}
          {featured && (
            <div className="grid gap-3" style={{ gridTemplateColumns: "1.65fr 1fr" }}>
              <div className="story-enter" style={{ animationDelay: "0.05s" }}>
                <CardXL story={featured} />
              </div>
              <div className="flex flex-col gap-3">
                {sideStack.map((s, i) => (
                  <div key={s.id} className="story-enter" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                    <CardHorizontal story={s} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROW 2 — Diagonal live alert */}
          {liveAlert && (
            <div className="story-enter" style={{ animationDelay: "0.3s" }}>
              <CardWide story={liveAlert} />
            </div>
          )}

          {/* ROW 3 — 3 equal medium */}
          {threeCards.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {threeCards.map((s, i) => (
                <div key={s.id} className="story-enter" style={{ animationDelay: `${0.35 + i * 0.06}s` }}>
                  <CardMedium story={s} />
                </div>
              ))}
            </div>
          )}

          {/* ROW 4 — Cinematic full-width */}
          {cinemaCard && (
            <div className="story-enter" style={{ animationDelay: "0.5s" }}>
              <CardCinema story={cinemaCard} />
            </div>
          )}

          {/* ROW 5 — Asymmetric 2-col */}
          {(asymLeft || asymRight) && (
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
              {asymLeft && (
                <div className="story-enter" style={{ animationDelay: "0.55s" }}>
                  <CardTall story={asymLeft} />
                </div>
              )}
              {asymRight && (
                <div className="story-enter" style={{ animationDelay: "0.6s" }}>
                  <CardTall story={asymRight} />
                </div>
              )}
            </div>
          )}

          {/* Bottom CTA */}
          <div className="story-enter rounded-2xl overflow-hidden" style={{ animationDelay: "0.65s" }}>
            <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-[#085C52] to-[#0c7b93]">
              <div className="flex-1">
                <p className="text-[16px] font-semibold text-white mb-1">Ready to sail to Siargao?</p>
                <p className="text-[12px] text-white/55">Book your ferry online — skip the queue, secure your seat.</p>
              </div>
              <a href="/book"
                className="shrink-0 px-5 py-2.5 bg-white text-[#085C52] rounded-full text-[12px] font-semibold hover:bg-[#f0fdfa] transition-colors whitespace-nowrap">
                Book a trip →
              </a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
