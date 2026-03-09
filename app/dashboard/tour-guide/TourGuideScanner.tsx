"use client";

import { useState } from "react";

interface Props {
  guideId: string;
  todayPH: string;
}

export default function TourGuideScanner({ guideId, todayPH }: Props) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    booking?: {
      reference: string;
      customer_name: string;
      tour_title: string;
      total_pax: number;
    };
  } | null>(null);

  const [action, setAction] = useState<"picked_up" | "on_tour" | "dropped_off" | "no_show">("picked_up");

  async function handleScan() {
    if (!reference.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tour-guide/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim().toUpperCase(),
          guide_id: guideId,
          action,
          today: todayPH,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult({ success: true, message: data.message, booking: data.booking });
      setReference("");
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  const actionLabels = {
    picked_up:   "Mark as Picked Up",
    on_tour:     "Mark as On Tour",
    dropped_off: "Mark as Dropped Off",
    no_show:     "Mark as No Show",
  };

  const actionColors = {
    picked_up:   "bg-blue-600 hover:bg-blue-700",
    on_tour:     "bg-emerald-600 hover:bg-emerald-700",
    dropped_off: "bg-teal-600 hover:bg-teal-700",
    no_show:     "bg-red-500 hover:bg-red-600",
  };

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
      <h2 className="font-bold text-blue-900 mb-1">Scan / Enter Booking Reference</h2>
      <p className="text-xs text-blue-600 mb-4">
        Type or scan a booking reference to update the tourist&apos;s status.
      </p>

      {/* Action selector */}
      <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
        {(Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={
              "py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors " +
              (action === a
                ? "border-blue-500 bg-blue-100 text-blue-800"
                : "border-gray-200 bg-white text-gray-500 hover:border-blue-300")
            }>
            {a === "picked_up" ? "Picked Up" :
             a === "on_tour" ? "On Tour" :
             a === "dropped_off" ? "Dropped Off" : "No Show"}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="TRV-TOUR-XXXXXX"
          className="flex-1 rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-blue-500 bg-white"
        />
        <button
          onClick={handleScan}
          disabled={loading || !reference.trim()}
          className={"px-5 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors " + actionColors[action]}>
          {loading ? "..." : actionLabels[action].split(" ")[0]}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={
          "mt-4 rounded-xl px-4 py-3 " +
          (result.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")
        }>
          <p className={"text-sm font-bold " + (result.success ? "text-emerald-700" : "text-red-600")}>
            {result.success ? "✅ " : "❌ "}{result.message}
          </p>
          {result.booking && (
            <div className="mt-2 text-xs text-gray-600 space-y-0.5">
              <p><span className="font-semibold">Tour:</span> {result.booking.tour_title}</p>
              <p><span className="font-semibold">Guest:</span> {result.booking.customer_name}</p>
              <p><span className="font-semibold">Pax:</span> {result.booking.total_pax}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
