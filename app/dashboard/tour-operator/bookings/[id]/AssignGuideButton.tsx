"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Guide {
  id: string;
  tour_guide_id: string;
  guide: { full_name: string } | null;
}

interface Props {
  bookingId: string;
  guides: Guide[];
  currentGuideId: string | null;
  currentGuideName: string | null;
}

export default function AssignGuideButton({ bookingId, guides, currentGuideId, currentGuideName }: Props) {
  const router = useRouter();
  const [selectedGuideId, setSelectedGuideId] = useState(currentGuideId ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleAssign() {
    if (!selectedGuideId) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/tour-operator/assign-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, tour_guide_id: selectedGuideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg({ ok: true, text: "Guide assigned successfully!" });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-blue-100 bg-white p-6 mb-4">
      <h2 className="font-bold text-[#134e4a] mb-1">🧭 Assign Tour Guide</h2>
      <p className="text-xs text-gray-400 mb-4">Assign a guide to handle this booking's guests.</p>

      {currentGuideName && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm">
          <span className="text-gray-500">Currently assigned: </span>
          <span className="font-bold text-emerald-700">{currentGuideName}</span>
        </div>
      )}

      {guides.length === 0 ? (
        <p className="text-sm text-gray-400">No guides assigned to you yet. Contact admin.</p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedGuideId}
            onChange={(e) => setSelectedGuideId(e.target.value)}
            className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
            <option value="">— Select a guide —</option>
            {guides.map((g) => (
              <option key={g.tour_guide_id} value={g.tour_guide_id}>
                {g.guide?.full_name ?? "—"}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedGuideId}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Assign"}
          </button>
        </div>
      )}

      {msg && (
        <p className={"mt-3 text-sm font-semibold " + (msg.ok ? "text-emerald-600" : "text-red-600")}>
          {msg.ok ? "✅ " : "❌ "}{msg.text}
        </p>
      )}
    </section>
  );
}
