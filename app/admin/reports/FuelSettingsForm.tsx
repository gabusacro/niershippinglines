"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

interface FuelSettings {
  defaultFuelLitersPerTrip: number;
  fuelPesosPerLiter: number;
}

export function FuelSettingsForm() {
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState<FuelSettings | null>(null);
  const [defaultFuelLitersPerTrip, setDefaultFuelLitersPerTrip] = useState("");
  const [fuelPesosPerLiter, setFuelPesosPerLiter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: FuelSettings) => {
        setSettings(data);
        setDefaultFuelLitersPerTrip(String(data.defaultFuelLitersPerTrip ?? 100));
        setFuelPesosPerLiter(String(data.fuelPesosPerLiter ?? 61.4));
      })
      .catch(() => toast.showError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseInt(defaultFuelLitersPerTrip, 10);
    const price = parseFloat(fuelPesosPerLiter);
    if (Number.isNaN(liters) || liters < 0) {
      toast.showError("Default fuel (L) must be a non-negative number.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.showError("Fuel price (₱/L) must be a non-negative number.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultFuelLitersPerTrip: liters,
          fuelPesosPerLiter: price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.showSuccess("Fuel & revenue settings saved.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-[#0f766e]/80">Loading settings…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-medium text-[#134e4a]">Fuel & revenue settings</p>
      <p className="text-xs text-[#0f766e]/80">
        Default fuel is the roundtrip estimate (L) per trip when not set per vessel or trip. Fuel price (₱/L) is used for fuel cost and net revenue.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="default-fuel-liters" className="block text-xs font-medium text-[#134e4a]">
            Default fuel per trip (L, roundtrip estimate)
          </label>
          <input
            id="default-fuel-liters"
            type="number"
            min={0}
            step={1}
            value={defaultFuelLitersPerTrip}
            onChange={(e) => setDefaultFuelLitersPerTrip(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>
        <div>
          <label htmlFor="fuel-pesos-per-liter" className="block text-xs font-medium text-[#134e4a]">
            Fuel price (₱/L)
          </label>
          <input
            id="fuel-pesos-per-liter"
            type="number"
            min={0}
            step={0.01}
            value={fuelPesosPerLiter}
            onChange={(e) => setFuelPesosPerLiter(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
