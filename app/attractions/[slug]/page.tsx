// app/attractions/[slug]/page.tsx

import { notFound } from "next/navigation";
import { getAttractionBySlug } from "@/lib/attractions/get-attractions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  const item = await getAttractionBySlug(slug);
  if (!item) return { title: "Not found | Travela Siargao" };
  return {
    title: `${item.title} — Siargao Island | Travela Siargao`,
    description: item.description
      ? item.description.slice(0, 160)
      : `Discover ${item.title} on Siargao Island, Philippines. Book your ferry with Travela Siargao.`,
    keywords: [
      item.title.toLowerCase(),
      "siargao island",
      "siargao tourist spots",
      "siargao attractions",
      ...(item.seo_tags ?? []),
    ],
    openGraph: {
      title: `${item.title} — Siargao Island`,
      description:
        item.description?.slice(0, 160) ??
        `Discover ${item.title} on Siargao Island.`,
      url: `https://www.travelasiargao.com/attractions/${item.slug}`,
      siteName: "Travela Siargao",
      images: item.image_url ? [{ url: item.image_url, alt: item.title }] : [],
      type: "article",
    },
  };
}

export default async function AttractionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  if (!slug) notFound();

  const item = await getAttractionBySlug(slug);
  if (!item) notFound();

  const categoryLabel = item.category
    ? item.category.replace("-", " ")
    : item.type;

  // Fallback gradient if no photo
  const heroStyle = item.image_url
    ? {}
    : {
        background: `linear-gradient(135deg, #04342C 0%, #085C52 40%, #0c7b93 70%, #1AB5A3 100%)`,
      };

  return (
    <>
      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-img   { animation: heroZoom 8s ease forwards; }
        .fade-up    { animation: fadeUp 0.7s ease both; }
        .fade-up-2  { animation: fadeUp 0.7s ease 0.15s both; }
        .fade-up-3  { animation: fadeUp 0.7s ease 0.28s both; }
        @media (prefers-reduced-motion: reduce) {
          .hero-img, .fade-up, .fade-up-2, .fade-up-3 { animation: none; }
        }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* ── CINEMATIC HERO ── */}
        <div
          className="relative overflow-hidden"
          style={{ height: 520, ...heroStyle }}
        >
          {/* Real photo */}
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="hero-img absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "center 40%" }}
            />
          )}

          {/* Gradient overlay — cinema quality */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 40%, rgba(2,20,40,0.55) 70%, rgba(2,20,40,0.90) 100%)",
            }}
          />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6 pt-5 flex items-center justify-between">
            <a
              href="/attractions"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,0,0,0.32)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "rgba(255,255,255,0.88)",
                padding: "7px 16px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.01em",
                textDecoration: "none",
              }}
            >
              ← Explore &amp; Discover
            </a>

            {item.is_featured && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(251,191,36,0.18)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(251,191,36,0.38)",
                  color: "#FCD34D",
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                ✦ Featured spot
              </div>
            )}
          </div>

          {/* Title block */}
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto max-w-6xl px-4 sm:px-6 pb-8"
          >
            <div className="fade-up">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(26,181,163,0.18)",
                  border: "1px solid rgba(26,181,163,0.38)",
                  color: "#5DCAA5",
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase" as const,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#1AB5A3",
                    display: "inline-block",
                  }}
                />
                {categoryLabel} · Siargao Island
              </span>
            </div>

            <h1
              className="fade-up-2 font-black text-white"
              style={{
                fontSize: "clamp(28px,5.5vw,52px)",
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
                marginBottom: 10,
                textShadow: "0 2px 28px rgba(0,0,0,0.35)",
              }}
            >
              {item.title}
            </h1>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Stat cards — float up from hero bottom */}
          <div
            className="fade-up-3 grid grid-cols-3 gap-3 relative z-10"
            style={{ marginTop: -32, marginBottom: 28 }}
          >
            {[
              { emoji: "📍", label: "Category", value: categoryLabel },
              { emoji: "🚢", label: "Get here", value: "Ferry + land" },
              {
                emoji: "📖",
                label: "Read time",
                value: `${item.read_minutes ?? 2} min`,
              },
            ].map(({ emoji, label, value }) => (
              <div
                key={label}
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  padding: "14px 10px",
                  textAlign: "center",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#6B7280",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#111827",
                    fontWeight: 700,
                    marginTop: 2,
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 720 }}>

            {/* SEO keyword tags */}
            {item.seo_tags && item.seo_tags.length > 0 && (
              <div
                className="flex flex-wrap gap-2"
                style={{ marginBottom: 22 }}
              >
                {item.seo_tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "5px 13px",
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      color: "#166534",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {item.description && (
              <p
                style={{
                  fontSize: 16,
                  color: "#1f2937",
                  lineHeight: 1.85,
                  fontWeight: 400,
                  marginBottom: 36,
                  whiteSpace: "pre-line",
                }}
              >
                {item.description}
              </p>
            )}

            {/* Ferry CTA */}
            <div
              className="rounded-2xl text-center"
              style={{
                background:
                  "linear-gradient(135deg,#085C52 0%,#0c7b93 50%,#1AB5A3 100%)",
                padding: "36px 24px",
                marginBottom: 40,
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Ready to visit?
              </p>
              <h2
                className="font-black text-white"
                style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 8 }}
              >
                Book your ferry to Siargao 🌊
              </h2>
              <p
                style={{
                  color: "rgba(255,255,255,0.62)",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 22,
                }}
              >
                Skip the queue — book online in 2 minutes, pay via GCash.
              </p>
              <div
                className="flex flex-col sm:flex-row gap-3 justify-center"
              >
                <a
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 font-extrabold hover:-translate-y-0.5 transition-all"
                  style={{
                    background: "white",
                    color: "#085C52",
                    padding: "12px 28px",
                    borderRadius: 14,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  🚢 Book a Trip
                </a>
                <a
                  href="/attractions"
                  className="inline-flex items-center justify-center gap-2 font-bold hover:-translate-y-0.5 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "2px solid rgba(255,255,255,0.25)",
                    color: "white",
                    padding: "12px 28px",
                    borderRadius: 14,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  ← More Attractions
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
