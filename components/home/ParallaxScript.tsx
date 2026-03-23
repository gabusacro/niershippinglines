"use client";

import { useEffect } from "react";

export default function ParallaxScript() {
  useEffect(() => {
    const heroBg = document.getElementById("heroBg");
    if (!heroBg) return;

    // ✅ Scroll parallax (up/down)
    const onScroll = () => {
      const s = window.pageYOffset;
      heroBg.style.transform = `translateY(${s * 0.3}px)`;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // ✅ Add smooth zoom animation (alive effect)
    const style = document.createElement("style");
    style.textContent = `
      @keyframes heroZoom {
        0% { transform: scale(1.08); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1.08); }
      }

      #heroBg {
        animation: heroZoom 8s ease-in-out infinite;
        will-change: transform;
      }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}