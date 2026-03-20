import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });
}

const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };

export default async function AdminActiveSessionsPage() {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, vehicle_count, vehicles, customer_full_name, lot_snapshot_name, checked_in_at, overstay_days, overstay_fee_cents")
    .in("status", ["checked_in", "overstay"])
    .order("checked_in_at", { ascending: false });

  const { data: confirmed } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, vehicle_count, vehicles, customer_full_name, lot_snapshot_name")
    .eq("status", "confirmed")
    .order("park_date_start", { ascending: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">📋 Active Sessions</h1>
        <p className="mt-2 text-sm text-white/90">Vehicles currently parked and confirmed upcoming arrivals.</p>
      </div>
      <div className="mb-6 flex gap-3">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back to Parking</Link>
        <Link href="/admin/parking/checkin" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">🚘 Check In / Out</Link>
      </div>

      {/* Currently parked */}
      <div className="mb-8">
        <h2 className="text-base font-black text-gray-800 mb-3">
          🚘 Currently Parked
          <span className="ml-2 rounded-full bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5">{(sessions ?? []).length}</span>
        </h2>
        {(sessions ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-blue-100 bg-white p-8 text-center text-gray-400">No vehicles currently parked.</div>
        ) : (
          <div className="space-y-3">
            {(sessions ?? []).map(s => (
              <div key={s.id} className={`rounded-2xl border-2 bg-white p-4 ${s.status === "overstay" ? "border-red-200" : "border-blue-100"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-black text-blue-700">{s.reference}</span>
                      {s.status === "overstay" && <span className="rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5">⚠ Overstay {s.overstay_days}d</span>}
                      {s.status === "checked_in" && <span className="rounded-full bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5">🚘 Parked</span>}
                    </div>
                    <p className="font-semibold text-gray-800">{s.customer_full_name}</p>
                    <p className="text-xs text-gray-400">{s.lot_snapshot_name} · Due out: {formatDate(s.park_date_end)}</p>
                    {s.checked_in_at && <p className="text-xs text-gray-400">Checked in: {formatDateTime(s.checked_in_at)}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(s.vehicles as { vehicle_type: string; plate_number: string }[])?.map((v, i) => (
                        <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}</span>
                      ))}
                    </div>
                  </div>
                  <Link href={`/admin/parking/checkin`}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                    Check Out →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed / arriving */}
      <div>
        <h2 className="text-base font-black text-gray-800 mb-3">
          ✅ Confirmed — Awaiting Arrival
          <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5">{(confirmed ?? []).length}</span>
        </h2>
        {(confirmed ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-blue-100 bg-white p-8 text-center text-gray-400">No confirmed bookings awaiting arrival.</div>
        ) : (
          <div className="space-y-3">
            {(confirmed ?? []).map(s => (
              <div key={s.id} className="rounded-2xl border-2 border-emerald-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-mono text-sm font-black text-blue-700">{s.reference}</span>
                    <p className="font-semibold text-gray-800">{s.customer_full_name}</p>
                    <p className="text-xs text-gray-400">{s.lot_snapshot_name} · {formatDate(s.park_date_start)} → {formatDate(s.park_date_end)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(s.vehicles as { vehicle_type: string; plate_number: string }[])?.map((v, i) => (
                        <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}</span>
                      ))}
                    </div>
                  </div>
                  <Link href="/admin/parking/checkin"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors">
                    Check In →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
