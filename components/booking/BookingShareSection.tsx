"use client";

/**
 * BookingShareSection
 * Drop this inside BookingDetailPage when status is confirmed/boarded/completed.
 * Shows a "Share your trip" card with pre-filled message.
 */

import { ShareButtons } from "@/components/ShareButtons";

type Props = {
  routeName: string;
  origin: string;
  destination: string;
};

export function BookingShareSection({ routeName, origin, destination }: Props) {
  const route = origin && destination ? `${origin} to ${destination}` : routeName;
  const message = `Just booked my trip to Siargao! 🏝️ Heading from ${route} via Travela Siargao.`;

  return (
    <div className="mt-6 rounded-2xl border-2 border-teal-100 bg-gradient-to-br from-[#f0fdfa] to-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c7b93]/10 text-xl">🏝️</span>
        <div>
          <p className="font-bold text-[#134e4a] text-sm">Share your trip!</p>
          <p className="text-xs text-[#6B8886]">Let your friends know you're heading to Siargao</p>
        </div>
      </div>
      <ShareButtons
        message={message}
        url="https://travelasiargao.com"
        label=""
      />
    </div>
  );
}
