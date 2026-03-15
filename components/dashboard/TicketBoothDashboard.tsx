"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { formatTime } from "@/lib/dashboard/format";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { ManifestStatusButton } from "@/components/admin/ManifestStatusButton";

type PendingItem = { reference: string; customer_full_name: string; total_amount_cents: number };
type IssuedBooking = { reference: string; customer_full_name: string; total_amount_cents: number; passenger_count: number; created_at: string };

type Props = {
  ownerName: string;
  vesselName: string | null;
  boatId: string | null;
  todayTrips: TodayTripForCrew[];
  selectedTripId: string | null;
  manifest: TripManifestData | null;
  pendingPayments: PendingItem[];
  issuedToday: IssuedBooking[];
  loggedInEmail: string;
  loggedInAddress: string;
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true }); }
  catch { return ""; }
}

function formatTime12(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function getNowManila() {
  return new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function isTripUpcoming(departureTime: string): boolean {
  const now = new Date();
  const [h, m] = departureTime.split(":").map(Number);
  const tripTime = new Date();
  tripTime.setHours(h, m, 0, 0);
  return tripTime > now;
}

export function TicketBoothDashboard({
  ownerName, vesselName, boatId,
  todayTrips, selectedTripId, manifest,
  pendingPayments, issuedToday,
  loggedInEmail, loggedInAddress,
}: Props) {
  const [activeTripId, setActiveTripId] = useState<string | null>(selectedTripId);
  const [bookingTrip, setBookingTrip] = useState<TodayTripForCrew | null>(null);
  const [nowString, setNowString] = useState(getNowManila());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNowString(getNowManila()), 60000);
    return () => clearInterval(t);
  }, []);

  const activeManifest = manifest;
  const selectedTrip = todayTrips.find(t => t.id === activeTripId) ?? null;
  const totalPax = activeManifest?.totalPassengers ?? 0;
  const boardedCount = activeManifest?.passengers.filter(p => p.status === "boarded" || p.status === "completed").length ?? 0;
  const checkedInCount = activeManifest?.passengers.filter(p => p.status === "checked_in").length ?? 0;
  const confirmedCount = activeManifest?.passengers.filter(p => p.status === "confirmed").length ?? 0;

  // ── No vessel assigned ────────────────────────────────────────────────────
  if (!boatId || !vesselName) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #C9EEE4 0%, #E1F5EE 40%, #f0fdfa 100%)" }}>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="rounded-2xl border-2 border-amber-200 bg-white p-10 shadow-lg">
            <div className="text-5xl mb-4">🎫</div>
            <h1 className="text-xl font-bold text-[#134e4a]">Not assigned to a vessel yet</h1>
            <p className="mt-3 text-sm text-[#0f766e]">
              You need to be assigned to a vessel before you can issue tickets.
              Contact admin to get assigned.
            </p>
            <Link href={ROUTES.account}
              className="mt-6 inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
              My Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #C9EEE4 0%, #E1F5EE 40%, #f0fdfa 100%)" }}>

      {/* Top accent bar */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #085C52, #0c7b93, #1AB5A3)" }} />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl px-5 py-6 shadow-lg" style={{ backgroundColor: "#0c7b93" }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Ticket Booth
              </p>
              <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2 }}>{ownerName}</h1>
              <p style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>
                {vesselName} · {nowString}
              </p>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 16px", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Issued today</p>
              <p style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, marginTop: 2 }}>{issuedToday.length}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Today's trips", value: String(todayTrips.length) },
              { label: "Pending confirm", value: String(pendingPayments.length), yellow: pendingPayments.length > 0 },
              { label: "Boarded", value: String(boardedCount) },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                <p style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pending payments alert ───────────────────────────────────────── */}
        {pendingPayments.length > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <p className="text-sm font-bold text-amber-900">Pending Payments — {pendingPayments.length} booking{pendingPayments.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-amber-700 mt-0.5">Passengers waiting for confirmation</p>
              </div>
              <Link href={ROUTES.adminPendingPayments}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition-colors whitespace-nowrap">
                Confirm payments →
              </Link>
            </div>
            <div className="space-y-2">
              {pendingPayments.slice(0, 3).map(b => (
                <div key={b.reference} className="flex items-center justify-between rounded-xl bg-white border border-amber-200 px-4 py-2.5">
                  <div>
                    <span className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</span>
                    <span className="ml-2 text-sm text-[#134e4a]">{b.customer_full_name}</span>
                  </div>
                  <span className="font-bold text-amber-800">₱{(b.total_amount_cents / 100).toLocaleString()}</span>
                </div>
              ))}
              {pendingPayments.length > 3 && (
                <p className="text-xs text-amber-600 text-center">+{pendingPayments.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* ── Today's trips ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Today&apos;s Trips — {vesselName}</span>
            <div className="h-px flex-1 bg-teal-200" />
          </div>

          {todayTrips.length === 0 ? (
            <div className="rounded-xl border border-teal-100 bg-white p-8 text-center text-sm text-[#0f766e]/60">
              No trips scheduled for {vesselName} today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayTrips.map((trip) => {
                const isUpcoming = isTripUpcoming(trip.departure_time);
                const isActive = activeTripId === trip.id;
                const routeName = trip.route?.display_name
                  ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ")
                  ?? "—";
                const seatsLeft = (trip.online_quota ?? 0) - (trip.online_booked ?? 0);

                return (
                  <div key={trip.id}
                    className={`rounded-2xl border-2 transition-all ${
                      isActive ? "border-[#0c7b93] shadow-md" :
                      isUpcoming ? "border-teal-200 bg-white shadow-sm" :
                      "border-gray-100 bg-gray-50/50 opacity-70"
                    }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          {/* Time badge */}
                          <div className={`rounded-xl px-3 py-2 text-center min-w-[72px] ${
                            isUpcoming ? "bg-[#0c7b93] text-white" : "bg-gray-100 text-gray-500"
                          }`}>
                            <p className="text-xs font-bold">{formatTime12(trip.departure_time)}</p>
                          </div>
                          <div>
                            <p className="font-bold text-[#134e4a] text-sm">{routeName}</p>
                            <p className="text-xs text-[#0f766e] mt-0.5">{trip.boat?.name ?? vesselName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status badges */}
                          {isUpcoming ? (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                              Upcoming
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs font-semibold">
                              Departed
                            </span>
                          )}
                          <span className="rounded-full bg-teal-50 text-[#0c7b93] border border-teal-200 px-2.5 py-0.5 text-xs font-semibold">
                            {seatsLeft} seats left
                          </span>

                          {/* Manifest toggle */}
                          <button
                            onClick={() => setActiveTripId(isActive ? null : trip.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                              isActive
                                ? "bg-[#0c7b93] text-white"
                                : "border border-teal-200 bg-teal-50 text-[#0c7b93] hover:bg-teal-100"
                            }`}>
                            {isActive ? "Hide manifest" : "View manifest"}
                          </button>

                          {/* Issue ticket button — only for upcoming trips */}
                          {isUpcoming && seatsLeft > 0 && (
                            <button
                              onClick={() => setBookingTrip(trip)}
                              className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
                              Issue Ticket
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Manifest inline */}
                      {isActive && activeManifest && (
                        <div className="mt-4 border-t border-teal-100 pt-4">
                          {/* Status pills */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold">Confirmed: {confirmedCount}</span>
                            <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Checked in: {checkedInCount}</span>
                            <span className="rounded-full bg-teal-600 text-white px-3 py-1 text-xs font-semibold">Boarded: {boardedCount}</span>
                            <span className="rounded-full bg-[#0c7b93] text-white px-3 py-1 text-xs font-semibold">Total: {totalPax}</span>
                          </div>

                          {activeManifest.passengers.length === 0 ? (
                            <p className="text-sm text-[#0f766e]/60 text-center py-4">No passengers booked yet.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-teal-100">
                              <table className="min-w-full text-sm divide-y divide-teal-50">
                                <thead>
                                  <tr className="bg-teal-50">
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#0f766e]">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#0f766e]">Ticket</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#0f766e]">Name</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#0f766e]">Source</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#0f766e]">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-teal-50 bg-white">
                                  {activeManifest.passengers.map((p) => (
                                    <tr key={`${p.ticketNumber}-${p.seq}`}>
                                      <td className="px-3 py-2 text-[#134e4a]">{p.seq}</td>
                                      <td className="px-3 py-2 font-mono text-xs font-semibold text-[#0c7b93]">{p.ticketNumber}</td>
                                      <td className="px-3 py-2 font-medium text-[#134e4a]">{p.passengerName}</td>
                                      <td className="px-3 py-2 text-xs text-[#0f766e]">{p.source}</td>
                                      <td className="px-3 py-2">
                                        <ManifestStatusButton ticketNumber={p.ticketNumber} initialStatus={p.status} />
                                        {p.boardedAt && <p className="text-xs text-gray-400 mt-0.5">{formatTimestamp(p.boardedAt)}</p>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Tickets issued today ─────────────────────────────────────────── */}
        {issuedToday.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-teal-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Tickets Issued Today</span>
              <div className="h-px flex-1 bg-teal-200" />
            </div>
            <div className="rounded-xl border border-teal-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm divide-y divide-teal-50">
                <thead>
                  <tr className="bg-teal-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Reference</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Passenger</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#0f766e]">Pax</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#0f766e]">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50 bg-white">
                  {issuedToday.map((b) => (
                    <tr key={b.reference} className="hover:bg-teal-50/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/dashboard/bookings/${b.reference}`}
                          className="font-mono text-xs font-semibold text-[#0c7b93] hover:underline">
                          {b.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[#134e4a]">{b.customer_full_name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#134e4a]">{b.passenger_count}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0c7b93]">₱{(b.total_amount_cents / 100).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs text-[#0f766e]">{formatTimestamp(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 border-t-2 border-teal-200">
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-[#134e4a]">Total issued today</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#134e4a]">
                      {issuedToday.reduce((s, b) => s + b.passenger_count, 0)} pax
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#0c7b93]">
                      ₱{(issuedToday.reduce((s, b) => s + b.total_amount_cents, 0) / 100).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Quick links ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Quick Links</span>
            <div className="h-px flex-1 bg-teal-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: ROUTES.adminPendingPayments, icon: "⏳", label: "Pending Payments", sub: "Confirm walk-ins" },
              { href: ROUTES.adminBookings, icon: "📋", label: "Booking History", sub: "All bookings" },
              { href: ROUTES.crewScan, icon: "📷", label: "Scan QR Ticket", sub: "Verify passenger" },
              { href: ROUTES.adminReports, icon: "📊", label: "Reports", sub: "Manifests & reports" },
              { href: ROUTES.account, icon: "👤", label: "My Account", sub: "Profile & password" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 rounded-xl border-2 border-teal-100 bg-white/80 px-4 py-3 shadow-sm hover:border-[#0c7b93] hover:bg-white transition-all">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-[#134e4a]">{item.label}</p>
                  <p className="text-xs text-[#0f766e]">{item.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#0f766e]/40 pb-4">
          You can only issue tickets for {vesselName}. Contact admin to change vessel assignment.
        </p>
      </div>

      {/* ── Issue Ticket Modal ───────────────────────────────────────────── */}
      {bookingTrip && (
        <IssueTicketModal
          trip={bookingTrip}
          loggedInEmail={loggedInEmail}
          loggedInAddress={loggedInAddress}
          onClose={() => setBookingTrip(null)}
          onSuccess={() => { setBookingTrip(null); window.location.reload(); }}
        />
      )}
    </div>
  );
}

// ── Issue Ticket Modal ────────────────────────────────────────────────────────
function IssueTicketModal({ trip, loggedInEmail, loggedInAddress, onClose, onSuccess }: {
  trip: TodayTripForCrew;
  loggedInEmail: string;
  loggedInAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const routeName = trip.route?.display_name
    ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ")
    ?? "—";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState(loggedInAddress);
  const [fareType, setFareType] = useState("adult");
  const [passengerCount, setPassengerCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Passenger name is required."); return; }
    if (!mobile.trim()) { setError("Mobile number is required."); return; }
    if (!address.trim()) { setError("Address is required."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          customer_full_name: fullName.trim(),
          customer_email: email.trim() || loggedInEmail,
          customer_mobile: mobile.trim(),
          customer_address: address.trim(),
          passenger_count: passengerCount,
          fare_type: fareType,
          is_walk_in: true,
          booking_source: "ticket_booth_walk_in",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed."); return; }
      onSuccess();
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const inputCls = "mt-1 w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-teal-100 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Issue Walk-in Ticket</p>
              <h2 className="text-base font-bold text-[#134e4a] mt-0.5">{routeName}</h2>
              <p className="text-xs text-[#0f766e]">{formatTime12(trip.departure_time)} · {trip.boat?.name}</p>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Fare type + count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#134e4a]">Fare Type</label>
              <select value={fareType} onChange={e => setFareType(e.target.value)} className={inputCls}>
                <option value="adult">Adult</option>
                <option value="senior">Senior (20% off)</option>
                <option value="pwd">PWD (20% off)</option>
                <option value="student">Student (20% off)</option>
                <option value="child">Child (50% off)</option>
                <option value="infant">Infant (FREE)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#134e4a]">Passengers</label>
              <input type="number" min={1} max={20} value={passengerCount}
                onChange={e => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">Passenger Full Name <span className="text-red-500">*</span></label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz" required className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">Mobile Number <span className="text-red-500">*</span></label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
              placeholder="09XX XXX XXXX" required className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">Email (optional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="For ticket receipt" className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">Address <span className="text-red-500">*</span></label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="For manifest" required className={inputCls} />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={submitting}
              className="flex-1 min-h-[48px] rounded-xl bg-[#0c7b93] font-bold text-white text-sm hover:bg-[#085f72] disabled:opacity-50 transition-colors">
              {submitting ? "Creating booking..." : "Issue Ticket"}
            </button>
            <button type="button" onClick={onClose}
              className="min-h-[48px] rounded-xl border-2 border-teal-200 px-4 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
              Cancel
            </button>
          </div>

          <p className="text-xs text-[#0f766e]/60 text-center">
            Walk-in cash booking — no GCash processing fee charged
          </p>
        </form>
      </div>
    </div>
  );
}
