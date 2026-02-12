"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function SetDisplayNameForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [salutation, setSalutation] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const body: { full_name: string; salutation?: string | null } = { full_name: trimmed };
      if (salutation) body.salutation = salutation;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      const display = salutation ? `${salutation}. ${trimmed}` : trimmed;
      toast.showSuccess("Name saved. Welcome, " + display + "!");
      router.refresh();
      window.location.href = "/dashboard";
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 inline-flex flex-wrap items-center gap-2">
      <label htmlFor="salutation-set" className="sr-only">Salutation</label>
      <select
        id="salutation-set"
        value={salutation}
        onChange={(e) => setSalutation(e.target.value)}
        className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
      >
        <option value="">—</option>
        <option value="Mr">Mr.</option>
        <option value="Mrs">Mrs.</option>
        <option value="Ms">Ms.</option>
      </select>
      <label htmlFor="displayName" className="sr-only">Your name</label>
      <input
        id="displayName"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name (e.g. Gabriel Sacro)"
        className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93] w-48"
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}
