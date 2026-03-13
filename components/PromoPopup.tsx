"use client";

/**
 * PromoPopup — visitor-facing promotional popup
 *
 * Layout rules:
 * - Image sits on its own with NO background box (fully transparent/clear)
 * - Text + CTA get a white card below the image ONLY if they have content
 * - If only image: just the image + close button, no card at all
 * - If only text/CTA (no image): full-color card with gradient background
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PopupData = {
  id: string;
  is_active: boolean;
  image_url?: string | null;
  headline?: string | null;
  subtext?: string | null;
  button_label?: string | null;
  button_url?: string | null;
  show_on: string[];
  expires_days: number;
  updated_at?: string | null;
};

const LS_SEEN_AT = "travela_promo_seen_at";
const LS_VER     = "travela_promo_ver";

export default function PromoPopup() {
  const [popup, setPopup]     = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/promo-popup", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data: PopupData | null = await res.json();
        if (cancelled || !data) return;

        // Admin turned it off — never show
        if (!data.is_active) return;

        // Page filter
        const showOn = Array.isArray(data.show_on) ? data.show_on : ["all"];
        const onThisPage =
          showOn.includes("all") ||
          showOn.some(p => pathname === p || pathname.startsWith(p + "/"));
        if (!onThisPage) return;

        // localStorage cooldown check
        try {
          const lsVer    = localStorage.getItem(LS_VER);
          const lsSeenAt = localStorage.getItem(LS_SEEN_AT);
          const currentVer = data.updated_at ?? data.id;

          if (lsVer && lsVer !== currentVer) {
            // Content updated since last seen → reset and show again
            localStorage.removeItem(LS_SEEN_AT);
            localStorage.removeItem(LS_VER);
          } else if (lsSeenAt) {
            const daysSince = (Date.now() - new Date(lsSeenAt).getTime()) / 86_400_000;
            if (daysSince < (data.expires_days ?? 1)) return;
          }
        } catch {
          // localStorage blocked → show anyway
        }

        setPopup(data);
        setTimeout(() => { if (!cancelled) setVisible(true); }, 600);
      } catch {
        // Never break the page
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pathname]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(LS_SEEN_AT, new Date().toISOString());
      const ver = popup?.updated_at ?? popup?.id ?? "";
      if (ver) localStorage.setItem(LS_VER, ver);
    } catch {}
    setTimeout(() => setPopup(null), 350);
  }

  if (!popup) return null;

  const hasImage  = Boolean(popup.image_url);
  const hasText   = Boolean(popup.headline || popup.subtext);
  const hasButton = Boolean(popup.button_label && popup.button_url);
  const hasCard   = hasText || hasButton; // card only needed if there's text or CTA

  if (!hasImage && !hasCard) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Promotional offer"
      onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        className={`relative w-full transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-6"
        }`}
        style={{ maxWidth: 340 }}
      >

        {/* ── Image — no background, fully transparent ─────────────────── */}
        {hasImage && (
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={popup.image_url!}
              alt={popup.headline ?? "Promo"}
              className={`w-full ${hasCard ? "rounded-t-3xl" : "rounded-3xl"}`}
              style={{
                maxHeight: 340,
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
                // Transparent: no background applied
              }}
              loading="eager"
            />
          </div>
        )}

        {/* ── Text + CTA card — only rendered if there's content ────────── */}
        {hasCard && (
          <div className={`bg-white shadow-2xl rounded-3xl overflow-hidden${hasImage ? " mt-3" : ""}`}>

            {/* Text section */}
            {hasText && (
              <div className={`px-6 pt-5 pb-1 text-center ${
                !hasImage
                  ? "bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3]"
                  : "bg-white"
              }`}>
                {popup.headline && (
                  <p className={`font-extrabold text-lg leading-tight ${
                    !hasImage ? "text-white" : "text-[#134e4a]"
                  }`}>
                    {popup.headline}
                  </p>
                )}
                {popup.subtext && (
                  <p className={`text-sm mt-1.5 leading-relaxed ${
                    !hasImage ? "text-white/85" : "text-[#0f766e]"
                  }`}>
                    {popup.subtext}
                  </p>
                )}
              </div>
            )}

            {/* CTA button */}
            {hasButton && (
              <div className={`px-5 pb-5 ${hasText ? "pt-4" : "pt-5"} bg-white`}>
                <a
                  href={popup.button_url!}
                  onClick={dismiss}
                  className="block w-full bg-gradient-to-r from-[#0c7b93] to-[#0f766e] hover:from-[#0f766e] hover:to-[#085C52] text-white text-center font-bold py-3 rounded-2xl text-sm shadow-md hover:shadow-lg transition-all"
                >
                  {popup.button_label}
                </a>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Close button ─────────────────────────────────────────────────── */}
      <button
        onClick={dismiss}
        aria-label="Close promotional popup"
        className="mt-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
        style={{ width: 44, height: 44, fontSize: 24, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
