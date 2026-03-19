import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import CancelBookingButton from "./CancelBookingButton";

export const dynamic = "force-dynamic";

type Vehicle = {
  vehicle_type: string; plate_number: string;
  make_model: string | null; color: string | null;
  or_cr_number: string; driver_id_type: string; driver_id_number: string;
  or_cr_path: string | null; id_photo_path: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending_payment: { label: "Pending Approval",  color: "bg-amber-100 text-amber-800 border-amber-200",       icon: "⏳" },
  confirmed:       { label: "Confirmed",          color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "✅" },
  checked_in:      { label: "Checked In",         color: "bg-blue-100 text-blue-800 border-blue-200",         icon: "🚘" },
  completed:       { label: "Completed",           color: "bg-gray-100 text-gray-600 border-gray-200",         icon: "🏁" },
  overstay:        { label: "Overstay",            color: "bg-red-100 text-red-700 border-red-200",            icon: "⚠️" },
  cancelled:       { label: "Cancelled",           color: "bg-gray-100 text-gray-400 border-gray-200",         icon: "✕"  },
};

const VEHICLE_EMOJI: Record<string, string> = { car: "🚗", motorcycle: "🏍️", van: "🚐" };
const TYPE_BADGE: Record<string, string> = {
  car:        "bg-emerald-50 text-emerald-800 border border-emerald-200",
  motorcycle: "bg-amber-50 text-amber-800 border border-amber-200",
  van:        "bg-blue-50 text-blue-800 border border-blue-200",
};
const TYPE_ACCENT: Record<string, string> = {
  car: "bg-emerald-400", motorcycle: "bg-amber-400", van: "bg-blue-400",
};
const CARD_BG = ["bg-teal-50 border-teal-200", "bg-gray-50 border-gray-200"];

const ID_LABELS: Record<string, string> = {
  driver_license: "Driver's License", umid: "UMID", passport: "Passport",
  philsys: "PhilSys / National ID", prc: "PRC ID", voter_id: "Voter's ID", other: "Government ID",
};

function peso(cents: number) { return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`; }
function formatDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
function formatDateTime(d: string) { return new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" }); }

export default async function ParkingBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("parking_reservations")
    .select(`id, reference, status, payment_status, payment_proof_path, gcash_transaction_reference, park_date_start, park_date_end, total_days, vehicle_count, vehicles, parking_fee_cents, platform_fee_cents, processing_fee_cents, total_amount_cents, lot_snapshot_name, lot_snapshot_address, lot_snapshot_distance, rate_snapshot_label, overstay_days, overstay_fee_cents, overstay_payment_status, admin_notes, checked_in_at, checked_out_at, created_at`)
    .eq("id", id)
    .eq("customer_profile_id", user.id)
    .maybeSingle();

  if (!booking) notFound();

  const meta     = STATUS_META[booking.status] ?? { label: booking.status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: "•" };
  const vehicles = (booking.vehicles ?? []) as Vehicle[];
  const canCancel = booking.status === "pending_payment";
  const canExtend = ["confirmed", "checked_in"].includes(booking.status);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Parking Booking</p>
          <div className="flex items-start justify-between gap-3 mt-1">
            <div>
              <h1 className="text-2xl font-black text-white font-mono">{booking.reference}</h1>
              <p className="text-sm text-white/70 mt-0.5">{booking.lot_snapshot_name ?? "Parking Lot"}</p>
              {booking.lot_snapshot_distance && <p className="text-xs text-white/50">📍 {booking.lot_snapshot_distance}</p>}
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${meta.color}`}>{meta.icon} {meta.label}</span>
          </div>
          <div className="mt-4"><Link href="/dashboard/parking" className="text-xs text-white/60 hover:text-white/90 transition-colors">← My Parking Bookings</Link></div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-5">

        {/* Status banners */}
        {booking.status === "pending_payment" && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
            <h3 className="font-bold text-amber-800 mb-1">⏳ Waiting for Admin Approval</h3>
            <p className="text-sm text-amber-700">Your documents and GCash payment have been submitted. Admin will verify and confirm your slot. Your slot is <strong>not yet locked</strong>.</p>
          </div>
        )}
        {booking.status === "confirmed" && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-bold text-emerald-800 mb-2">✅ Booking Confirmed — Slot Locked!</h3>
            <p className="text-sm text-emerald-700 mb-3">Your slot is reserved. Bring these on arrival:</p>
            <ul className="text-xs text-emerald-800 space-y-1">
              <li>• Original valid government-issued ID</li>
              <li>• Original OR/CR for each vehicle</li>
              <li>• Reference: <strong className="font-mono">{booking.reference}</strong></li>
            </ul>
          </div>
        )}
        {booking.status === "overstay" && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
            <h3 className="font-bold text-red-800 mb-1">⚠️ Overstay Detected</h3>
            <p className="text-sm text-red-700">Overstay: <strong>{booking.overstay_days} day{booking.overstay_days > 1 ? "s" : ""}</strong> — additional fee: <strong>{peso(booking.overstay_fee_cents)}</strong>. Settle at the lot before exit.</p>
          </div>
        )}
        {booking.admin_notes && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold text-blue-700 uppercase mb-1">Note from Admin</p>
            <p className="text-sm text-blue-800">{booking.admin_notes}</p>
          </div>
        )}

        {/* Parking period */}
        <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
          <h2 className="text-sm font-black text-[#134e4a] mb-4">📅 Parking Period</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-gray-400 mb-1">Check-in</p><p className="font-semibold text-[#134e4a]">{formatDate(booking.park_date_start)}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Check-out</p><p className="font-semibold text-[#134e4a]">{formatDate(booking.park_date_end)}</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Duration</p><p className="font-semibold text-[#134e4a]">{booking.total_days} day{booking.total_days > 1 ? "s" : ""}</p></div>
          </div>
          {booking.checked_in_at && (
            <div className="mt-3 pt-3 border-t border-teal-100 grid grid-cols-2 gap-4 text-xs text-gray-500">
              <div><p className="text-gray-400 mb-0.5">Actual check-in</p><p>{formatDateTime(booking.checked_in_at)}</p></div>
              {booking.checked_out_at && <div><p className="text-gray-400 mb-0.5">Actual check-out</p><p>{formatDateTime(booking.checked_out_at)}</p></div>}
            </div>
          )}
        </div>

        {/* Vehicles — with alternating cards and accent bars */}
        <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-teal-50 border-b border-teal-100">
            <h2 className="text-sm font-black text-[#134e4a]">🚗 Vehicles ({booking.vehicle_count})</h2>
          </div>
          <div className="divide-y divide-teal-50">
            {vehicles.map((v, i) => (
              <div key={i} className={`px-5 py-4 ${i % 2 === 0 ? "bg-white" : "bg-teal-50/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-1 h-5 rounded-full shrink-0 ${TYPE_ACCENT[v.vehicle_type] ?? "bg-gray-300"}`} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_BADGE[v.vehicle_type] ?? ""}`}>{VEHICLE_EMOJI[v.vehicle_type] ?? "🚗"} {v.vehicle_type}</span>
                  <span className="font-bold text-[#134e4a] font-mono">{v.plate_number}</span>
                  {v.make_model && <span className="text-xs text-gray-400">{v.make_model}</span>}
                  {v.color && <span className="text-xs text-gray-400">· {v.color}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 ml-3">
                  <div><span className="text-gray-400">OR/CR: </span>{v.or_cr_number}</div>
                  <div><span className="text-gray-400">ID: </span>{ID_LABELS[v.driver_id_type] ?? v.driver_id_type} · {v.driver_id_number}</div>
                </div>
                <div className="flex gap-3 mt-1 ml-3">
                  {v.or_cr_path    && <span className="text-xs text-emerald-600">✓ OR/CR photo uploaded</span>}
                  {v.id_photo_path && <span className="text-xs text-emerald-600">✓ ID photo uploaded</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border-2 border-teal-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-teal-50 border-b border-teal-100">
            <h2 className="text-sm font-black text-[#134e4a]">💸 Payment</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Parking fee ({booking.vehicle_count} vehicle{booking.vehicle_count > 1 ? "s" : ""} × {booking.total_days} day{booking.total_days > 1 ? "s" : ""})</span><span className="font-semibold">{peso(booking.parking_fee_cents)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Platform Service Fee</span><span>{peso(booking.platform_fee_cents)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Payment Processing Fee</span><span>{peso(booking.processing_fee_cents)}</span></div>
            {booking.overstay_fee_cents > 0 && <div className="flex justify-between text-xs text-red-600"><span>Overstay Fee ({booking.overstay_days} day{booking.overstay_days > 1 ? "s" : ""})</span><span>{peso(booking.overstay_fee_cents)}</span></div>}
            <div className="flex justify-between pt-2 border-t-2 border-teal-200"><span className="font-black text-[#134e4a]">Total Paid</span><span className="font-black text-xl text-[#0c7b93]">{peso(booking.total_amount_cents)}</span></div>
          </div>
          <div className="px-5 pb-4">
            {booking.payment_status === "paid"
              ? <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800 font-semibold">✅ Payment confirmed by admin</div>
              : booking.payment_proof_path
              ? <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">📎 GCash screenshot submitted — awaiting admin verification{booking.gcash_transaction_reference && <p className="text-xs text-blue-600 mt-1">Ref: {booking.gcash_transaction_reference}</p>}</div>
              : <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">⏳ No payment proof on record</div>}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-3 pb-6">
          <Link href="/dashboard/parking" className="rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">← All Bookings</Link>
          {canExtend && (
            <Link href={`/dashboard/parking/${booking.id}/extend`}
              className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
              📅 Extend Stay
            </Link>
          )}
          <Link href="/parking" className="rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">+ New Booking</Link>
          {canCancel && <CancelBookingButton bookingId={booking.id} />}
        </div>
      </div>
    </div>
  );
}
