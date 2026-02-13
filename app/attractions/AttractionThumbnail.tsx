"use client";

import { useState } from "react";
import { PalmTree } from "@/components/icons";
import { AttractionImageModal } from "./AttractionImageModal";

type Props = {
  title: string;
  imageUrl: string | null;
  imageUrls?: string[];
};

export function AttractionThumbnail({ title, imageUrl, imageUrls }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const galleryUrls = imageUrls?.length ? imageUrls : (imageUrl ? [imageUrl] : []);
  const canOpenModal = galleryUrls.length > 0;

  if (!imageUrl && !imageUrls?.length) {
    return (
      <div className="shrink-0 rounded-xl bg-[#fef9e7] border border-teal-100 p-3 w-[120px] h-[90px] sm:w-[144px] sm:h-[108px] flex items-center justify-center">
        <PalmTree size={28} className="text-[#0c7b93] sm:w-8 sm:h-8" />
      </div>
    );
  }

  const thumbUrl = imageUrl ?? imageUrls?.[0];
  if (!thumbUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => canOpenModal && setModalOpen(true)}
        className="shrink-0 w-[120px] h-[90px] sm:w-[144px] sm:h-[108px] rounded-xl overflow-hidden border border-teal-200 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/50"
        aria-label={`View photos of ${title}`}
      >
        <img
          src={thumbUrl}
          alt={title}
          className="w-full h-full object-cover"
          width={144}
          height={108}
        />
      </button>
      {modalOpen && galleryUrls.length > 0 && (
        <AttractionImageModal
          title={title}
          imageUrls={galleryUrls}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
