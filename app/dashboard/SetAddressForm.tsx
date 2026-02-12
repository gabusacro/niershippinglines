"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function SetAddressForm({
  initialAddress = "",
}: {
  initialAddress?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.showSuccess("Address saved. It will appear on your tickets and the manifest.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <label htmlFor="address" className="sr-only">Your address</label>
      <input
        id="address"
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
        className="w-full max-w-md rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
      />
      <button
        type="submit"
        disabled={saving}
        className="mt-2 rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}
