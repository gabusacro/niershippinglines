"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  reference: string;
  customer_name: string;
  total_pax: number;
  total_amount_cents: number;
  status: string;
  payment_status: string;
  booking_source: string;
  is_walk_in: boolean;
  created_at: string;
  tour_title: string;
  schedule_date: string | null;
  departure_time: string | null;
  schedule_id: string | null;
  batch_id: string | null;
  guide_id: string | null;
  guide_name: string | null;
};

type Batch = {
  id: string;
  schedule_id: string | null;
  batch_name: string | null;
  batch_date: string | null;
  batch_number: number;
  max_pax: number;
  tour_guide_id: string | null;
  guide_name: string | null;
  guide_payment_status: string;
  service_fee_cents: number;
  booking_ids: string[];
};

type Guide = { id: string; full_name: string };

interface Props {
  bookings: Booking[];
  batches: Batch[];
  myGuides: Guide[];
  initialStatus: string;
  initialView: "list" | "batches";
  operatorId: string;
}

const statusColor: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function OperatorBookingsClient({
  bookings, batches: initialBatches, myGuides, initialStatus, initialView, operatorId,
}: Props) {
  const [view, setView] = useState<"list" | "batches">(initialView);
  const [activeFilter, setActiveFilter] = useState(initialStatus);
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [bookingState, setBookingState] = useState<Booking[]>(bookings);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [creatingBatchFor, setCreatingBatchFor] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<Record<string, string>>({});

  const filters = [
    { key: "all",       label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "pending",   label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  // ── LIST VIEW filtering ───────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return bookingState.filter(b => {
      if (activeFilter === "all") return true;
      if (activeFilter === "pending") return b.payment_status === "pending";
      if (activeFilter === "confirmed") return b.status === "confirmed" && b.payment_status === "verified";
      if (activeFilter === "completed") return b.status === "completed";
      if (activeFilter === "cancelled") return b.status === "cancelled";
      return true;
    });
  }, [bookingState, activeFilter]);

  // ── BATCH VIEW — group confirmed bookings by date + tour ──────────────
  const batchGroups = useMemo(() => {
    const confirmed = bookingState.filter(
      b => b.status === "confirmed" && b.payment_status === "verified" && b.schedule_date
    );

    // Group by schedule_date + tour_title
    const map: Record<string, {
      date: string;
      tour_title: string;
      schedule_id: string | null;
      departure_time: string | null;
      bookings: Booking[];
      batches: Batch[];
      totalPax: number;
    }> = {};

    for (const b of confirmed) {
      const key = `${b.schedule_date}__${b.tour_title}`;
      if (!map[key]) {
        map[key] = {
          date: b.schedule_date!,
          tour_title: b.tour_title,
          schedule_id: b.schedule_id,
          departure_time: b.departure_time,
          bookings: [],
          batches: [],
          totalPax: 0,
        };
      }
      map[key].bookings.push(b);
      map[key].totalPax += b.total_pax;
    }

    // Attach batches
    for (const group of Object.values(map)) {
      const groupBatchIds = new Set(
        group.bookings.map(b => b.batch_id).filter(Boolean)
      );
      group.batches = batches.filter(bt => groupBatchIds.has(bt.id));
    }

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [bookingState, batches]);

  // Assign guide = create/join batch
  async function assignGuide(bookingId: string, guideId: string) {
    setAssigningId(bookingId);
    try {
      const res = await fetch("/api/dashboard/tour-operator/assign-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, tour_guide_id: guideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const guideName = myGuides.find(g => g.id === guideId)?.full_name ?? "—";

      // Update booking state
      setBookingState(prev => prev.map(b =>
        b.id === bookingId ? { ...b, guide_id: guideId, guide_name: guideName, batch_id: data.batch_id } : b
      ));

      // Update or add batch
      if (data.action === "created") {
        setBatches(prev => [...prev, {
          id: data.batch_id,
          schedule_id: bookingState.find(b => b.id === bookingId)?.schedule_id ?? null,
          batch_name: null,
          batch_date: bookingState.find(b => b.id === bookingId)?.schedule_date ?? null,
          batch_number: 1,
          max_pax: 13,
          tour_guide_id: guideId,
          guide_name: guideName,
          guide_payment_status: "pending",
          service_fee_cents: 0,
          booking_ids: [bookingId],
        }]);
      } else if (data.action === "grouped") {
        setBatches(prev => prev.map(bt =>
          bt.id === data.batch_id
            ? { ...bt, booking_ids: [...new Set([...bt.booking_ids, bookingId])] }
            : bt
        ));
      } else if (data.action === "reassigned") {
        setBatches(prev => prev.map(bt =>
          bt.id === data.batch_id ? { ...bt, tour_guide_id: guideId, guide_name: guideName } : bt
        ));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign guide");
    } finally {
      setAssigningId(null);
    }
  }

  // Move booking to different batch
  async function moveToBatch(bookingId: string, targetBatchId: string) {
    // Find target batch guide
    const targetBatch = batches.find(b => b.id === targetBatchId);
    if (!targetBatch?.tour_guide_id) return;
    await assignGuide(bookingId, targetBatch.tour_guide_id);
  }

  // Create new batch for overflow
  async function createNewBatch(scheduleId: string, guideId: string, bookingId: string) {
    setCreatingBatchFor(bookingId);
    try {
      const res = await fetch("/api/dashboard/tour-operator/create-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId, tour_guide_id: guideId, booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const guideName = myGuides.find(g => g.id === guideId)?.full_name ?? "—";
      const booking = bookingState.find(b => b.id === bookingId);

      setBatches(prev => [...prev, {
        id: data.batch_id,
        schedule_id: scheduleId,
        batch_name: null,
        batch_date: booking?.schedule_date ?? null,
        batch_number: data.batch_number ?? 1,
        max_pax: 13,
        tour_guide_id: guideId,
        guide_name: guideName,
        guide_payment_status: "pending",
        service_fee_cents: 0,
        booking_ids: [bookingId],
      }]);

      setBookingState(prev => prev.map(b =>
        b.id === bookingId ? { ...b, batch_id: data.batch_id, guide_id: guideId, guide_name: guideName } : b
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setCreatingBatchFor(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#134e4a]">📋 My Bookings</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/tour-operator/walk-in"
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
            + Walk-in
          </Link>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setView("list")}
          className={`px-5 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
            view === "list" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
          }`}>
          📋 List View
        </button>
        <button onClick={() => setView("batches")}
          className={`px-5 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
            view === "batches" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
          }`}>
          🚐 Batch Manager
        </button>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <>
          <div className="flex gap-2 flex-wrap mb-5">
            {filters.map(f => (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                  activeFilter === f.key
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-12 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map(b => (
                <Link key={b.id} href={`/dashboard/tour-operator/bookings/${b.id}`}
                  className="block rounded-2xl border-2 border-gray-100 bg-white p-5 hover:border-emerald-200 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-sm text-[#0c7b93]">{b.reference}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {b.status.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.payment_status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {b.payment_status === "verified" ? "✅ Paid" : "⏳ Unpaid"}
                        </span>
                        {b.is_walk_in && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Walk-in</span>}
                      </div>
                      <p className="font-semibold text-[#134e4a] text-sm">{b.tour_title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                        {b.schedule_date ? " · " + formatDateShort(b.schedule_date) : ""}
                      </p>
                      {b.guide_name && (
                        <p className="text-xs text-blue-600 mt-0.5 font-medium">👤 {b.guide_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-700">₱{(b.total_amount_cents / 100).toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(b.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BATCH MANAGER VIEW ── */}
      {view === "batches" && (
        <div className="space-y-6">
          {batchGroups.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3">🚐</p>
              <p className="text-gray-500 font-medium">No confirmed bookings to batch</p>
              <p className="text-sm text-gray-400 mt-1">Confirmed bookings will appear here grouped by date.</p>
            </div>
          ) : (
            batchGroups.map(group => {
              // Group bookings by batch_id
              const batchedBookings: Record<string, Booking[]> = {};
              const unbatched: Booking[] = [];

              for (const b of group.bookings) {
                if (b.batch_id) {
                  if (!batchedBookings[b.batch_id]) batchedBookings[b.batch_id] = [];
                  batchedBookings[b.batch_id].push(b);
                } else {
                  unbatched.push(b);
                }
              }

              // Get unique batches for this group
              const groupBatches = group.batches;

              return (
                <div key={`${group.date}__${group.tour_title}`}
                  className="rounded-2xl border-2 border-emerald-100 bg-white overflow-hidden">

                  {/* Group header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-lg">{group.tour_title}</p>
                        <p className="text-sm text-white/80">
                          {formatDate(group.date)}
                          {group.departure_time ? " · Departure " + group.departure_time.slice(0, 5) : ""}
                        </p>
                      </div>
                      <div className="flex gap-3 text-right">
                        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                          <p className="text-xs text-white/70">Total Pax</p>
                          <p className="text-xl font-bold">{group.totalPax}</p>
                        </div>
                        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                          <p className="text-xs text-white/70">Batches</p>
                          <p className="text-xl font-bold">{groupBatches.length || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Van capacity warning */}
                    {group.totalPax > 13 && (
                      <div className="mt-3 rounded-xl bg-amber-400/20 border border-amber-300/30 px-3 py-2">
                        <p className="text-xs font-bold text-amber-100">
                          ⚠️ {group.totalPax} pax total — needs {Math.ceil(group.totalPax / 13)} vans (13 max each). Split into multiple batches below.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-4">

                    {/* Batched bookings grouped by batch */}
                    {groupBatches.map((batch, batchIdx) => {
                      const batchBookingList = batchedBookings[batch.id] ?? [];
                      const batchPax = batchBookingList.reduce((s, b) => s + b.total_pax, 0);
                      const paxLeft = batch.max_pax - batchPax;
                      const isFull = paxLeft <= 0;

                      return (
                        <div key={batch.id} className={`rounded-xl border-2 overflow-hidden ${
                          isFull ? "border-amber-200" : "border-emerald-200"
                        }`}>
                          {/* Batch header */}
                          <div className={`px-4 py-3 flex items-center justify-between flex-wrap gap-2 ${
                            isFull ? "bg-amber-50" : "bg-emerald-50"
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-[#134e4a]">
                                🚐 Batch {batchIdx + 1}
                              </span>
                              {/* Pax bar */}
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isFull ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(100, (batchPax / batch.max_pax) * 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${isFull ? "text-amber-700" : "text-emerald-700"}`}>
                                  {batchPax}/{batch.max_pax} pax
                                  {isFull ? " 🔴 Full" : ` · ${paxLeft} left`}
                                </span>
                              </div>
                            </div>

                            {/* Guide assignment per batch */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {batch.tour_guide_id ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                                    👤 {batch.guide_name}
                                  </span>
                                  {/* Warn if this guide is on another batch same day */}
                                  {groupBatches.filter(bt => bt.id !== batch.id && bt.tour_guide_id === batch.tour_guide_id).length > 0 && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">
                                      ⚠️ Also on another batch today
                                    </span>
                                  )}
                                  {/* Reassign guide */}
                                  <select
                                    defaultValue=""
                                    onChange={e => { if (e.target.value) {
                                      const batchBookingIds = batchedBookings[batch.id]?.map(b => b.id) ?? [];
                                      if (batchBookingIds.length > 0) assignGuide(batchBookingIds[0], e.target.value);
                                    }}}
                                    className="text-xs rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 focus:outline-none focus:border-blue-400">
                                    <option value="">Change guide...</option>
                                    {myGuides.map(g => (
                                      <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold animate-pulse">
                                    ⚠️ Needs guide
                                  </span>
                                  <select
                                    defaultValue=""
                                    onChange={e => { if (e.target.value) {
                                      const batchBookingIds = batchedBookings[batch.id]?.map(b => b.id) ?? [];
                                      if (batchBookingIds.length > 0) assignGuide(batchBookingIds[0], e.target.value);
                                    }}}
                                    className="text-xs rounded-lg border border-red-200 bg-red-50 px-2 py-1 focus:outline-none focus:border-red-400">
                                    <option value="">Assign guide...</option>
                                    {myGuides.map(g => {
                                      const alreadyToday = groupBatches.some(bt => bt.id !== batch.id && bt.tour_guide_id === g.id);
                                      return (
                                        <option key={g.id} value={g.id}>
                                          {g.full_name}{alreadyToday ? " (⚠️ already on batch today)" : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bookings in this batch */}
                          <div className="divide-y divide-gray-50">
                            {batchBookingList.map(b => (
                              <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      b.booking_source === "operator_walk_in" ? "bg-purple-100 text-purple-600" :
                                      b.booking_source === "walk_in" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                                    }`}>
                                      {b.booking_source === "operator_walk_in" ? "Walk-in" :
                                       b.booking_source === "walk_in" ? "Admin Walk-in" : "Online"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {b.customer_name} · <strong>{b.total_pax} pax</strong>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[#134e4a]">
                                    ₱{(b.total_amount_cents / 100).toLocaleString()}
                                  </span>
                                  {/* Move to another batch */}
                                  {groupBatches.length > 1 && (
                                    <select
                                      defaultValue=""
                                      onChange={e => { if (e.target.value) moveToBatch(b.id, e.target.value); }}
                                      className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-emerald-400">
                                      <option value="">Move to...</option>
                                      {groupBatches.filter(bt => bt.id !== batch.id).map((bt, i) => (
                                        <option key={bt.id} value={bt.id}>Batch {i + 1}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Guide workload summary for this day */}
                    {groupBatches.length > 0 && (() => {
                      const guideWorkload: Record<string, { name: string; batches: number; pax: number }> = {};
                      for (const bt of groupBatches) {
                        if (!bt.tour_guide_id || !bt.guide_name) continue;
                        if (!guideWorkload[bt.tour_guide_id]) {
                          guideWorkload[bt.tour_guide_id] = { name: bt.guide_name, batches: 0, pax: 0 };
                        }
                        guideWorkload[bt.tour_guide_id].batches++;
                        const pax = (batchedBookings[bt.id] ?? []).reduce((s, b) => s + b.total_pax, 0);
                        guideWorkload[bt.tour_guide_id].pax += pax;
                      }
                      const overloaded = Object.values(guideWorkload).filter(g => g.batches > 1);
                      if (overloaded.length === 0) return null;
                      return (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                          <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Guide handling multiple batches today:</p>
                          {overloaded.map(g => (
                            <p key={g.name} className="text-xs text-amber-700">
                              👤 {g.name} — {g.batches} batches · {g.pax} total pax
                              <span className="ml-1 text-amber-600">(Confirm with guide they can handle this)</span>
                            </p>
                          ))}
                        </div>
                      );
                    })()}

                  {/* Unassigned bookings */}
                    {unbatched.length > 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-200">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <p className="text-sm font-bold text-gray-600">
                            ⚠️ {unbatched.length} booking{unbatched.length > 1 ? "s" : ""} not yet assigned to a guide
                          </p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {unbatched.map(b => (
                            <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {b.customer_name} · <strong>{b.total_pax} pax</strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#134e4a]">₱{(b.total_amount_cents / 100).toLocaleString()}</span>
                                {/* Assign to existing batch */}
                                {groupBatches.filter(bt => (bt.booking_ids.reduce((s, bid) => {
                                  const bk = bookingState.find(bk => bk.id === bid);
                                  return s + (bk?.total_pax ?? 0);
                                }, 0)) + b.total_pax <= bt.max_pax).length > 0 && (
                                  <select
                                    defaultValue=""
                                    onChange={e => { if (e.target.value) moveToBatch(b.id, e.target.value); }}
                                    className="text-xs rounded-lg border border-emerald-200 px-2 py-1 focus:outline-none focus:border-emerald-400 bg-emerald-50">
                                    <option value="">Add to batch...</option>
                                    {groupBatches.filter(bt => {
                                      const pax = bt.booking_ids.reduce((s, bid) => {
                                        const bk = bookingState.find(bk => bk.id === bid);
                                        return s + (bk?.total_pax ?? 0);
                                      }, 0);
                                      return pax + b.total_pax <= bt.max_pax;
                                    }).map((bt, i) => (
                                      <option key={bt.id} value={bt.id}>
                                        Batch {i + 1} ({bt.guide_name ?? "No guide"})
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {/* Assign to new batch with guide */}
                                <div className="flex items-center gap-1">
                                  <select
                                    value={selectedGuide[b.id] ?? ""}
                                    onChange={e => setSelectedGuide(prev => ({ ...prev, [b.id]: e.target.value }))}
                                    className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-emerald-400">
                                    <option value="">Assign guide...</option>
                                    {myGuides.map(g => (
                                      <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))}
                                  </select>
                                  {selectedGuide[b.id] && (
                                    <button
                                      onClick={() => assignGuide(b.id, selectedGuide[b.id])}
                                      disabled={assigningId === b.id}
                                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50">
                                      {assigningId === b.id ? "..." : "Assign"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All assigned summary */}
                    {unbatched.length === 0 && groupBatches.length > 0 && (
                      <div className="flex items-center justify-between py-2 flex-wrap gap-2">
                        <span className="text-xs text-emerald-600 font-semibold">✅ All bookings assigned to batches</span>
                        {/* Show + New Batch if any batch is full */}
                        {groupBatches.some(bt => {
                          const pax = (batchedBookings[bt.id] ?? []).reduce((s, b) => s + b.total_pax, 0);
                          return pax >= bt.max_pax;
                        }) && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-600 font-semibold">Some batches are full</span>
                            <select
                              defaultValue=""
                              onChange={e => {
                                if (e.target.value && group.schedule_id) {
                                  const fullBatch = groupBatches.find(bt => {
                                    const pax = (batchedBookings[bt.id] ?? []).reduce((s, b) => s + b.total_pax, 0);
                                    return pax >= bt.max_pax;
                                  });
                                  if (fullBatch) {
                                    const firstBooking = batchedBookings[fullBatch.id]?.[0];
                                    if (firstBooking) createNewBatch(group.schedule_id!, e.target.value, firstBooking.id);
                                  }
                                }
                              }}
                              className="text-xs rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 focus:outline-none focus:border-amber-400">
                              <option value="">+ New batch with guide...</option>
                              {myGuides.map(g => {
                                const alreadyToday = groupBatches.some(bt => bt.tour_guide_id === g.id);
                                return (
                                  <option key={g.id} value={g.id}>
                                    {g.full_name}{alreadyToday ? " ⚠️ already assigned" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="mt-6">
        <Link href="/dashboard/tour-operator" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
