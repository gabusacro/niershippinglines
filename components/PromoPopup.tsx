"use client";

/**
 * PromoPopup — visitor-facing promotional popup
 * - Fetches from /api/admin/promo-popup on mount
 * - Shows once, then hides for expires_days
 * - Re-shows automatically if admin saves new content (updated_at changed)
 * - Toggling is_active off → popup never shows regardless of localStorage
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

const LS_SEEN_AT  = "travela_promo_seen_at";
const LS_VER      = "travela_promo_ver"; // stores updated_at so content changes re-trigger

export default function PromoPopup() {
  const [popup, setPopup]   = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/promo-popup", { cache: "no-store" });
        if (!res.ok) return;
        const data: PopupData | null = await res.json();
        if (cancelled || !data) return;

        // If admin turned it off — never show
        if (!data.is_active) return;

        // Page filter
        const showOn = Array.isArray(data.show_on) ? data.show_on : ["all"];
        const onThisPage =
          showOn.includes("all") ||
          showOn.some((p) => pathname === p || pathname.startsWith(p + "/"));
        if (!onThisPage) return;

        // Check localStorage — skip if seen recently AND content hasn't changed
        try {
          const lsVer    = localStorage.getItem(LS_VER);
          const lsSeenAt = localStorage.getItem(LS_SEEN_AT);
          const currentVer = data.updated_at ?? data.id;

          // Content changed since last seen → always show again
          if (lsVer && lsVer !== currentVer) {
            localStorage.removeItem(LS_SEEN_AT);
            localStorage.removeItem(LS_VER);
          } else if (lsSeenAt) {
            const daysSince = (Date.now() - new Date(lsSeenAt).getTime()) / 86_400_000;
            if (daysSince < (data.expires_days ?? 7)) return; // still within cooldown
          }
        } catch {
          // localStorage blocked → show anyway
        }

        setPopup(data);
        setTimeout(() => { if (!cancelled) setVisible(true); }, 800);
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
      if (popup?.updated_at ?? popup?.id) {
        localStorage.setItem(LS_VER, popup?.updated_at ?? popup?.id ?? "");
      }
    } catch {}
    setTimeout(() => setPopup(null), 350);
  }

  if (!popup) return null;

  const hasImage  = Boolean(popup.image_url);
  const hasText   = Boolean(popup.headline || popup.subtext);
  const hasButton = Boolean(popup.button_label && popup.button_url);
  if (!hasImage && !hasText && !hasButton) return null;

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
        className={`relative w-full rounded-3xl overflow-hidden shadow-2xl bg-white transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-6"
        }`}
        style={{ maxWidth: 340 }}
      >
        {hasImage && (
          <div className="w-full bg-[#f0fdfa] flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={popup.image_url!}
              alt={popup.headline ?? "Promo"}
              className="w-full rounded-2xl"
              style={{ maxHeight: 320, objectFit: "contain", objectPosition: "center" }}
              loading="eager"
            />
          </div>
        )}

        {hasText && (
          <div className={`px-5 py-4 ${
            hasImage
              ? "bg-white border-t border-teal-50"
              : "bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3]"
          }`}>
            {popup.headline && (
              <p className={`font-extrabold text-lg leading-tight ${hasImage ? "text-[#134e4a]" : "text-white"}`}>
                {popup.headline}
              </p>
            )}
            {popup.subtext && (
              <p className={`text-sm mt-1 leading-relaxed ${hasImage ? "text-[#0f766e]" : "text-white/85"}`}>
                {popup.subtext}
              </p>
            )}
          </div>
        )}

        {hasButton && (
          <div className="px-5 pb-5 pt-3 bg-white">
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
