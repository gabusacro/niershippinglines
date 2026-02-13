"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function ResendProofButton({ reference }: { reference: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    if (!confirm("Clear payment proof and ask passenger to resend? They will see: 'Screenshot Error or No reference number. Kindly resend the photo or enter reference number manually.'")) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resend-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to resend.");
        return;
      }
      toast.showSuccess("Proof cleared. Passenger will see a message to resend.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleResend}
        disabled={loading}
        className="min-h-[44px] rounded-xl border-2 border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 touch-manipulation"
      >
        {loading ? "Sending…" : "Resend Proof"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
