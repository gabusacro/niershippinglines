"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AnnouncementItem {
  id: string;
  message: string;
  vessel_id: string | null;
  vessel_name: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  active_until: string | null;
  is_active: boolean;
}

interface Vessel {
  id: string;
  name: string;
}

interface Props {
  initialItems: AnnouncementItem[];
  vessels: Vessel[];
  currentUserId: string;
  isAdmin: boolean;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
      timeZone: "Asia/Manila",
    });
  } catch { return ""; }
}

export function AnnouncementsClient({ initialItems, vessels, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");
  const [vesselId, setVesselId] = useState<string>("all");
  const [activeUntil, setActiveUntil] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterVessel, setFilterVessel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expired">("active");

  const reload = async () => {
    const res = await fetch("/api/admin/announcements");
    const data = await res.json();
    if (Array.isArray(data)) {
      const now = new Date();
      setItems(data.map((a: AnnouncementItem) => ({
        ...a,
        is_active: !a.active_until || new Date(a.active_until) > now,
      })));
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setPosting(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = { message: trimmed };
      if (vesselId !== "all") body.vessel_id = vesselId;
      if (activeUntil) body.active_until = new Date(activeUntil).toISOString();

      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to post");
      setMessage("");
      setVesselId("all");
      setActiveUntil("");
      setSuccess("Announcement posted! Passengers will see it immediately.");
      await reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this announcement?")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      setSuccess("Announcement removed.");
      await reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const canDelete = (item: AnnouncementItem) =>
    isAdmin || item.created_by === currentUserId;

  const filtered = items.filter((item) => {
    if (filterVessel !== "all") {
      if (filterVessel === "global" && item.vessel_id !== null) return false;
      if (filterVessel !== "global" && item.vessel_id !== filterVessel) return false;
    }
    if (filterStatus === "active" && !item.is_active) return false;
    if (filterStatus === "expired" && item.is_active) return false;
    return true;
  });

  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div className="mt-6 space-y-6">

      {/* Post form */}
      <form onSubmit={handlePost} className="rounded-xl border border-teal-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="text-base font-semibold text-[#134e4a]">Post new announcement</h2>

        <div>
          <label className="block text-sm font-medium text-[#134e4a] mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Trips delayed 1 hour today due to weather conditions. Vessel departing 7:00 AM instead of 6:00 AM."
            rows={3}
            required
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#134e4a] mb-1">Vessel</label>
            <select
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
            >
              <option value="all">📢 All vessels (broadcast)</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#0f766e]">
              {vesselId === "all" ? "Shown for all vessels on Schedule & Book pages." : `Shown only for ${vessels.find(v => v.id === vesselId)?.name ?? "this vessel"}.`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#134e4a] mb-1">
              Active until <span className="text-xs font-normal text-[#0f766e]">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={activeUntil}
              onChange={(e) => setActiveUntil(e.target.value)}
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
            />
            <p className="mt-1 text-xs text-[#0f766e]">Leave blank to show indefinitely until manually removed.</p>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={posting || !message.trim()}
          className="min-h-[44px] rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
        >
          {posting ? "Posting…" : "📢 Post announcement"}
        </button>
      </form>

      {/* Filters + list */}
      <div className="rounded-xl border border-teal-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-teal-100 p-4">
          <p className="text-sm font-semibold text-[#134e4a]">
            All announcements
            {activeCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                {activeCount} active
              </span>
            )}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "expired")}
              className="rounded-lg border border-teal-200 px-2 py-1.5 text-xs font-semibold text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
            >
              <option value="active">Active only</option>
              <option value="all">All</option>
              <option value="expired">Expired only</option>
            </select>
            {/* Vessel filter */}
            <select
              value={filterVessel}
              onChange={(e) => setFilterVessel(e.target.value)}
              className="rounded-lg border border-teal-200 px-2 py-1.5 text-xs font-semibold text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
            >
              <option value="all">All vessels</option>
              <option value="global">Global only</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#0f766e]">No announcements match this filter.</p>
        ) : (
          <ul className="divide-y divide-teal-50">
            {filtered.map((item) => (
              <li key={item.id} className={`flex flex-col gap-2 p-4 ${!item.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm text-[#134e4a]">{item.message}</p>
                  {canDelete(item) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#0f766e]">
                  {item.vessel_name ? (
                    <span className="rounded-full bg-[#0c7b93]/10 px-2 py-0.5 font-semibold text-[#0c7b93]">
                      🚢 {item.vessel_name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      📢 All vessels
                    </span>
                  )}
                  {item.is_active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">Expired</span>
                  )}
                  <span>{formatDate(item.created_at)}</span>
                  <span>· by {item.created_by_name}</span>
                  {item.active_until && (
                    <span>· expires {formatDate(item.active_until)}</span>
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
