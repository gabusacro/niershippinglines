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

        // Check if should show on this page
        const showOn = data.show_on ?? ["all"];
        const shouldShow = showOn.includes("all") || showOn.includes(pathname);
        if (!shouldShow) return;

        // Check 7-day cookie
        const key = "promo_popup_seen";
        const seen = localStorage.getItem(key);
        if (seen) {
          const seenDate = new Date(seen);
          const daysDiff = (Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff < (data.expires_days ?? 7)) return;
        }

        setPopup(data);
        setTimeout(() => setVisible(true), 800); // slight delay feels natural
      });
  }, [pathname]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("promo_popup_seen", new Date().toISOString());
    setTimeout(() => setPopup(null), 300);
  };

  if (!popup) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className={`relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>

        {/* Close button */}
        <button onClick={dismiss}
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors">
          ×
        </button>

        {/* Image */}
        {popup.image_url && (
          <div className="relative">
            <img src={popup.image_url} alt="Promo" className="w-full object-cover max-h-64" />
            {/* Text overlay */}
            {(popup.headline || popup.subtext) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {popup.headline && <p className="text-white font-bold text-xl leading-tight">{popup.headline}</p>}
                {popup.subtext && <p className="text-white/90 text-sm mt-1">{popup.subtext}</p>}
              </div>
            )}
          </div>
        )}

        {/* If no image, show text on colored bg */}
        {!popup.image_url && (popup.headline || popup.subtext) && (
          <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-6">
            {popup.headline && <p className="text-white font-bold text-xl">{popup.headline}</p>}
            {popup.subtext && <p className="text-white/90 text-sm mt-2">{popup.subtext}</p>}
          </div>
        )}

        {/* Button */}
        {popup.button_label && popup.button_url && (
          <div className="bg-white p-4">
            <a href={popup.button_url} onClick={dismiss}
              className="block w-full bg-teal-600 hover:bg-teal-700 text-white text-center font-bold py-3 rounded-xl transition-colors">
              {popup.button_label}
            </a>
            <button onClick={dismiss} className="block w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-2 transition-colors">
              No thanks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}