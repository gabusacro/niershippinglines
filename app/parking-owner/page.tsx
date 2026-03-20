import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parking Owner Dashboard | Travela Siargao" };

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_BADGE: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed:       "bg-emerald-100 text-emerald-800",
  checked_in:      "bg-blue-100 text-blue-800",
  overstay:        "bg-red-100 text-red-800",
  completed:       "bg-gray-100 text-gray-600",
  cancelled:       "bg-gray-100 text-gray-400",
};

export default async function ParkingOwnerPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if ((user.role as string) !== "parking_owner") redirect("/dashboard");

  const supabase = await createClient();

  // Get owner's lots
  const { data: lots } = await supabase
    .from("parking_lots")
    .select("id, name, slug, distance_from_port, total_slots_car, total_slots_motorcycle, total_slots_van, is_active")
    .eq("owner_id", user.id)
    .eq("is_active", true);

  const lotIds = (lots ?? []).map(l => l.id);

  if (lotIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f6f0" }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🅿️</div>
          <h1 className="font-black text-[#134e4a] text-xl mb-2">No lots assigned</h1>
          <p className="text-sm text-[#0f766e]">Contact admin to have your parking lot assigned to your account.</p>
        </div>
      </div>
    );
  }

  // Get availability
  const { data: avail } = await supabase
    .from("parking_slot_availability")
    .select("lot_id, booked_car, booked_motorcycle, booked_van, total_slots_car, total_slots_motorcycle, total_slots_van")
    .in("lot_id", lotIds);

  const availMap = new Map((avail ?? []).map(a => [a.lot_id, a]));

  // Get recent bookings (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bookings } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, total_days, vehicle_count, parking_fee_cents, commission_cents, owner_receivable_cents, customer_full_name, vehicles, created_at, lot_id, lot_snapshot_name")
    .in("lot_id", lotIds)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  // Revenue — confirmed/checked_in/completed only
  const paidBookings = (bookings ?? []).filter(b => ["confirmed", "checked_in", "completed"].includes(b.status));
  const totalRevenue     = paidBookings.reduce((s, b) => s + (b.owner_receivable_cents ?? 0), 0);
  const totalCommission  = paidBookings.reduce((s, b) => s + (b.commission_cents ?? 0), 0);
  const totalParkingFee  = paidBookings.reduce((s, b) => s + (b.parking_fee_cents ?? 0), 0);
  const pendingCount     = (bookings ?? []).filter(b => b.status === "pending_payment").length;

  // Crew
  const { data: crew } = await supabase
    .from("parking_lot_crew")
    .select("id, lot_id, is_active, assigned_at, crew:profiles!crew_id(id, full_name, email, role)")
    .in("lot_id", lotIds)
    .eq("is_active", true);

  const welcomeName = user.fullName?.trim() || user.email;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Parking Owner</p>
          <h1 className="mt-1 text-2xl font-black text-white">🅿️ {welcomeName}</h1>
          <p className="text-sm text-white/70 mt-0.5">Your parking lot dashboard — revenue, bookings, and crew.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 transition-colors">Dashboard</Link>
            <Link href="/dashboard/parking-crew" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">Check-in View</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">

        {/* Revenue summary */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Revenue — Last 30 Days</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Your earnings",  value: peso(totalRevenue),    note: "After commission" },
              { label: "Gross parking",  value: peso(totalParkingFee), note: "Before commission" },
              { label: "Commission",     value: peso(totalCommission),  note: "Platform share" },
              { label: "Pending",        value: String(pendingCount),   note: "Awaiting approval" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border-2 border-teal-100 bg-white p-4">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className="text-xl font-black text-[#134e4a]">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lot capacity */}
        {(lots ?? []).map(lot => {
          const a = availMap.get(lot.id);
          const availCar  = (a?.total_slots_car        ?? 0) - (a?.booked_car        ?? 0);
          const availMoto = (a?.total_slots_motorcycle ?? 0) - (a?.booked_motorcycle  ?? 0);
          const availVan  = (a?.total_slots_van        ?? 0) - (a?.booked_van         ?? 0);
          const totalSlots = (lot.total_slots_car ?? 0) + (lot.total_slots_motorcycle ?? 0) + (lot.total_slots_van ?? 0);
          const totalAvail = availCar + availMoto + availVan;
          const pctFull    = totalSlots > 0 ? Math.round(((totalSlots - totalAvail) / totalSlots) * 100) : 0;
          return (
            <div key={lot.id}>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Live Capacity — {lot.name}</p>
              <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-black text-[#134e4a]">{lot.name}</p>
                    <p className="text-xs text-[#0f766e]">📍 {lot.distance_from_port}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${pctFull >= 90 ? "bg-red-100 text-red-700" : pctFull >= 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {pctFull}% full
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    { emoji: "🚗", label: "Cars",        avail: availCar,  total: lot.total_slots_car },
                    { emoji: "🏍️", label: "Motorcycles", avail: availMoto, total: lot.total_slots_motorcycle },
                    { emoji: "🚐", label: "Vans",        avail: availVan,  total: lot.total_slots_van },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                      <div className="text-2xl mb-1">{s.emoji}</div>
                      <p className="text-xs text-gray-400">{s.label}</p>
                      <p className={`font-black text-lg ${s.avail === 0 ? "text-red-600" : "text-[#0c7b93]"}`}>{s.avail}/{s.total}</p>
                      <p className="text-xs text-gray-400">available</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Overall occupancy</span>
                    <span>{totalSlots - totalAvail} of {totalSlots} confirmed</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-3 rounded-full ${pctFull >= 80 ? "bg-red-400" : pctFull >= 50 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pctFull}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Crew */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Your Crew</p>
          {(crew ?? []).length === 0 ? (
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-6 text-center">
              <p className="text-sm text-[#0f766e]">No crew assigned yet. Contact admin to assign crew to your lot.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(crew ?? []).map(c => {
                const crewMember = Array.isArray(c.crew) ? c.crew[0] : c.crew as { id: string; full_name: string; email: string } | null;
                const lotName = lots?.find(l => l.id === c.lot_id)?.name ?? "—";
                return (
                  <div key={c.id} className="rounded-2xl border-2 border-teal-100 bg-white p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-[#0c7b93] font-black text-sm shrink-0">
                      {crewMember?.full_name?.charAt(0) ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#134e4a] text-sm truncate">{crewMember?.full_name ?? "—"}</p>
                      <p className="text-xs text-gray-400 truncate">{crewMember?.email ?? "—"}</p>
                      <p className="text-xs text-[#0f766e] mt-0.5">📍 {lotName}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5">Active</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Recent Bookings — Last 30 Days</p>
          {(bookings ?? []).length === 0 ? (
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-8 text-center">
              <p className="text-sm text-[#0f766e]">No bookings in the last 30 days.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(bookings ?? []).slice(0, 20).map(b => {
                const vehicles = (b.vehicles ?? []) as { vehicle_type: string; plate_number: string }[];
                return (
                  <div key={b.id} className="rounded-2xl border-2 border-teal-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-black text-[#0c7b93]">{b.reference}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>{b.status.replace("_", " ")}</span>
                        </div>
                        <p className="text-sm text-[#134e4a] font-semibold">{b.customer_full_name}</p>
                        <p className="text-xs text-gray-400">{formatDate(b.park_date_start)} → {formatDate(b.park_date_end)} · {b.vehicle_count} vehicle{b.vehicle_count > 1 ? "s" : ""}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vehicles.map((v, i) => (
                            <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {v.vehicle_type === "car" ? "🚗" : v.vehicle_type === "motorcycle" ? "🏍️" : "🚐"} {v.plate_number}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#0c7b93]">{peso(b.owner_receivable_cents ?? 0)}</p>
                        <p className="text-xs text-gray-400">your earnings</p>
                        <p className="text-xs text-gray-300 mt-0.5">comm: {peso(b.commission_cents ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
