"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Photo = { url: string; alt: string };

export function AttractionGallery({
  photos,
  title,
}: {
  photos: Photo[];
  title: string;
}) {
  const [current,   setCurrent]   = useState(0);
  const [zoomed,    setZoomed]    = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const trackRef  = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = photos.length;

  // Auto-advance every 5 seconds
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (total <= 1) return;
    timerRef.current = setTimeout(() => {
      setCurrent((c) => (c + 1) % total);
    }, 5000);
  }, [total]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, startTimer]);

  function goTo(i: number) {
    setCurrent(i);
    startTimer();
  }

  function prev() { goTo((current - 1 + total) % total); }
  function next() { goTo((current + 1) % total); }

  // Touch / mouse drag
  function onDragStart(x: number) {
    setDragging(true);
    setDragStart(x);
    setDragDelta(0);
    if (timerRef.current) clearTimeout(timerRef.current);
  }
  function onDragMove(x: number) {
    if (!dragging) return;
    setDragDelta(x - dragStart);
  }
  function onDragEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dragDelta < -50)       next();
    else if (dragDelta > 50)   prev();
    else                       startTimer();
    setDragDelta(0);
  }

  if (!photos.length) return null;

  // Single photo — still uses Ken Burns, just no swipe UI
  if (total === 1) {
    return (
      <>
        <style>{`
          @keyframes kb { from{transform:scale(1) translate(0,0)} to{transform:scale(1.08) translate(-1%,-1%)} }
          .kb-single { animation: kb 10s ease-in-out infinite alternate }
        `}</style>
        <div
          className="relative w-full rounded-2xl overflow-hidden mb-6 cursor-zoom-in"
          style={{ aspectRatio: "16/9" }}
          onClick={() => setZoomed(true)}
        >
          <img
            src={photos[0].url}
            alt={photos[0].alt || title}
            className="kb-single w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500 }}>
              📸 {title} — tap to view full
            </p>
          </div>
        </div>
        {zoomed && <ZoomOverlay photo={photos[0]} title={title} onClose={() => setZoomed(false)} />}
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes kb0 { from{transform:scale(1) translate(0,0)}    to{transform:scale(1.09) translate(-1.5%,-1%)} }
        @keyframes kb1 { from{transform:scale(1) translate(0,0)}    to{transform:scale(1.08) translate(1.5%,1%)} }
        @keyframes kb2 { from{transform:scale(1) translate(0,0)}    to{transform:scale(1.1)  translate(-1%,1.5%)} }
        .kb-0 { animation: kb0 8s ease-in-out forwards }
        .kb-1 { animation: kb1 8s ease-in-out forwards }
        .kb-2 { animation: kb2 8s ease-in-out forwards }
        .gallery-slide { transition: opacity 0.6s ease; }
        .gallery-thumb { transition: all 0.2s ease; }
      `}</style>

      <div className="mb-6 select-none">

        {/* ── Main swipe area ── */}
        <div
          className="relative w-full rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ aspectRatio: "16/9", background: "#04342C" }}
          onMouseDown={(e) => onDragStart(e.clientX)}
          onMouseMove={(e) => onDragMove(e.clientX)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientX)}
          onTouchEnd={onDragEnd}
        >
          {/* Slides — all stacked, fade in/out */}
          {photos.map((photo, i) => (
            <div
              key={i}
              className="gallery-slide absolute inset-0"
              style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
            >
              <img
                src={photo.url}
                alt={photo.alt || title}
                className={`w-full h-full object-cover kb-${i % 3}`}
                style={{
                  animationPlayState: i === current ? "running" : "paused",
                  transform: i !== current ? "none" : undefined,
                }}
                draggable={false}
                onClick={() => !dragging && Math.abs(dragDelta) < 5 && setZoomed(true)}
              />
            </div>
          ))}

          {/* Dark gradient overlays */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,transparent 30%,transparent 55%,rgba(2,20,40,0.7) 100%)",
            zIndex: 2,
          }} />

          {/* Arrow nav */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: 18, zIndex: 3, cursor: "pointer" }}
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: 18, zIndex: 3, cursor: "pointer" }}
              >
                ›
              </button>
            </>
          )}

          {/* Bottom info bar */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 pointer-events-none" style={{ zIndex: 3 }}>
            <div className="flex items-center justify-between">
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 500 }}>
                📸 {title}
              </p>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}>
                {current + 1} / {total}
              </div>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none" style={{ zIndex: 3 }}>
            {photos.map((_, i) => (
              <div
                key={i}
                style={{
                  width:  i === current ? 20 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === current ? "white" : "rgba(255,255,255,0.4)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Zoom hint on first load */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 2, opacity: 0 }}
          >
            <div style={{
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)", color: "white",
              padding: "8px 18px", borderRadius: 999, fontSize: 12, fontWeight: 600,
            }}>
              Tap to zoom
            </div>
          </div>
        </div>

        {/* ── Thumbnail strip ── */}
        <div className="flex gap-2 mt-2">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="gallery-thumb flex-1 overflow-hidden rounded-xl"
              style={{
                height: 56,
                border: i === current ? "2px solid #0c7b93" : "2px solid transparent",
                opacity: i === current ? 1 : 0.55,
                transform: i === current ? "scale(1.02)" : "scale(1)",
                background: "#04342C",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <img
                src={photo.url}
                alt={photo.alt || `Photo ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                draggable={false}
              />
            </button>
          ))}
        </div>

        {/* Mobile swipe hint */}
        <p style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", marginTop: 6, fontWeight: 500 }}>
          ← Swipe or tap thumbnails to browse · Tap photo to zoom
        </p>
      </div>

      {/* Zoom overlay */}
      {zoomed && (
        <ZoomOverlay
          photo={photos[current]}
          title={`${title} — ${current + 1} of ${total}`}
          onClose={() => setZoomed(false)}
          onPrev={total > 1 ? () => { prev(); } : undefined}
          onNext={total > 1 ? () => { next(); } : undefined}
        />
      )}
    </>
  );
}

// ── Fullscreen zoom overlay ───────────────────────────────────────────────────
function ZoomOverlay({
  photo, title, onClose, onPrev, onNext,
}: {
  photo: Photo;
  title: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center transition-all hover:bg-white/20"
        style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: 20, fontWeight: 700, cursor: "pointer", zIndex: 10 }}
      >
        ×
      </button>

      {/* Prev / Next in zoom */}
      {onPrev && (
        <button onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all hover:bg-white/20"
          style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: 22, cursor: "pointer", zIndex: 10 }}>
          ‹
        </button>
      )}
      {onNext && (
        <button onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all hover:bg-white/20"
          style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", fontSize: 22, cursor: "pointer", zIndex: 10 }}>
          ›
        </button>
      )}

      {/* Image */}
      <div
        style={{ width: "min(94vw, 960px)", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.alt || title}
          style={{
            width: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
            borderRadius: 16,
            display: "block",
          }}
        />
        <div className="mt-3 text-center">
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500 }}>{title}</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 }}>
            Press Esc to close · Arrow keys to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
