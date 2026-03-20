"use client";

import { useState } from "react";
import Link from "next/link";

type Booking = {
  id: string; reference: string; status: string;
  park_date_start: string; park_date_end: string;
  vehicle_count: number; vehicles: { vehicle_type: string; plate_number: string; make_model: string | null }[];
  customer_full_name: string; lot_snapshot_name: string | null;
  checked_in_at: string | null; checked_out_at: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  confirmed:  "bg-emerald-100 text-emerald-800",
  checked_in: "bg-blue-100 text-blue-800",
  completed:  "bg-gray-100 text-gray-600",
};
const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminParkingCheckinPage() {
  const [search, setSearch]   = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true); setMsg(null); setBooking(null);
    try {
      const res = await fetch(`/api/admin/parking/checkin-lookup?q=${encodeURIComponent(search.trim())}`);
      const d = await res.json();
      if (!res.ok || !d) { setMsg("No booking found for that reference or plate number."); return; }
      setBooking(d);
    } catch { setMsg("Network error."); }
    finally { setLoading(false); }
  }

  async function doAction(action: "check_in" | "check_out") {
    if (!booking) return;
    setActing(true); setMsg(null);
    try {
      const res = await fetch("/api/parking/crew/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id, action }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Action failed."); return; }
      setMsg(`✅ ${action === "check_in" ? "Vehicle checked in" : "Vehicle checked out"} successfully.`);
      // Refresh booking
      await handleSearch();
    } catch { setMsg("Network error."); }
    finally { setActing(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">🚘 Check In / Out</h1>
        <p className="mt-2 text-sm text-white/90">Search by reference number or plate number to check vehicles in or out.</p>
      </div>
      <div className="mb-4 flex gap-3">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back to Parking</Link>
      </div>

      {/* Search */}
      <div className="rounded-2xl border-2 border-blue-100 bg-white p-5 mb-5">
        <p className="text-sm font-black text-gray-700 mb-3">Search Booking</p>
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Reference (TRV-PRK-XXXXXX) or plate number"
            className="flex-1 rounded-xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none" />
          <button onClick={handleSearch} disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "…" : "Search"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-4 ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Booking result */}
      {booking && (
        <div className="rounded-2xl border-2 border-blue-100 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-lg font-black text-blue-700">{booking.reference}</p>
              <p className="font-semibold text-gray-800">{booking.customer_full_name}</p>
              <p className="text-sm text-gray-500">{booking.lot_snapshot_name}</p>
              <p className="text-sm text-gray-500">{formatDate(booking.park_date_start)} → {formatDate(booking.park_date_end)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
              {booking.status.replace("_", " ")}
            </span>
          </div>

          {/* Vehicles */}
          <div className="space-y-2">
            {booking.vehicles?.map((v, i) => (
              <div key={i} className="rounded-xl border border-blue-100 bg-blue-50/30 px-3 py-2 flex items-center gap-2">
                <span className="text-lg">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"}</span>
                <span className="font-mono font-bold text-gray-800">{v.plate_number}</span>
                {v.make_model && <span className="text-xs text-gray-400">{v.make_model}</span>}
              </div>
            ))}
          </div>

          {booking.checked_in_at && (
            <p className="text-xs text-gray-400">Checked in: {new Date(booking.checked_in_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
          )}
          {booking.checked_out_at && (
            <p className="text-xs text-gray-400">Checked out: {new Date(booking.checked_out_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {booking.status === "confirmed" && !booking.checked_in_at && (
              <button onClick={() => doAction("check_in")} disabled={acting}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {acting ? "Processing…" : "🚘 Check In"}
              </button>
            )}
            {booking.status === "checked_in" && (
              <button onClick={() => doAction("check_out")} disabled={acting}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {acting ? "Processing…" : "🏁 Check Out"}
              </button>
            )}
            {booking.status === "completed" && (
              <div className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 text-center">
                Booking completed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
