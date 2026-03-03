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
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    if (imageUrls.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % imageUrls.length);
        setFading(false);
      }, 800);
    }, 4500);
    return () => clearInterval(id);
  }, [imageUrls.length]);

  return (
    <div style={{ position: "relative", minHeight: 320, overflow: "hidden" }}>

      {/* Background photos — fade between them */}
      {imageUrls.map((url, i) => (
        <div key={url} style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${url})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: i === current ? (fading ? 0 : 0.82) : 0,
          transition: "opacity 0.8s ease",
          zIndex: 0,
        }} />
      ))}

      {/* Fallback solid teal */}
      <div style={{ position: "absolute", inset: 0, background: "#134e4a", zIndex: -1 }} />

      {/* Teal overlay — edges darker so photos show in middle, logo always readable */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(to bottom, rgba(13,78,74,0.5) 0%, rgba(13,78,74,0.15) 40%, rgba(13,78,74,0.15) 60%, rgba(13,78,74,0.75) 100%)",
      }} />

      {/* Wave */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 32"
        fill="none" preserveAspectRatio="none" style={{ zIndex: 3 }}>
        <path d="M0 16 C240 32 480 0 720 16 C960 32 1200 0 1440 16 L1440 32 L0 32 Z" fill="#f7f3eb" />
      </svg>

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        padding: "52px 16px 64px",
      }}>
        {/* Logo — snug green circle, no oversized ring */}
        <div style={{
          width: 96, height: 96,
          borderRadius: "50%",
          background: "rgba(13,78,74,0.9)",
          border: "2.5px solid rgba(255,255,255,0.35)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
          overflow: "hidden",
        }}>
          <Image src="/favicon.png" alt="Travela Siargao" width={88} height={88}
            style={{ borderRadius: "50%", display: "block" }} />
        </div>

        <h1 style={{
          fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)",
          fontWeight: 800, color: "#fff",
          letterSpacing: "-0.03em", lineHeight: 1.1,
          marginBottom: 10,
          textShadow: "0 2px 16px rgba(0,0,0,0.45)",
        }}>
          Explore Siargao
        </h1>

        <p style={{
          fontSize: "clamp(0.875rem, 1.8vw, 1rem)",
          color: "rgba(255,255,255,0.82)", maxWidth: 460,
          lineHeight: 1.6, textShadow: "0 1px 8px rgba(0,0,0,0.4)",
        }}>
          {subtitle}
        </p>

        {/* Dot indicators */}
        {imageUrls.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
            {imageUrls.map((_, i) => (
              <div key={i} style={{
                width: i === current ? 18 : 6, height: 6, borderRadius: 999,
                background: i === current ? "#5eead4" : "rgba(255,255,255,0.35)",
                transition: "width 0.4s ease, background 0.4s ease",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
