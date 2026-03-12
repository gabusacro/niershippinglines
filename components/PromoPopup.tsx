"use client";

/**
 * PromoPopup — visitor-facing promotional popup
 * - Shows once per session, hides for expires_days after dismissal
 * - Image displayed with object-contain so PNGs are never cropped
 * - Text overlay appears between image and close button
 * - Close button always centered below popup
 * - Clicking backdrop dismisses
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
};

const STORAGE_KEY = "travela_promo_seen_at";
const STORAGE_VER = "travela_promo_id";

export default function PromoPopup() {
  const [popup, setPopup] = useState<PopupData | null>(null);
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
        if (cancelled) return;
        if (!data?.is_active) return;

        // Page filter
        const showOn = data.show_on ?? ["all"];
        const shouldShow =
          showOn.includes("all") ||
          showOn.some((p) => pathname === p || pathname.startsWith(p + "/"));
        if (!shouldShow) return;

        // Expiry check — also reset if popup ID changed (new promo)
        try {
          const seenAt = localStorage.getItem(STORAGE_KEY);
          const seenId = localStorage.getItem(STORAGE_VER);

          // If popup ID changed, always show the new promo
          if (seenId && seenId !== data.id) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_VER);
          } else if (seenAt) {
            const daysSince =
              (Date.now() - new Date(seenAt).getTime()) /
              (1000 * 60 * 60 * 24);
            if (daysSince < (data.expires_days ?? 7)) return;
          }
        } catch {
          // localStorage blocked (private browsing) — show anyway
        }

        setPopup(data);
        // Small delay so page has loaded before popup appears
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 1000);
      } catch {
        // Silently fail — never break the page
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pathname]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      if (popup?.id) localStorage.setItem(STORAGE_VER, popup.id);
    } catch {}
    setTimeout(() => setPopup(null), 350);
  }

  if (!popup) return null;

  const hasImage = Boolean(popup.image_url);
  const hasText = Boolean(popup.headline || popup.subtext);
  const hasButton = Boolean(popup.button_label && popup.button_url);
  const hasContent = hasImage || hasText || hasButton;
  if (!hasContent) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Promotional offer"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Popup card */}
      <div
        className={`relative w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl bg-white transition-all duration-350 ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-6"
        }`}
        style={{ maxWidth: 340 }}
      >
        {/* Image — object-contain so PNG shapes are never cropped */}
        {hasImage && (
          <div className="w-full bg-[#f0fdfa] flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={popup.image_url!}
              alt={popup.headline ?? "Promo"}
              className="w-full rounded-2xl"
              style={{
                maxHeight: 320,
                objectFit: "contain",
                objectPosition: "center",
              }}
              loading="eager"
            />
          </div>
        )}

        {/* Text overlay — between image and button */}
        {hasText && (
          <div
            className={`px-5 py-4 ${
              hasImage
                ? "bg-white border-t border-teal-50"
                : "bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3]"
            }`}
          >
            {popup.headline && (
              <p
                className={`font-extrabold text-lg leading-tight ${
                  hasImage ? "text-[#134e4a]" : "text-white"
                }`}
              >
                {popup.headline}
              </p>
            )}
            {popup.subtext && (
              <p
                className={`text-sm mt-1 leading-relaxed ${
                  hasImage ? "text-[#0f766e]" : "text-white/85"
                }`}
              >
                {popup.subtext}
              </p>
            )}
          </div>
        )}

        {/* Button */}
        {hasButton && (
          <div className="px-5 pb-5 pt-3 bg-white">
            <a
              href={popup.button_url!}
              onClick={dismiss}
              className="block w-full bg-gradient-to-r from-[#0c7b93] to-[#0f766e] hover:from-[#0f766e] hover:to-[#085C52] text-white text-center font-bold py-3 rounded-2xl transition-all shadow-md hover:shadow-lg text-sm"
            >
              {popup.button_label}
            </a>
          </div>
        )}
      </div>

      {/* Close button — always centered below popup */}
      <button
        onClick={dismiss}
        aria-label="Close promotional popup"
        className="mt-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors backdrop-blur-sm"
        style={{ width: 44, height: 44, fontSize: 24, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
