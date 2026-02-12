"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function ConfirmPaymentButton({ reference }: { reference: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to confirm.");
        return;
      }
      setDone(true);
      toast.showSuccess("Payment confirmed successfully");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="rounded-full bg-teal-100 px-3 py-1.5 text-sm font-semibold text-teal-800">
        Confirmed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={loading}
        className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation"
      >
        {loading ? "Confirming…" : "Confirm payment"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
