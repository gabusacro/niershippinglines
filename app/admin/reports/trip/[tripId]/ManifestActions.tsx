"use client";

interface ManifestActionsProps {
  tripId: string;
  vesselName: string;
  routeName: string;
  departureDate: string;
  departureTime: string;
  /** Passed from server to avoid hydration mismatch (no window on server). */
  shareUrl: string;
}

export function ManifestActions({ tripId, vesselName, routeName, departureDate, departureTime, shareUrl }: ManifestActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const subject = encodeURIComponent(`Passenger Manifest — ${vesselName} — ${departureDate} ${departureTime}`);
  const body = encodeURIComponent(
    `Passenger manifest for ${vesselName}, ${routeName}, ${departureDate} ${departureTime}.\n\nSee attached PDF or link.`
  );
  const mailto = `mailto:?subject=${subject}&body=${body}`;

  const shareTitle = encodeURIComponent(`Passenger Manifest: ${vesselName} — ${departureDate}`);
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${shareTitle}`;

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
      >
        Print / Save as PDF
      </button>
      <a
        href={mailto}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl border-2 border-teal-200 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
      >
        Share via email
      </a>
      <a
        href={fbShare}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl border-2 border-teal-200 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
      >
        Share on Facebook
      </a>
    </div>
  );
}
