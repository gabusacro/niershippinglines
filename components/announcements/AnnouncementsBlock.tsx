import type { AnnouncementDisplay } from "@/lib/announcements/get-announcements";

interface AnnouncementsBlockProps {
  announcements: AnnouncementDisplay[];
}

/** Format ISO date to short readable (e.g. "Feb 12, 2:30 PM") */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function AnnouncementsBlock({ announcements }: AnnouncementsBlockProps) {
  if (!announcements.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
      <h3 className="font-semibold text-[#134e4a] text-sm sm:text-base">
        Updates &amp; announcements
      </h3>
      <p className="mt-0.5 text-xs text-[#0f766e]">
        Schedule or trip changes. Check here before you go.
      </p>
      <ul className="mt-3 space-y-3">
        {announcements.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2.5 text-sm text-[#134e4a]"
          >
            <p className="whitespace-pre-wrap">{a.message}</p>
            <p className="mt-1.5 text-xs text-[#0f766e]">
              {a.vesselName ? `Vessel: ${a.vesselName}` : "All vessels"}
              {" · "}
              {formatDate(a.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
