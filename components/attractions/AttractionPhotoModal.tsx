"use client";

import { useState, useEffect } from "react";

export function AttractionPhotoModal({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    // Prevent body scroll when modal open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ── Clickable thumbnail ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl mb-6 block cursor-zoom-in"
        style={{ aspectRatio: "16/9" }}
        aria-label={`View full photo of ${title}`}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        {/* Zoom hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "white", padding: "8px 18px", borderRadius: 999,
            fontSize: 13, fontWeight: 600,
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6" />
            </svg>
            View full photo
          </div>
        </div>
        {/* Caption bar */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5"
          style={{ background: "linear-gradient(to top,rgba(0,0,0,0.6),transparent)" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500 }}>
            📸 {title} — tap to view full photo
          </p>
        </div>
      </button>

      {/* ── Fullscreen modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
            style={{ fontSize: 20, fontWeight: 700 }}
          >
            ×
          </button>

          {/* Image — landscape constrained */}
          <div
            className="relative"
            style={{
              width: "min(92vw, 860px)",
              maxHeight: "88vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={title}
              style={{
                width: "100%",
                maxHeight: "82vh",
                objectFit: "contain",
                borderRadius: 16,
                display: "block",
              }}
            />
            {/* Caption */}
            <div className="mt-3 text-center">
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500 }}>
                {title} · Siargao Island, Philippines
              </p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 }}>
                Press Esc or tap outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
