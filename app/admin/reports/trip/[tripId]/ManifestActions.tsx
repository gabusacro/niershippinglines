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

export function ManifestActions({ vesselName, routeName, departureDate, departureTime, shareUrl }: ManifestActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const subject = encodeURIComponent(`Passenger Manifest — ${vesselName} — ${departureDate} ${departureTime}`);
  const body = encodeURIComponent(
    `Passenger manifest for ${vesselName}, ${routeName}, ${departureDate} ${departureTime}.\n\nView live manifest: ${shareUrl}`
  );
  const mailto = `mailto:?subject=${subject}&body=${body}`;

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
    </div>
  );
}
