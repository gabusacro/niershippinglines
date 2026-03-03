// app/attractions/AttractionsHero.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type HeroProps = {
  imageUrls: string[];
  subtitle: string;
};

export function AttractionsHero({ imageUrls, subtitle }: HeroProps) {
  const [current, setCurrent] = useState(0);
  const [next, setNext]       = useState(1);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    if (imageUrls.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % imageUrls.length);
        setNext((c)     => (c + 2) % imageUrls.length);
        setFading(false);
      }, 900);
    }, 4000);
    return () => clearInterval(id);
  }, [imageUrls.length]);

  const bgCurrent = imageUrls[current];
  const bgNext    = imageUrls[next];

  return (
    <div className="relative overflow-hidden" style={{ minHeight: 340 }}>

      {/* ── Background photos — cross-fade ── */}
      {bgCurrent && (
        <div
          key={`bg-${current}`}
          style={{
            position:           "absolute", inset: 0,
            backgroundImage:    `url(${bgCurrent})`,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            opacity:            fading ? 0 : 0.82,
            transition:         "opacity 0.9s ease",
            zIndex:             0,
          }}
        />
      )}
      {bgNext && (
        <div
          key={`bg-next-${next}`}
          style={{
            position:           "absolute", inset: 0,
            backgroundImage:    `url(${bgNext})`,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            opacity:            fading ? 0.82 : 0,
            transition:         "opacity 0.9s ease",
            zIndex:             0,
          }}
        />
      )}

      {/* ── Left and right semi-transparent photo strips ── */}
      {/* These are handled by the full-width bg above — the teal overlay below controls left/right */}

      {/* ── Teal overlay — lighter in center, darker on edges so logo pops ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: [
          "linear-gradient(to right,  rgba(13,78,74,0.72) 0%, rgba(13,78,74,0.18) 30%, rgba(13,78,74,0.18) 70%, rgba(13,78,74,0.72) 100%)",
          "linear-gradient(to bottom, rgba(13,78,74,0.55) 0%, rgba(13,78,74,0.2) 40%, rgba(13,78,74,0.2) 60%, rgba(13,78,74,0.8) 100%)",
        ].join(", "),
      }} />

      {/* ── Solid teal fallback beneath everything (shows if no images yet) ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: -1,
        background: "#134e4a",
      }} />

      {/* ── Wave bottom edge ── */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 32" fill="none" preserveAspectRatio="none"
        style={{ zIndex: 3 }}
      >
        <path d="M0 16 C240 32 480 0 720 16 C960 32 1200 0 1440 16 L1440 32 L0 32 Z" fill="#f7f3eb" />
      </svg>

      {/* ── Content ── */}
      <div className="relative z-2 flex flex-col items-center justify-center text-center px-4 py-14 sm:py-20"
        style={{ zIndex: 2 }}>

        {/* Logo — always on teal pill so it's readable over any photo */}
        <div style={{
          background:    "rgba(13,78,74,0.88)",
          border:        "2px solid rgba(255,255,255,0.25)",
          borderRadius:  "50%",
          padding:       12,
          backdropFilter:"blur(8px)",
          boxShadow:     "0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)",
          marginBottom:  20,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
        }}>
          <Image
            src="/favicon.png"
            alt="Travela Siargao"
            width={80}
            height={80}
            style={{ borderRadius: "50%", display: "block" }}
          />
        </div>

        <h1 style={{
          fontSize:      "clamp(2rem, 5vw, 3rem)",
          fontWeight:    800,
          color:         "#ffffff",
          letterSpacing: "-0.03em",
          lineHeight:    1.1,
          marginBottom:  12,
          textShadow:    "0 2px 16px rgba(0,0,0,0.4)",
        }}>
          Explore Siargao
        </h1>

        <p style={{
          fontSize:   "clamp(0.9rem, 2vw, 1.05rem)",
          color:      "rgba(255,255,255,0.82)",
          maxWidth:   480,
          lineHeight: 1.6,
          textShadow: "0 1px 8px rgba(0,0,0,0.4)",
        }}>
          {subtitle}
        </p>

        {/* Photo dot indicators */}
        {imageUrls.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
            {imageUrls.map((_, i) => (
              <div key={i} style={{
                width:        i === current ? 20 : 6,
                height:       6,
                borderRadius: 999,
                background:   i === current ? "#5eead4" : "rgba(255,255,255,0.35)",
                transition:   "width 0.4s ease, background 0.4s ease",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
