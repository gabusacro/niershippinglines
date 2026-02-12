"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function AddVesselForm() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(150);
  const [onlineQuota, setOnlineQuota] = useState(100);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          capacity,
          online_quota: onlineQuota,
          image_url: imageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add vessel");
      setName("");
      setCapacity(150);
      setOnlineQuota(100);
      setImageUrl("");
      setOpen(false);
      toast.showSuccess("Vessel added successfully");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 touch-manipulation"
      >
        + Add vessel
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-teal-200 bg-teal-50/50 p-5">
      <h3 className="text-sm font-semibold text-[#134e4a]">Add new vessel</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-[#0f766e]">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-0.5 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
            placeholder="e.g. Vince Gabriel 1"
          />
        </div>
        <div>
          <label className="block text-xs text-[#0f766e]">Capacity</label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 150)}
            className="mt-0.5 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#0f766e]">Online quota</label>
          <input
            type="number"
            min={0}
            value={onlineQuota}
            onChange={(e) => setOnlineQuota(parseInt(e.target.value, 10) || 0)}
            className="mt-0.5 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs text-[#0f766e]">Image URL (optional)</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm"
          placeholder="https://… (vessel photo for schedule & ticket)"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add vessel"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="min-h-[44px] rounded-xl border-2 border-teal-200 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
