"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

const FARE_TYPE_OPTIONS = [
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
  { value: "pwd", label: "PWD" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant (<7)" },
] as const;

type FareType = (typeof FARE_TYPE_OPTIONS)[number]["value"];

interface PassengerRow {
  full_name: string;
  fare_type: FareType;
  contact: string;
}

interface WalkInNamesFormProps {
  tripId: string;
  /** Remaining walk-in capacity (capacity - online_booked - walk_in_booked). */
  maxSeats: number;
  canEdit: boolean;
}

export function WalkInNamesForm({ tripId, maxSeats, canEdit }: WalkInNamesFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [passengers, setPassengers] = useState<PassengerRow[]>([{ full_name: "", fare_type: "adult", contact: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const validPassengers = passengers
    .map((p) => ({ ...p, full_name: p.full_name.trim(), contact: p.contact.trim() }))
    .filter((p) => p.full_name.length > 0);
  const count = validPassengers.length;
  const isValid = count > 0 && count <= maxSeats;

  function addRow() {
    if (passengers.length >= maxSeats) return;
    setPassengers((prev) => [...prev, { full_name: "", fare_type: "adult", contact: "" }]);
  }

  function removeRow(i: number) {
    setPassengers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: keyof PassengerRow, value: string) {
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/walk-in-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengers: validPassengers.map((p) => ({
            full_name: p.full_name,
            fare_type: p.fare_type,
            contact: p.contact || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      toast.showSuccess(`${data.count ?? count} passenger(s) added with names. They will appear on the manifest.`);
      setPassengers([{ full_name: "", fare_type: "adult", contact: "" }]);
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-white p-4 space-y-4">
      <p className="font-medium text-[#134e4a]">Record walk-in passenger names</p>
      <p className="text-xs text-[#0f766e]">
        Enter each passenger with name, fare type, and optional contact number per row. Each row creates a walk-in booking with a system-generated reference and appears on the manifest (including contact if provided). You can add up to <strong>{maxSeats}</strong> passengers.
      </p>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-[#134e4a]">Passengers (name, type, contact optional)</span>
          <button
            type="button"
            onClick={addRow}
            disabled={passengers.length >= maxSeats}
            className="text-sm font-semibold text-[#0c7b93] hover:underline disabled:opacity-50"
          >
            + Add row
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {passengers.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={p.full_name}
                onChange={(e) => updateRow(i, "full_name", e.target.value)}
                placeholder="Full name"
                className="flex-1 min-w-[120px] rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <select
                value={p.fare_type}
                onChange={(e) => updateRow(i, "fare_type", e.target.value as FareType)}
                className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              >
                {FARE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="tel"
                value={p.contact}
                onChange={(e) => updateRow(i, "contact", e.target.value)}
                placeholder="Contact (optional)"
                className="w-32 rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={passengers.length <= 1}
                className="rounded-lg border border-red-200 px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !isValid}
          className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {submitting ? "Adding…" : `Add ${count || "these"} passenger(s) with names`}
        </button>
        {count > maxSeats && (
          <span className="text-xs text-amber-700">
            Too many passengers ({count}). Max {maxSeats}.
          </span>
        )}
      </div>
    </form>
  );
}
