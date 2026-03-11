"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PopupData = {
  is_active: boolean;
  image_url?: string;
  headline?: string;
  subtext?: string;
  button_label?: string;
  button_url?: string;
  show_on: string[];
  expires_days: number;
};

export default function PromoPopup() {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/admin/promo-popup")
      .then((r) => r.json())
      .then((data: PopupData) => {
        if (!data?.is_active) return;

        const showOn = data.show_on ?? ["all"];
        const shouldShow = showOn.includes("all") || showOn.includes(pathname);
        if (!shouldShow) return;

        // Check expiry in localStorage
        const key = "promo_popup_seen";
        try {
          const seen = localStorage.getItem(key);
          if (seen) {
            const daysDiff = (Date.now() - new Date(seen).getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff < (data.expires_days ?? 7)) return;
          }
        } catch {}

        setPopup(data);
        setTimeout(() => setVisible(true), 900);
      })
      .catch(() => {});
  }, [pathname]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem("promo_popup_seen", new Date().toISOString()); } catch {}
    setTimeout(() => setPopup(null), 300);
  };

  if (!popup) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className={`relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
        visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
      }`}>

        {/* Image with text overlay */}
        {popup.image_url ? (
          <div className="relative">
            <img src={popup.image_url} alt="Promo" className="w-full object-cover max-h-64" />
            {(popup.headline || popup.subtext) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {popup.headline && <p className="text-white font-bold text-xl leading-tight">{popup.headline}</p>}
                {popup.subtext && <p className="text-white/90 text-sm mt-1">{popup.subtext}</p>}
              </div>
            )}
          </div>
        ) : (popup.headline || popup.subtext) ? (
          <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-6">
            {popup.headline && <p className="text-white font-bold text-xl">{popup.headline}</p>}
            {popup.subtext && <p className="text-white/90 text-sm mt-2">{popup.subtext}</p>}
          </div>
        ) : null}

        {/* Button */}
        {popup.button_label && popup.button_url && (
          <div className="bg-white p-4">
            <a
              href={popup.button_url}
              onClick={dismiss}
              className="block w-full bg-[#0c7b93] hover:bg-[#0f766e] text-white text-center font-bold py-3 rounded-xl transition-colors"
            >
              {popup.button_label}
            </a>
          </div>
        )}
      </div>

      {/* Close button — outside the box, centered below */}
      <button
        onClick={dismiss}
        className="mt-5 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 text-2xl font-bold transition-colors backdrop-blur-sm"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}