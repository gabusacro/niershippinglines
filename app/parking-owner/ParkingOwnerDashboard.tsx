"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// ── Dynamic import fixes the Next.js SSR crash for ParkingQRScanner ──────────
const ParkingQRScanner = dynamic(
  () => import("@/components/parking/ParkingQRScanner"),
  { ssr: false }
);

type Lot = {
  id: string; name: string; address: string; distance_from_port: string | null;
  total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number;
  car_rate_cents: number | null; motorcycle_rate_cents: number | null; van_rate_cents: number | null;
  is_active: boolean; is_24hrs: boolean;
} | null;

type CrewMember = { id: string; crew_id: string; full_name: string; email: string; avatar_url: string | null };
type Avail = { booked_car: number; booked_motorcycle: number; booked_van: number };
type Booking = {
  id: string; reference: string; status: string;
  park_date_start: string; park_date_end: string; total_days: number;
  vehicle_count: number; vehicles: { vehicle_type: string; plate_number: string }[];
  customer_full_name: string;
  parking_fee_cents: number; commission_cents: number;
  checked_in_at: string | null; checked_out_at: string | null; checked_in_by_name: string | null;
};
type PendingExtension = {
  id: string; reference: string; reservation_id: string;
  reservation_reference: string; customer_full_name: string;
  additional_days: number; new_end_date: string;
  total_amount_cents: number; payment_status: string; created_at: string;
};

interface Props {
  ownerId: string; ownerName: string; ownerEmail: string; avatarUrl: string | null;
  lot: Lot; crew: CrewMember[]; availability: Avail;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmt(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
function getRange(period: string) {
  const today = getTodayManila();
  if (period === "today") return { start: today, end: today };
  if (period === "week") {
    const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - d.getDay());
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] };
  }
  const d = new Date();
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0],
    end:   new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}

const STATUS_BADGE: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed:       "bg-emerald-100 text-emerald-800",
  checked_in:      "bg-blue-100 text-blue-800",
  overstay:        "bg-red-100 text-red-800",
  completed:       "bg-gray-100 text-gray-600",
};

export default function ParkingOwnerDashboard({ ownerId, ownerName, ownerEmail, avatarUrl, lot, crew, availability }: Props) {
  const [period, setPeriod]                       = useState<"today"|"week"|"month">("today");
  const [bookings, setBookings]                   = useState<Booking[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState<PendingExtension[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [showScanner, setShowScanner]             = useState(false);
  const [scanMsg, setScanMsg]                     = useState<string | null>(null);
  const [tab, setTab]                             = useState<"bookings"|"crew"|"revenue">("bookings");
  const [extLoading, setExtLoading]               = useState<string | null>(null); // extension_id being processed
  const [selected, setSelected] = useState<Booking | null>(null);

  const totalCar   = lot?.total_slots_car        ?? 0;
  const totalMoto  = lot?.total_slots_motorcycle ?? 0;
  const totalVan   = lot?.total_slots_van        ?? 0;
  const availCar   = totalCar  - (availability.booked_car        ?? 0);
  const availMoto  = totalMoto - (availability.booked_motorcycle ?? 0);
  const availVan   = totalVan  - (availability.booked_van        ?? 0);
  const totalSlots = totalCar + totalMoto + totalVan;
  const occupied   = (availability.booked_car ?? 0) + (availability.booked_motorcycle ?? 0) + (availability.booked_van ?? 0);
  const pctFull    = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;

  const fetchBookings = useCallback(async () => {
    if (!lot) return;
    setLoading(true);
    try {
      const { start, end } = getRange(period);
      const res = await fetch(`/api/parking/owner/bookings?lot_id=${lot.id}&start=${start}&end=${end}`);
      if (res.ok) {
        const d = await res.json();
        setBookings(d.bookings ?? []);
        setPendingExtensions(d.pendingExtensions ?? []);
      }
    } finally { setLoading(false); }
  }, [lot, period]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleExtensionAction(extensionId: string, action: "approve" | "reject") {
    setExtLoading(extensionId);
    try {
      const res = await fetch("/api/parking/owner/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension_id: extensionId, action }),
      });
      if (res.ok) {
        // Remove from list immediately
        setPendingExtensions(prev => prev.filter(e => e.id !== extensionId));
        await fetchBookings();
      }
    } finally { setExtLoading(null); }
  }

  async function handleQRScan(ref: string) {
    setShowScanner(false);
    setScanMsg(`🔍 Looking up ${ref}…`);
    try {
      const res = await fetch(`/api/parking/lookup?q=${encodeURIComponent(ref)}`);
      const d = await res.json();
      if (d?.id) {
  setSelected(d); // 🔥 THIS makes it open details
  setScanMsg(null);
} else {
        setScanMsg(`❌ No booking found for: ${ref}`);
      }
    } catch { setScanMsg("❌ Network error."); }
    setTimeout(() => setScanMsg(null), 5000);
  }

  const totalRevenue    = bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).reduce((s, b) => s + (b.parking_fee_cents ?? 0), 0);
  const totalCommission = bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).reduce((s, b) => s + (b.commission_cents ?? 0), 0);
  const netRevenue      = totalRevenue - totalCommission;
  const checkedIn       = bookings.filter(b => b.status === "checked_in").length;
  const pending         = bookings.filter(b => b.status === "pending_payment").length;

  const tabCls = (t: string) => `rounded-xl px-4 py-2 text-xs font-bold border transition-all ${tab === t ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 100%)" }}>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={ownerName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-black text-white border-2 border-white/20">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Parking Owner</p>
              <h1 className="mt-0.5 text-2xl font-black text-white leading-tight">{ownerName}</h1>
              <p className="text-sm text-white/60 mt-0.5">{ownerEmail}</p>
              {lot && <p className="mt-1 text-sm font-semibold text-white/80">🅿️ {lot.name}</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setShowScanner(true)}
              className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors">
              📷 Scan QR
            </button>
            <Link href="/account"
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">
              👤 My Account
            </Link>
            <Link href="/dashboard/parking-crew"
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">
              🚘 Check-in View
            </Link>
          </div>
          {scanMsg && (
            <div className="mt-3 rounded-xl bg-white/15 px-4 py-2.5 text-sm text-white font-semibold">
              {scanMsg}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">

        {!lot ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="font-black text-amber-900 text-lg">No lot assigned yet</h2>
            <p className="text-sm text-amber-700 mt-2">Ask your admin to assign a parking lot to your account.</p>
          </div>
        ) : (
          <>
            {/* ── PENDING EXTENSIONS ────────────────────────────────────────── */}
            {pendingExtensions.length > 0 && (
              <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 overflow-hidden">
                <div className="px-5 py-3 bg-purple-100 border-b border-purple-200">
                  <h2 className="text-sm font-black text-purple-900">
                    📅 Pending Extend Stay Payments ({pendingExtensions.length})
                  </h2>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Verify GCash payment then approve or reject each extension.
                  </p>
                </div>
                <div className="divide-y divide-purple-100">
                  {pendingExtensions.map((ext) => (
                    <div key={ext.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-mono text-xs font-black text-purple-700">{ext.reference}</p>
                          <p className="text-xs text-purple-600">for booking {ext.reservation_reference}</p>
                          <p className="text-sm font-semibold text-[#134e4a] mt-0.5">{ext.customer_full_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            +{ext.additional_days} day{ext.additional_days > 1 ? "s" : ""} · New end: {fmt(ext.new_end_date)} · {peso(ext.total_amount_cents)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleExtensionAction(ext.id, "reject")}
                            disabled={extLoading === ext.id}
                            className="rounded-xl border-2 border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                            {extLoading === ext.id ? "…" : "Reject"}
                          </button>
                          <button
                            onClick={() => handleExtensionAction(ext.id, "approve")}
                            disabled={extLoading === ext.id}
                            className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                            {extLoading === ext.id ? "…" : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live capacity */}
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-[#134e4a]">Live Capacity — {lot.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${pctFull >= 90 ? "bg-red-100 text-red-700" : pctFull >= 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {occupied}/{totalSlots} occupied
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[{e:"🚗",l:"Cars",a:availCar,t:totalCar},{e:"🏍️",l:"Motos",a:availMoto,t:totalMoto},{e:"🚐",l:"Vans",a:availVan,t:totalVan}].map(s => (
                  <div key={s.l} className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                    <div className="text-xl mb-1">{s.e}</div>
                    <p className={`font-black text-lg ${s.a === 0 ? "text-red-600" : "text-[#0c7b93]"}`}>{s.a}/{s.t}</p>
                    <p className="text-xs text-gray-400">{s.l} free</p>
                  </div>
                ))}
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-2.5 rounded-full transition-all ${pctFull >= 80 ? "bg-red-400" : pctFull >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${pctFull}%` }} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Checked In", val: checkedIn,       color: "text-blue-600",    bg: "bg-blue-50 border-blue-200"       },
                { label: "Pending",    val: pending,          color: "text-amber-600",   bg: "bg-amber-50 border-amber-200"     },
                { label: "Net Revenue",val: peso(netRevenue), color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border-2 ${s.bg} p-4 text-center`}>
                  <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setTab("bookings")} className={tabCls("bookings")}>📋 Bookings</button>
              <button onClick={() => setTab("crew")}     className={tabCls("crew")}>👷 Crew ({crew.length})</button>
              <button onClick={() => setTab("revenue")}  className={tabCls("revenue")}>💰 Revenue</button>
            </div>

            {/* Bookings tab */}
            {tab === "bookings" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(["today","week","month"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${period === p ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <div className="text-center py-10"><div className="text-4xl animate-pulse mb-3">🅿️</div><p className="text-sm text-gray-400">Loading…</p></div>
                ) : bookings.length === 0 ? (
                  <div className="rounded-2xl border-2 border-teal-100 bg-white p-8 text-center"><p className="text-sm text-gray-400">No bookings for this period</p></div>
                ) : (
                  bookings.map(b => (
                    <div key={b.id} className="rounded-2xl border-2 border-teal-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="font-mono font-black text-[#0c7b93] text-sm">{b.reference}</span>
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {b.status.replace("_"," ")}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#134e4a]">{peso((b.parking_fee_cents ?? 0) - (b.commission_cents ?? 0))}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#134e4a]">{b.customer_full_name}</p>
                      <p className="text-xs text-gray-400">{fmt(b.park_date_start)} → {fmt(b.park_date_end)}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.vehicles?.map((v, i) => (
                          <span key={i} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {v.vehicle_type === "car" ? "🚗" : v.vehicle_type === "motorcycle" ? "🏍️" : "🚐"} {v.plate_number}
                          </span>
                        ))}
                      </div>
                      {b.checked_in_at && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✅ Checked in {new Date(b.checked_in_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
                          {b.checked_in_by_name ? ` by ${b.checked_in_by_name}` : ""}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Crew tab */}
            {tab === "crew" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-xs text-teal-700">
                  To add or remove crew, ask your admin to update assignments in the Parking Lots management page.
                </div>
                {crew.length === 0 ? (
                  <div className="rounded-2xl border-2 border-teal-100 bg-white p-8 text-center"><p className="text-sm text-gray-400">No crew assigned yet</p></div>
                ) : (
                  crew.map(c => (
                    <div key={c.crew_id} className="rounded-2xl border-2 border-teal-100 bg-white p-4 flex items-center gap-3">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.full_name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-sm font-black text-[#0c7b93]">
                          {c.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#134e4a] text-sm">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                      <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">Parking Crew</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Revenue tab */}
            {tab === "revenue" && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(["today","week","month"] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all ${period === p ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "bg-white text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border-2 border-teal-100 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-black text-[#134e4a]">Revenue Breakdown</h3>
                  <p className="text-xs text-gray-400">Only confirmed/checked-in/completed bookings are counted.</p>
                  {[
                    { label: "Gross parking fees",  val: totalRevenue,     note: "Before commission" },
                    { label: "Commission deducted",  val: -totalCommission, note: "Platform commission" },
                    { label: "Your net revenue",     val: netRevenue,       note: "What you keep", bold: true },
                  ].map(r => (
                    <div key={r.label} className={`flex justify-between items-center py-2.5 border-b border-teal-50 last:border-0 ${r.bold ? "font-black" : ""}`}>
                      <div>
                        <p className={`text-sm ${r.bold ? "text-[#134e4a]" : "text-gray-600"}`}>{r.label}</p>
                        <p className="text-xs text-gray-400">{r.note}</p>
                      </div>
                      <p className={`text-sm font-bold ${r.val < 0 ? "text-red-600" : r.bold ? "text-emerald-600 text-base" : "text-[#134e4a]"}`}>
                        {r.val < 0 ? `-${peso(-r.val)}` : peso(r.val)}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    ℹ️ Platform fee and processing fee go to Travela Siargao directly.
                  </div>
                </div>
                <div className="space-y-2">
                  {bookings.filter(b => ["confirmed","checked_in","overstay","completed"].includes(b.status)).map(b => (
                    <div key={b.id} className="rounded-xl border border-teal-100 bg-white px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="font-mono text-xs font-black text-[#0c7b93]">{b.reference}</p>
                        <p className="text-xs text-gray-400">{fmt(b.park_date_start)} · {b.vehicle_count} vehicle{b.vehicle_count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{peso((b.parking_fee_cents ?? 0) - (b.commission_cents ?? 0))}</p>
                        <p className="text-xs text-gray-400">net</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showScanner && (
        <ParkingQRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
      )}

{selected && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="bg-white rounded-2xl p-5 max-w-md w-full">
      <h2 className="font-bold text-lg mb-2">{selected.reference}</h2>
      <p className="text-sm">{selected.customer_full_name}</p>
      <p className="text-xs text-gray-500">
        {fmt(selected.park_date_start)} → {fmt(selected.park_date_end)}
      </p>

      <div className="mt-3 space-y-1">
        {selected.vehicles?.map((v, i) => (
          <div key={i} className="text-xs">
            {v.vehicle_type} — {v.plate_number}
          </div>
        ))}
      </div>

      <button
        onClick={() => setSelected(null)}
        className="mt-4 w-full bg-[#0c7b93] text-white rounded-xl py-2"
      >
        Close
      </button>
    </div>
  </div>
)}


    </div>
  );
}
