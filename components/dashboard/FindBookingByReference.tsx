"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FindBookingByReference() {
  const router = useRouter();
  const [ref, setRef] = useState("");

  const go = () => {
    const trimmed = ref.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/dashboard/bookings/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="mt-4 rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-[#134e4a]">Find a booking by reference</p>
      <p className="mt-0.5 text-xs text-[#0f766e]/80">
        If your pending or confirmed booking doesn&apos;t appear above, enter your reference (e.g. L7HHU7NCHR) and open it. Use the same email you used when booking.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="e.g. L7HHU7NCHR"
          className="min-w-[12rem] rounded-lg border border-teal-200 px-3 py-2 font-mono text-sm uppercase tracking-wide text-[#134e4a] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#0f766e]/60 focus:ring-2 focus:ring-[#0c7b93]"
          aria-label="Booking reference"
        />
        <button
          type="button"
          onClick={go}
          className="rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
        >
          Go to booking
        </button>
      </div>
    </div>
  );
}
