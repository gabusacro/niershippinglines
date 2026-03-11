"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Operator {
  id: string;
  full_name: string;
  email: string | null;
}

interface Props {
  bookingId: string;
  currentOperatorId: string | null;
  currentOperatorName: string | null;
  operators: Operator[];
}

export default function AssignOperatorButton({ bookingId, currentOperatorId, currentOperatorName, operators }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(currentOperatorId ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleAssign() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/tours/bookings/assign-operator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, tour_operator_id: selectedId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg({ ok: true, text: "Operator assigned successfully!" });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-blue-100 bg-white p-6 mb-4">
      <h2 className="font-bold text-[#134e4a] mb-1">🧑‍💼 Assign Tour Operator</h2>
      <p className="text-xs text-gray-400 mb-4">
        Assign this booking to an operator. They will see it in their dashboard and can dispatch guides.
      </p>

      {currentOperatorName && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm">
          <span className="text-gray-500">Currently assigned: </span>
          <span className="font-bold text-emerald-700">{currentOperatorName}</span>
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
          <option value="">— No operator —</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>{op.full_name}</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Assign"}
        </button>
      </div>

      {msg && (
        <p className={"mt-3 text-sm font-semibold " + (msg.ok ? "text-emerald-600" : "text-red-600")}>
          {msg.ok ? "✅ " : "❌ "}{msg.text}
        </p>
      )}
    </section>
  );
}