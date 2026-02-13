"use client";

import { useState } from "react";
import { VesselImageModal } from "./VesselImageModal";

type Props = {
  vesselImageUrl: string;
  vesselName?: string | null;
  vesselImageUrls?: string[];
};

export function VesselThumbnail({ vesselImageUrl, vesselName, vesselImageUrls }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const galleryUrls = vesselImageUrls?.length ? vesselImageUrls : (vesselImageUrl ? [vesselImageUrl] : []);
  const canOpenModal = galleryUrls.length > 0;

  return (
    <>
      {vesselImageUrl ? (
        <button
          type="button"
          onClick={() => canOpenModal && setModalOpen(true)}
          className="shrink-0 w-[108px] h-[72px] sm:w-[144px] sm:h-[96px] rounded-lg overflow-hidden border border-teal-200 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/50"
          aria-label={vesselName ? `View photos of ${vesselName}` : "View vessel photos"}
        >
          <img
            src={vesselImageUrl}
            alt={vesselName ? `Vessel ${vesselName}` : "Vessel"}
            className="w-full h-full object-cover"
            width={144}
            height={96}
          />
        </button>
      ) : null}
      {modalOpen && galleryUrls.length > 0 && (
        <VesselImageModal
          vesselName={vesselName ?? "Vessel"}
          imageUrls={galleryUrls}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
