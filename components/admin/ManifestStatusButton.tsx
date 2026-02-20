"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ManifestStatusButtonProps {
  reference: string;
  initialStatus: string;
}

const statusLabel: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  boarded: "Boarded",
  completed: "Completed",
};

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "boarded"
      ? "bg-teal-600 text-white"
      : status === "checked_in"
        ? "bg-amber-500 text-white"
        : status === "completed"
          ? "bg-gray-400 text-white"
          : "bg-gray-100 text-gray-700 border border-gray-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}

export function ManifestStatusButton({ reference, initialStatus }: ManifestStatusButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (action: "checked_in" | "boarded") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crew/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setStatus(data.status);
      // ✅ Tell Next.js to re-fetch server component data so manifest updates live
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-start">
      <StatusBadge status={status} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {(status === "confirmed" || status === "checked_in") && (
        <div className="flex gap-1 mt-0.5">
          {status === "confirmed" && (
            <button
              type="button"
              onClick={() => update("checked_in")}
              disabled={loading}
              className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 touch-manipulation"
            >
              {loading ? "…" : "Check in"}
            </button>
          )}
          <button
            type="button"
            onClick={() => update("boarded")}
            disabled={loading}
            className="rounded px-2 py-0.5 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 touch-manipulation"
          >
            {loading ? "…" : "Board"}
          </button>
        </div>
      )}
    </div>
  );
}
