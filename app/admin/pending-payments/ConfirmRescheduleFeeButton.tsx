"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmRescheduleFeeButton({ changeId, reference }: { changeId: string; reference: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    if (!confirm(`Mark reschedule fee for ${reference} as PAID?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/confirm-reschedule-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_id: changeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone(true);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to confirm.");
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="text-xs font-bold text-green-700">✓ Confirmed</span>;

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={loading}
      className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
    >
      {loading ? "Confirming…" : "✓ Mark Fee as Paid"}
    </button>
  );
}
