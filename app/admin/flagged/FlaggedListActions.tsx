"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function FlaggedListActions({ profileId }: { profileId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleLift() {
    if (!confirm("Lift all restrictions for this passenger? They will be able to book again.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/passenger-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, action: "lift" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.showSuccess(data.message ?? "Restrictions lifted.");
      router.refresh();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLift}
      disabled={loading}
      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
    >
      {loading ? "…" : "Lift"}
    </button>
  );
}
