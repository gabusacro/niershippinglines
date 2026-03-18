"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { formatTime } from "@/lib/dashboard/format";
import { getNowManilaString } from "@/lib/admin/ph-time";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";
import type { UpcomingTripForBooth } from "@/lib/dashboard/get-upcoming-trips-for-boats";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { ManifestStatusButton } from "@/components/admin/ManifestStatusButton";

type Props = {
  roleLabel: string;
  role: string;  // actual role value: "captain" | "deck_crew"
  todayTrips: TodayTripForCrew[];
  upcomingTrips: UpcomingTripForBooth[];
  currentTrip: TodayTripForCrew | null;
  selectedTripId: string | null;
  manifest: TripManifestData | null;
  avatarUrl?: string | null;
  ownerName?: string;
  vesselNames?: string[];
  loggedInEmail: string;
  loggedInAddress: string;
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

function fmt12(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return d; }
}

// ── Issue Ticket Modal ────────────────────────────────────────────────────────
function IssueTicketModal({ trip, role, loggedInEmail, loggedInAddress, onClose, onSuccess }: {
  trip: UpcomingTripForBooth;
  role: string;
  loggedInEmail: string;
  loggedInAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const routeName = trip.route?.display_name
    ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ") ?? "—";

  const [fullName,       setFullName]       = useState("");
  const [mobile,         setMobile]         = useState("");
  const [address,        setAddress]        = useState(loggedInAddress);
  const [fareType,       setFareType]       = useState("adult");
  const [passengerCount, setPassengerCount] = useState(1);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");

  const inputCls = "mt-1 w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20 text-sm";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Passenger name is required."); return; }
    if (!mobile.trim())   { setError("Mobile number is required.");   return; }
    if (!address.trim())  { setError("Address is required.");         return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id:            trip.id,
          customer_full_name: fullName.trim(),
          customer_email:     loggedInEmail,
          customer_mobile:    mobile.trim(),
          customer_address:   address.trim(),
          passenger_count:    passengerCount,
          fare_type:          fareType,
          is_walk_in:         true,
          // booking_source is determined server-side from the user's role
          // captain → captain_walk_in, deck_crew → deck_crew_walk_in
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed."); return; }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = role === "captain" ? "Captain" : "Crew";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-teal-100 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">
                Issue Walk-in Ticket · {roleLabel}
              </div>
              <div className="text-base font-bold text-[#134e4a] mt-0.5">{routeName}</div>
              <div className="text-xs text-[#0f766e] mt-1 flex items-center gap-2">
                <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-800">
                  {formatDate(trip.departure_date)}
                </span>
                <span className="font-semibold">{fmt12(trip.departure_time)}</span>
                <span className="text-[#0f766e]/60">· {trip.boat?.name}</span>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
            <label className="text-xs font-bold text-[#134e4a]">
              Passenger Full Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz" required className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
              placeholder="09XX XXX XXXX" required className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-bold text-[#134e4a]">
              Address <span className="text-red-500">*</span>
            </label>
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
              {submitting ? "Creating booking…" : "Issue Ticket"}
            </button>
            <button type="button" onClick={onClose}
              className="min-h-[48px] rounded-xl border-2 border-teal-200 px-4 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
              Cancel
            </button>
          </div>
          <div className="text-xs text-[#0f766e]/60 text-center">
            Logged as {roleLabel} walk-in · No GCash fee · Cash payment
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CrewCaptainManifestSection({
  roleLabel, role, todayTrips, upcomingTrips, currentTrip,
  selectedTripId, manifest,
  avatarUrl, ownerName, vesselNames = [],
  loggedInEmail, loggedInAddress,
}: Props) {
  const [nowManila, setNowManila] = useState("");
  useEffect(() => {
    setNowManila(getNowManilaString());
    const t = setInterval(() => setNowManila(getNowManilaString()), 60000);
    return () => clearInterval(t);
  }, []);

  const [activeTripId, setActiveTripId] = useState<string | null>(selectedTripId);
  const [bookingTrip,  setBookingTrip]  = useState<UpcomingTripForBooth | null>(null);

  const selectedTrip = todayTrips.find((t) => t.id === activeTripId) ?? currentTrip;
  const routeLabel = selectedTrip
    ? (selectedTrip.route?.display_name
        ?? [selectedTrip.route?.origin, selectedTrip.route?.destination].filter(Boolean).join(" ↔ ")
        ?? "—")
    : "—";
  const vesselName    = selectedTrip?.boat?.name ?? vesselNames[0] ?? "—";
  const departureTime = selectedTrip ? fmt12(selectedTrip.departure_time) : "—";

  const totalPax       = manifest?.totalPassengers ?? 0;
  const confirmedCount = manifest?.passengers.filter(p => p.status === "confirmed").length ?? 0;
  const checkedInCount = manifest?.passengers.filter(p => p.status === "checked_in").length ?? 0;
  const boardedCount   = manifest?.passengers.filter(p => p.status === "boarded" || p.status === "completed").length ?? 0;

  const initials = ownerName
    ? ownerName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : roleLabel[0]?.toUpperCase() ?? "C";

  // Find the upcoming version of the active trip for the issue ticket modal
  const upcomingVersion = upcomingTrips.find(u => u.id === activeTripId)
    ?? upcomingTrips.find(u => u.id === currentTrip?.id);

  return (
    <div className="space-y-5">

      {/* ── Hero header ── */}
      <div
        className="rounded-2xl px-5 py-6 shadow-lg relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064E44 0%, #0c7b93 55%, #1AB5A3 100%)" }}>
        {/* Wave pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' viewBox='0 0 120 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q30 10 60 30 Q90 50 120 30' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
            backgroundSize: "120px 60px",
          }} />
        {/* Palm silhouette */}
        <div className="absolute right-0 top-0 bottom-0 w-32 opacity-10 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 130 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M65 200 Q63 160 61 140 Q62 120 65 100 Q67 80 65 65" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M65 68 Q43 45 25 50" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <path d="M65 68 Q53 38 59 20" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <path d="M65 68 Q83 42 101 48" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="relative flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={ownerName ?? ""}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/30 shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center text-xl font-black text-white"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                {initials}
              </div>
            )}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <div style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {roleLabel} Dashboard
            </div>
            <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2, lineHeight: 1.2 }}>
              {ownerName ?? roleLabel}
            </div>
            <div style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>
              {vesselName}{vesselNames.length > 1 && ` · ${vesselNames.length} vessels`}
            </div>
            {nowManila && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 border border-white/20"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span style={{ color: "#ffffff", fontSize: 12, fontWeight: 600 }}>{nowManila}</span>
              </div>
            )}
          </div>

          {/* Today's trips count */}
          <div className="shrink-0 text-center rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Today</div>
            <div style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{todayTrips.length}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 2 }}>trips</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total Pax",  value: String(totalPax) },
            { label: "Confirmed",  value: String(confirmedCount) },
            { label: "Checked in", value: String(checkedInCount), yellow: true },
            { label: "Boarded",    value: String(boardedCount) },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2">
        <Link href={ROUTES.crewScan}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
          📷 Scan QR Ticket
        </Link>

        {/* Issue Ticket button — available to both captain and deck_crew */}
        {upcomingVersion && (
          <button
            type="button"
            onClick={() => setBookingTrip(upcomingVersion)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm">
            🎫 Issue Ticket
          </button>
        )}

        {roleLabel === "Captain" && (
          <Link href={ROUTES.adminVessels}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#0c7b93] px-4 py-2.5 text-sm font-bold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors">
            📢 Post Announcement
          </Link>
        )}
        <Link href={ROUTES.account}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
          👤 My Account
        </Link>
      </div>

      {/* ── Trip selector ── */}
      {todayTrips.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Today&apos;s Trips</span>
            <div className="h-px flex-1 bg-teal-200" />
          </div>
          <div className="flex flex-wrap gap-2">
            {todayTrips.map((t) => {
              const isActive = activeTripId === t.id || (!activeTripId && currentTrip?.id === t.id);
              const route = t.route?.display_name
                ?? [t.route?.origin, t.route?.destination].filter(Boolean).join(" → ")
                ?? "—";
              // Walk-in seats for this trip
              const walkInLeft = (t.walk_in_quota ?? 0) - (t.walk_in_booked ?? 0);
              return (
                <button key={t.id} type="button"
                  onClick={() => setActiveTripId(t.id)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all border-2 ${
                    isActive
                      ? "bg-[#0c7b93] border-[#0c7b93] text-white shadow-md"
                      : t.departed
                      ? "border-gray-200 bg-gray-50 text-gray-500"
                      : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50"
                  }`}>
                  <span className="font-bold">{fmt12(t.departure_time)}</span>
                  <span className="ml-2 text-xs opacity-75">{t.boat?.name ?? vesselName}</span>
                  {t.departed && <span className="ml-2 text-xs opacity-50">departed</span>}
                  {!t.departed && (
                    <span className="ml-2 text-xs opacity-60">· {walkInLeft} walk-in left</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected trip info ── */}
      {selectedTrip && (
        <div className="rounded-xl border-2 border-teal-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#134e4a] text-base">{routeLabel}</div>
              <div className="text-sm text-[#0f766e] mt-0.5">{vesselName} · Departs {departureTime}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                Confirmed: {confirmedCount}
              </span>
              <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
                Checked in: {checkedInCount}
              </span>
              <span className="rounded-full bg-teal-600 text-white px-3 py-1 text-xs font-semibold">
                Boarded: {boardedCount}
              </span>
              <span className="rounded-full bg-[#0c7b93] text-white px-3 py-1 text-xs font-semibold">
                Total: {totalPax}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Manifest table ── */}
      <div className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm">
        <div className="border-b border-teal-100 bg-teal-50/60 px-5 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-base font-bold text-[#134e4a]">Passenger Manifest</div>
            <div className="text-xs text-[#0f766e] mt-0.5">Full name, address, contact, source and boarding status</div>
          </div>
          {totalPax > 0 && (
            <span className="rounded-full bg-[#0c7b93] text-white px-3 py-1 text-xs font-bold">
              {totalPax} passenger{totalPax !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {manifest && manifest.passengers.length > 0 ? (
            <table className="min-w-full divide-y divide-teal-50 text-sm">
              <thead>
                <tr className="bg-teal-50/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 bg-white">
                {manifest.passengers.map((p) => (
                  <tr key={`${p.ticketNumber}-${p.seq}`} className="hover:bg-teal-50/30 transition-colors">
                    <td className="px-4 py-3 text-[#0f766e] text-xs">{p.seq}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0c7b93] whitespace-nowrap">{p.ticketNumber}</td>
                    <td className="px-4 py-3 font-semibold text-[#134e4a]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-[#0c7b93] shrink-0">
                          {p.passengerName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        {p.passengerName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#0f766e] max-w-[160px] truncate" title={p.address ?? undefined}>
                      {p.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#0f766e] whitespace-nowrap">{p.contact ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#0f766e] whitespace-nowrap">{p.source}</td>
                    <td className="px-4 py-3">
                      <ManifestStatusButton ticketNumber={p.ticketNumber} initialStatus={p.status} />
                      {p.checkedInAt && (
                        <div className="mt-0.5 text-xs text-gray-400">In: {formatTimestamp(p.checkedInAt)}</div>
                      )}
                      {p.boardedAt && (
                        <div className="text-xs text-gray-400">Boarded: {formatTimestamp(p.boardedAt)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-2">🚢</div>
              <div className="text-sm font-semibold text-[#134e4a]">No passengers yet</div>
              <div className="text-xs text-[#0f766e]/60 mt-1">
                {activeTripId && !manifest ? "Loading manifest…" : "No passengers booked for this trip."}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Issue Ticket Modal ── */}
      {bookingTrip && (
        <IssueTicketModal
          trip={bookingTrip}
          role={role}
          loggedInEmail={loggedInEmail}
          loggedInAddress={loggedInAddress}
          onClose={() => setBookingTrip(null)}
          onSuccess={() => { setBookingTrip(null); window.location.reload(); }}
        />
      )}
    </div>
  );
}
