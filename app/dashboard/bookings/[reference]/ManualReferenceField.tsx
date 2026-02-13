"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function ManualReferenceField({
  reference,
  initialValue = "",
}: {
  reference: string;
  initialValue?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/booking/save-manual-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          gcash_transaction_reference: value.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      toast.showSuccess("Reference saved. We'll verify and confirm your booking soon.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-amber-900 mt-2">
        Or enter GCash transaction reference manually
      </label>
      <p className="text-xs text-amber-800 mt-0.5">
        If you can&apos;t upload a screenshot, type the reference/number from your GCash transaction here.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 123456789 or booking reference"
          className="min-w-[180px] flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-amber-500"
          maxLength={100}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save reference"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
