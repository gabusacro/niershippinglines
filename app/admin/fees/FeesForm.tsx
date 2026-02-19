"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
type FeeSettings = { admin_fee_cents_per_passenger: number; gcash_fee_cents: number };

export function FeesForm({ initial }: { initial: FeeSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [adminFeeCents, setAdminFeeCents] = useState(initial.admin_fee_cents_per_passenger);
  const [gcashFeeCents, setGcashFeeCents] = useState(initial.gcash_fee_cents);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_fee_cents_per_passenger: adminFeeCents,
          gcash_fee_cents: gcashFeeCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.showSuccess("Fees updated. They apply to new bookings immediately.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="admin_fee" className="block text-sm font-medium text-[#134e4a]">
          Admin fee (per passenger) — ₱
        </label>
        <input
          id="admin_fee"
          type="number"
          min={0}
          step={1}
          value={adminFeeCents / 100}
          onChange={(e) => setAdminFeeCents(Math.round(parseFloat(e.target.value || "0") * 100))}
          className="mt-1 w-full max-w-[120px] rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]">
          Applied to every passenger (online and walk-in). Current: ₱{(adminFeeCents / 100).toLocaleString()} per passenger.
        </p>
      </div>
      <div>
        <label htmlFor="gcash_fee" className="block text-sm font-medium text-[#134e4a]">
          GCash fee (per online transaction) — ₱
        </label>
        <input
          id="gcash_fee"
          type="number"
          min={0}
          step={1}
          value={gcashFeeCents / 100}
          onChange={(e) => setGcashFeeCents(Math.round(parseFloat(e.target.value || "0") * 100))}
          className="mt-1 w-full max-w-[120px] rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]">
          Added once per online booking (GCash). Walk-in at the booth has no GCash fee. Current: ₱{(gcashFeeCents / 100).toLocaleString()} per transaction.
        </p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save fees"}
      </button>
    </form>
  );
}
