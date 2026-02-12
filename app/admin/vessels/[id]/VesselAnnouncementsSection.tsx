"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

interface AnnouncementItem {
  id: string;
  message: string;
  vesselId: string | null;
  vesselName: string | null;
  createdAt: string;
  createdBy: string;
}

interface VesselAnnouncementsSectionProps {
  boatId: string;
  boatName: string;
  isAdmin: boolean;
  currentUserId: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function VesselAnnouncementsSection({
  boatId,
  boatName,
  isAdmin,
  currentUserId,
}: VesselAnnouncementsSectionProps) {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<"vessel" | "all">("vessel");
  const [posting, setPosting] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/vessels/${boatId}/announcements`)
      .then((r) => r.json())
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [boatId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/vessels/${boatId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, scope: isAdmin ? scope : "vessel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to post");
      setMessage("");
      setScope("vessel");
      toast.showSuccess("Announcement posted. Passengers will see it on Schedule and Book pages.");
      load();
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!confirm("Remove this announcement?")) return;
    try {
      const res = await fetch(`/api/admin/announcements/${announcementId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      toast.showSuccess("Announcement removed.");
      load();
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const canDelete = (item: AnnouncementItem) => isAdmin || item.createdBy === currentUserId;

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-4 sm:p-5 space-y-4">
      <h2 className="text-base font-semibold text-[#134e4a]">Announcements &amp; updates</h2>
      <p className="text-sm text-[#0f766e]">
        Post schedule or trip updates for passengers. They appear on the <strong>Schedule</strong> and <strong>Book</strong> pages so passengers see &quot;We&apos;ll notify you of any changes&quot; in action.
      </p>

      <form onSubmit={handlePost} className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-3">
        <label className="block text-sm font-medium text-[#134e4a]">New announcement</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Trips delayed by 1 hour today due to weather. Vince Gabriel 1 departing 7:00 AM instead of 6:00 AM."
          rows={3}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
        />
        {isAdmin && (
          <div>
            <span className="text-sm font-medium text-[#134e4a]">Post for: </span>
            <label className="mr-3 inline-flex items-center gap-1.5 text-sm text-[#0f766e]">
              <input
                type="radio"
                name="scope"
                checked={scope === "vessel"}
                onChange={() => setScope("vessel")}
                className="text-[#0c7b93]"
              />
              This vessel ({boatName})
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-[#0f766e]">
              <input
                type="radio"
                name="scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="text-[#0c7b93]"
              />
              All vessels (e.g. weather)
            </label>
          </div>
        )}
        {!isAdmin && (
          <p className="text-xs text-[#0f766e]">This announcement will apply to {boatName} only.</p>
        )}
        <button
          type="submit"
          disabled={posting || !message.trim()}
          className="min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {posting ? "Posting…" : "Post announcement"}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-medium text-[#134e4a] mb-2">Recent announcements</h3>
        {loading ? (
          <p className="text-sm text-[#0f766e]">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-[#0f766e]">No announcements yet. Post one above.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 rounded-lg border border-teal-100 bg-white p-3 text-sm"
              >
                <p className="whitespace-pre-wrap text-[#134e4a]">{item.message}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#0f766e]">
                    {item.vesselName ? `Vessel: ${item.vesselName}` : "All vessels"}
                    {" · "}
                    {formatDate(item.createdAt)}
                  </span>
                  {canDelete(item) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
