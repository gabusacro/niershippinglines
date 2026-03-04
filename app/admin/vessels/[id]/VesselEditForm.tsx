"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

interface VesselEditFormProps {
  boatId: string;
  initialName: string;
  initialCapacity: number;
  initialOnlineQuota: number;
  initialStatus: string;
  initialImageUrl?: string | null;
}

export default function VesselEditForm({
  boatId,
  initialName,
  initialCapacity,
  initialOnlineQuota,
  initialStatus,
  initialImageUrl,
}: VesselEditFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [onlineQuota, setOnlineQuota] = useState(initialOnlineQuota);
  const [status, setStatus] = useState(initialStatus);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/vessels/${boatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          capacity,
          online_quota: onlineQuota,
          status,
          image_url: imageUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save vessel.");
        return;
      }
      toast.showSuccess("Vessel details saved");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-teal-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-[#134e4a]">Vessel details</h2>

        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Vessel name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Passenger capacity</label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Online quota</label>
          <p className="text-xs text-[#0f766e] mb-1">Seats available for online booking. Walk-in quota = capacity minus this.</p>
          <input
            type="number"
            min={0}
            max={capacity}
            value={onlineQuota}
            onChange={(e) => setOnlineQuota(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
          <p className="mt-1 text-xs text-[#0f766e]">
            Walk-in quota: <strong>{Math.max(0, capacity - onlineQuota)}</strong>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="running">Running</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#134e4a]">Image URL (optional)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            placeholder="https://… (vessel photo)"
          />
          {imageUrl && (
            <>
              <p className="mt-1 text-xs text-[#0f766e]">Preview:</p>
              <img
                src={imageUrl}
                alt="Vessel preview"
                className="mt-0.5 h-16 w-24 rounded object-cover border border-teal-200"
              />
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation"
      >
        {saving ? "Saving…" : "Save vessel details"}
      </button>
    </form>
  );
}
