import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function peso(cents: number) { return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`; }
function formatDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }); }
const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };

export default async function AdminParkingOverstayPage() {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // Find checked_in bookings past their end date
  const { data: overstay } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_end, vehicle_count, vehicles, customer_full_name, customer_email, lot_snapshot_name, total_amount_cents, rate_cents_per_vehicle_per_day, checked_in_at, overstay_days, overstay_fee_cents")
    .in("status", ["checked_in", "overstay"])
    .lt("park_date_end", today)
    .order("park_date_end", { ascending: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-800 px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">⚠️ Overstay</h1>
        <p className="mt-2 text-sm text-white/90">Vehicles that have exceeded their parking period.</p>
      </div>
      <div className="mb-6 flex gap-3">
        <Link href="/admin/parking" className="rounded-xl border-2 border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-50">← Back to Parking</Link>
      </div>

      {(overstay ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-green-100 bg-green-50 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-bold text-green-800">No overstay vehicles right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(overstay ?? []).map(b => {
            const daysOver = Math.ceil((new Date(today).getTime() - new Date(b.park_date_end).getTime()) / (1000 * 60 * 60 * 24));
            const overstayFee = daysOver * (b.rate_cents_per_vehicle_per_day ?? 25000) * (b.vehicle_count ?? 1);
            return (
              <div key={b.id} className="rounded-2xl border-2 border-red-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-black text-red-700">{b.reference}</span>
                      <span className="rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5">⚠ {daysOver} day{daysOver > 1 ? "s" : ""} overdue</span>
                    </div>
                    <p className="font-semibold text-gray-800">{b.customer_full_name}</p>
                    <p className="text-xs text-gray-500">{b.customer_email}</p>
                    <p className="text-xs text-gray-400 mt-1">{b.lot_snapshot_name} · Was due: {formatDate(b.park_date_end)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(b.vehicles as { vehicle_type: string; plate_number: string }[])?.map((v, i) => (
                        <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.plate_number}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-600 text-lg">{peso(overstayFee)}</p>
                    <p className="text-xs text-gray-400">estimated overstay fee</p>
                    <Link href="/admin/parking/checkin"
                      className="mt-2 inline-block rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors">
                      Check Out →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
