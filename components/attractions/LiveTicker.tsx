"use client";

// components/attractions/LiveTicker.tsx
// Drop-in replacement for the NewsTicker in ExploreDiscoverPage
// Shows live service updates — ferry, tours, weather — all clickable

export function LiveTicker() {
  const items = [
    { label: "Ferry tickets",  text: "Book Surigao → Dapa — skip the queue",        href: "/book",    color: "#1AB5A3" },
    { label: "Island tours",   text: "Tri-island, Sohoton Cove & more available",   href: "/tours",   color: "#1AB5A3" },
    { label: "Weather",        text: "Check live Siargao sea & wind conditions",     href: "/weather", color: "#60A5FA" },
    { label: "Land tours",     text: "Local guides available — book now",            href: "/tours",   color: "#1AB5A3" },
    { label: "Ferry schedule", text: "View all daily departure times",               href: "/book",    color: "#1AB5A3" },
    { label: "Island hopping", text: "Naked, Daku & Guyam — joiners available",      href: "/tours",   color: "#1AB5A3" },
    { label: "Ferry tickets",  text: "Book Surigao → Dapa — skip the queue",        href: "/book",    color: "#1AB5A3" },
    { label: "Island tours",   text: "Tri-island, Sohoton Cove & more available",   href: "/tours",   color: "#1AB5A3" },
    { label: "Weather",        text: "Check live Siargao sea & wind conditions",     href: "/weather", color: "#60A5FA" },
    { label: "Land tours",     text: "Local guides available — book now",            href: "/tours",   color: "#1AB5A3" },
    { label: "Ferry schedule", text: "View all daily departure times",               href: "/book",    color: "#1AB5A3" },
    { label: "Island hopping", text: "Naked, Daku & Guyam — joiners available",      href: "/tours",   color: "#1AB5A3" },
  ];

  return (
    <div className="bg-[#04342C] overflow-hidden py-2 border-t border-white/[0.05]">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker 32s linear infinite" }}
      >
        {items.map((item, i) => (
          <a
            key={i}
            href={item.href}
            className="inline-flex items-center gap-2 px-6 text-[11px] text-white/50 tracking-wide shrink-0 hover:text-white/80 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ background: item.color }}
            />
            <b style={{ color: item.color, fontWeight: 600 }}>{item.label}</b>
            {item.text}
            <span className="text-white/20 ml-2">·</span>
          </a>
        ))}
      </div>
    </div>
  );
}
