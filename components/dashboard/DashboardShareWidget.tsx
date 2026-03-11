"use client";

/**
 * DashboardShareWidget
 * Add this to the passenger dashboard Quick Actions section.
 * Uses the generic "homepage/tours" message.
 */

import { ShareButtons } from "@/components/ShareButtons";

export function DashboardShareWidget() {
  return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c7b93]/10 text-2xl">📣</span>
        <div>
          <p className="font-bold text-[#134e4a] text-sm">Spread the word!</p>
          <p className="text-xs text-[#6B8886]">Help others discover Travela Siargao</p>
        </div>
      </div>
      <ShareButtons
        message="Check out Travela Siargao for ferry & tour bookings! 🚢🏝️"
        url="https://travelasiargao.com"
        label=""
      />
    </div>
  );
}
