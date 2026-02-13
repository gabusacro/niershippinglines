"use client";

import { useEffect, useState } from "react";

type Props = {
  vesselName: string;
  imageUrls: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function VesselImageModal({ vesselName, imageUrls, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const current = imageUrls[index];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i <= 0 ? imageUrls.length - 1 : i - 1));
      if (e.key === "ArrowRight") setIndex((i) => (i >= imageUrls.length - 1 ? 0 : i + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [imageUrls.length, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Vessel ${vesselName} photos`}
    >
      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-medium text-white">
          {vesselName} — {index + 1} / {imageUrls.length}
        </p>
        <img
          src={current}
          alt={`${vesselName} photo ${index + 1}`}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        {imageUrls.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => (i <= 0 ? imageUrls.length - 1 : i - 1))}
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i >= imageUrls.length - 1 ? 0 : i + 1))}
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
            >
              Next →
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f766e]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
