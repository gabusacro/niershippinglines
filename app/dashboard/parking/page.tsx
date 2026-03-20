import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Parking Bookings | Travela Siargao" };
export const dynamic = "force-dynamic";

type Booking = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  park_date_start: string;
  park_date_end: string;
  total_days: number;
  vehicle_count: number;
  total_amount_cents: number;
  lot_snapshot_name: string | null;
  lot_snapshot_distance: string | null;
  vehicles: { plate_number: string; vehicle_type: string }[];
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Pending Approval",  color: "bg-amber-100 text-amber-800 border-amber-200"       },
  confirmed:       { label: "Confirmed",          color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  checked_in:      { label: "Checked In",         color: "bg-blue-100 text-blue-800 border-blue-200"         },
  completed:       { label: "Completed",           color: "bg-gray-100 text-gray-600 border-gray-200"         },
  overstay:        { label: "Overstay",            color: "bg-red-100 text-red-700 border-red-200"            },
  cancelled:       { label: "Cancelled",           color: "bg-gray-100 text-gray-400 border-gray-200"         },
};

const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default async function MyParkingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, payment_status, park_date_start, park_date_end, total_days, vehicle_count, total_amount_cents, lot_snapshot_name, lot_snapshot_distance, vehicles, created_at")
    .eq("customer_profile_id", user.id)
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as Booking[];
  const active   = bookings.filter(b => ["pending_payment","confirmed","checked_in","overstay"].includes(b.status));
  const past     = bookings.filter(b => ["completed","cancelled"].includes(b.status));

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Dashboard</p>
          <h1 className="mt-1 text-2xl font-black text-white">🚗 My Parking Bookings</h1>
          <p className="mt-1 text-sm text-white/70">Track your parking bookings and approval status.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/parking" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 transition-colors">
              + New Booking
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
        {bookings.length === 0 && (
          <div className="rounded-2xl border-2 border-teal-100 bg-white p-12 text-center">
            <div className="text-5xl mb-4">🚗</div>
            <p className="font-bold text-[#134e4a] text-lg">No parking bookings yet</p>
            <p className="text-sm text-[#0f766e] mt-1 mb-6">Reserve a slot near Dapa Port. Submit documents and GCash — admin approves your slot.</p>
            <Link href="/parking" className="inline-block rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
              Book Parking →
            </Link>
          </div>
        )}

        {active.length > 0 && (
          <section>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Active Bookings</p>
            <div className="space-y-3">
              {active.map(b => <BookingCard key={b.id} b={b} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6B8886]">Past Bookings</p>
            <div className="space-y-3 opacity-70">
              {past.map(b => <BookingCard key={b.id} b={b} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function BookingCard({ b }: { b: Booking }) {
  const meta   = STATUS_META[b.status] ?? { label: b.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  const plates = Array.isArray(b.vehicles)
    ? b.vehicles.map(v => `${VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} ${v.plate_number}`).join(" · ")
    : "—";

  return (
    <Link href={`/dashboard/parking/${b.id}`}
      className="block rounded-2xl border-2 border-teal-100 bg-white p-5 hover:border-[#0c7b93] hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</p>
          <p className="text-sm font-semibold text-[#134e4a] mt-0.5">{b.lot_snapshot_name ?? "—"}</p>
          {b.lot_snapshot_distance && <p className="text-xs text-[#0f766e]">📍 {b.lot_snapshot_distance}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.color}`}>
          {meta.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div><p className="text-gray-400 mb-0.5">Check-in</p><p className="font-semibold text-[#134e4a]">{formatDate(b.park_date_start)}</p></div>
        <div><p className="text-gray-400 mb-0.5">Check-out</p><p className="font-semibold text-[#134e4a]">{formatDate(b.park_date_end)}</p></div>
        <div><p className="text-gray-400 mb-0.5">Duration</p><p className="font-semibold text-[#134e4a]">{b.total_days} day{b.total_days > 1 ? "s" : ""}</p></div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 truncate max-w-[60%]">{plates}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-[#0c7b93]">{peso(b.total_amount_cents)}</span>
          <span className="text-xs text-[#0c7b93] group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
      {b.status === "pending_payment" && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-semibold">
          ⏳ Submitted — waiting for admin to verify documents and payment
        </div>
      )}
    </Link>
  );
}

