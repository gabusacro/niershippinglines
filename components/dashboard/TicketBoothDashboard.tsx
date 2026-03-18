"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";
import type { UpcomingTripForBooth } from "@/lib/dashboard/get-upcoming-trips-for-boats";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { ManifestStatusButton } from "@/components/admin/ManifestStatusButton";
import { Clock, QrCode, BarChart3, BookOpen, User } from "lucide-react";
import { TicketBoothRevenueSummary } from "@/components/dashboard/TicketBoothRevenueSummary";
import { CashHandoverSummary } from "@/components/dashboard/CashHandoverSummary";

type PendingItem = { reference: string; customer_full_name: string; total_amount_cents: number };
type IssuedBooking = {
  reference: string;
  customer_full_name: string;
  total_amount_cents: number;
  passenger_count: number;
  created_at: string;
  trip_id?: string | null;
  issuer_name?: string;
  issuer_role?: string;
};

type Props = {
  ownerName: string;
  vesselName: string | null;
  boatId: string | null;
  todayTrips: TodayTripForCrew[];
  upcomingTrips: UpcomingTripForBooth[];
  selectedTripId: string | null;
  manifest: TripManifestData | null;
  pendingPayments: PendingItem[];
  issuedToday: IssuedBooking[];
  loggedInEmail: string;
  loggedInAddress: string;
  avatarUrl?: string | null;
};

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

const ISSUER_ROLE_BADGE: Record<string, string> = {
  ticket_booth: "bg-pink-100 text-pink-800",
  captain:      "bg-sky-100 text-sky-800",
  deck_crew:    "bg-orange-100 text-orange-800",
  admin:        "bg-purple-100 text-purple-800",
};
const ISSUER_ROLE_LABEL: Record<string, string> = {
  ticket_booth: "Booth",
  captain:      "Captain",
  deck_crew:    "Crew",
  admin:        "Admin",
};

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

// Safe client-only timestamp formatter — never called on server
function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

function getTodayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function TicketBoothDashboard({
  ownerName, vesselName, boatId,
  todayTrips, upcomingTrips,
  pendingPayments, issuedToday: issuedTodayProp,
  loggedInEmail, loggedInAddress,
  avatarUrl,
}: Props) {
  // ── mounted guard — nothing time-related renders on server ────────────────
  const [mounted, setMounted] = useState(false);
  const [nowString, setNowString] = useState("");

  useEffect(() => {
    setMounted(true);
    const format = () => new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila", weekday: "long", month: "long",
      day: "numeric", year: "numeric",
    });
    setNowString(format());
    const t = setInterval(() => setNowString(format()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Live issuedToday — refreshed after each ticket issue ──────────────────
  const [issuedToday, setIssuedToday] = useState<IssuedBooking[]>(issuedTodayProp);

  const refreshIssuedToday = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/issued-today", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setIssuedToday(data);
      }
    } catch {
      // Silently fall back to existing list — no console error spam
    }
  }, []);

  // ── Manifest state — keyed per trip to avoid stale data ───────────────────
  const [activeTripId, setActiveTripId]     = useState<string | null>(null);
  const [manifestData, setManifestData]     = useState<TripManifestData | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestError, setManifestError]   = useState<string | null>(null);

  const fetchManifest = useCallback(async (tripId: string) => {
    setManifestLoading(true);
    setManifestError(null);
    try {
      const res = await fetch(`/api/admin/trip-manifest?trip_id=${tripId}`, { cache: "no-store" });
      if (res.ok) {
        setManifestData(await res.json());
      } else {
        setManifestData(null);
        setManifestError("Could not load manifest.");
      }
    } catch {
      setManifestData(null);
      setManifestError("Network error loading manifest.");
    } finally {
      setManifestLoading(false);
    }
  }, []);

  const toggleManifest = useCallback((tripId: string) => {
    if (activeTripId === tripId) {
      setActiveTripId(null);
      setManifestData(null);
      setManifestError(null);
    } else {
      setActiveTripId(tripId);
      fetchManifest(tripId);
    }
  }, [activeTripId, fetchManifest]);

  // ── Issue ticket modal ────────────────────────────────────────────────────
  const [bookingTrip, setBookingTrip] = useState<UpcomingTripForBooth | null>(null);

  // After issuing a ticket: refresh manifest (if that trip is open) + issuedToday list
  const handleTicketIssued = useCallback(async (tripId: string) => {
    setBookingTrip(null);
    // Refresh the live issued-today list without a full page reload
    await refreshIssuedToday();
    // If this trip's manifest is currently open, refresh it too
    if (activeTripId === tripId) {
      await fetchManifest(tripId);
    } else {
      // Auto-open the manifest for the trip we just issued a ticket for
      setActiveTripId(tripId);
      await fetchManifest(tripId);
    }
  }, [activeTripId, fetchManifest, refreshIssuedToday]);

  const today = getTodayManila();

  // ── Manifest counts — scoped to the currently open manifest ──────────────
  const manifest = manifestData;
  const totalPax     = manifest?.totalPassengers ?? 0;
  const boardedCount = manifest?.passengers.filter(p => p.status === "boarded" || p.status === "completed").length ?? 0;
  const checkedIn    = manifest?.passengers.filter(p => p.status === "checked_in").length ?? 0;
  const confirmed    = manifest?.passengers.filter(p => p.status === "confirmed" || p.status === "pending_payment").length ?? 0;

  // ── Build a lookup: tripId → route label (for issuedToday trip column) ───
  const tripLabelMap = new Map<string, string>();
  for (const t of todayTrips) {
    const label = t.route?.display_name
      ?? [t.route?.origin, t.route?.destination].filter(Boolean).join(" → ")
      ?? "—";
    tripLabelMap.set(t.id, `${label} ${fmt12(t.departure_time)}`);
  }
  for (const t of upcomingTrips) {
    const label = t.route?.display_name
      ?? [t.route?.origin, t.route?.destination].filter(Boolean).join(" → ")
      ?? "—";
    tripLabelMap.set(t.id, `${label} ${fmt12(t.departure_time)} (${formatDate(t.departure_date)})`);
  }

  const tripsByDate = upcomingTrips.reduce<Record<string, UpcomingTripForBooth[]>>((acc, t) => {
    if (!acc[t.departure_date]) acc[t.departure_date] = [];
    acc[t.departure_date].push(t);
    return acc;
  }, {});

  if (!boatId || !vesselName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="rounded-2xl border-2 border-amber-200 bg-white p-10 shadow-lg text-center max-w-sm">
          <div className="text-5xl mb-4">🎫</div>
          <div className="text-xl font-bold text-[#134e4a]">Not assigned to a vessel yet</div>
          <div className="mt-3 text-sm text-[#0f766e]">Contact admin to get assigned.</div>
          <Link href={ROUTES.account}
            className="mt-6 inline-flex rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            My Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #C9EEE4 0%, #E1F5EE 40%, #f0fdfa 100%)" }}>
      <div className="h-1" style={{ background: "linear-gradient(90deg, #085C52, #0c7b93, #1AB5A3)" }} />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

        {/* ── Hero header ── */}
        <div className="rounded-2xl px-5 py-6 shadow-lg" style={{ backgroundColor: "#0c7b93" }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl border-2 border-white/30 overflow-hidden bg-white/20 flex items-center justify-center shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={ownerName} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 800 }}>
                    {ownerName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <div style={{ color: "#b2e4ef", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Ticket Booth</div>
                <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginTop: 2 }}>{ownerName}</div>
                <div style={{ color: "#d0f0f7", fontSize: 13, marginTop: 3 }}>
                  {/* Only render date string after mount to avoid hydration mismatch */}
                  {vesselName}{mounted && nowString ? ` · ${nowString}` : ""}
                </div>
              </div>
            </div>
            {/* Issued today counter */}
            <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Issued today</div>
              <div style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, marginTop: 2 }}>{issuedToday.length}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Today's trips",   value: String(todayTrips.length) },
              { label: "Pending confirm", value: String(pendingPayments.length), yellow: pendingPayments.length > 0 },
              { label: "Boarded",         value: String(boardedCount) },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                <div style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pending payments ── */}
        {pendingPayments.length > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="text-sm font-bold text-amber-900">Pending Payments — {pendingPayments.length}</div>
                <div className="text-xs text-amber-700 mt-0.5">Passengers waiting for confirmation</div>
              </div>
              <Link href={ROUTES.adminPendingPayments}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition-colors">
                Confirm →
              </Link>
            </div>
            <div className="space-y-2">
              {pendingPayments.slice(0, 3).map(b => (
                <div key={b.reference} className="flex items-center justify-between rounded-xl bg-white border border-amber-200 px-4 py-2.5">
                  <span className="font-mono text-sm font-semibold text-[#0c7b93]">{b.reference}</span>
                  <span className="text-sm text-[#134e4a]">{b.customer_full_name}</span>
                  <span className="font-bold text-amber-800">{peso(b.total_amount_cents)}</span>
                </div>
              ))}
              {pendingPayments.length > 3 && (
                <div className="text-xs text-amber-600 text-center">+{pendingPayments.length - 3} more</div>
              )}
            </div>
          </div>
        )}

        {/* ── Today's trips ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">
              Today&apos;s Trips — {vesselName}
            </span>
            <div className="h-px flex-1 bg-teal-200" />
          </div>

          {todayTrips.length === 0 ? (
            <div className="rounded-xl border border-teal-100 bg-white p-8 text-center text-sm text-[#0f766e]/60">
              No trips scheduled for {vesselName} today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayTrips.map((trip) => {
                const isActive  = activeTripId === trip.id;
                const routeName = trip.route?.display_name
                  ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ") ?? "—";
                const onlineSeatsLeft  = (trip.online_quota  ?? 0) - (trip.online_booked  ?? 0);
                const walkInSeatsLeft  = (trip.walk_in_quota ?? 0) - (trip.walk_in_booked ?? 0);
                const upcomingVersion = upcomingTrips.find(u => u.id === trip.id);
                // Only derive departed on client to avoid hydration mismatch
                const isDeparted = mounted ? trip.departed : false;

                // Count how many of today's issued tickets belong to this trip
                const issuedForThisTrip = issuedToday.filter(b => b.trip_id === trip.id).length;

                return (
                  <div key={trip.id}
                    className={`rounded-2xl border-2 transition-all ${
                      isActive ? "border-[#0c7b93] shadow-md bg-white"
                      : isDeparted ? "border-gray-100 bg-gray-50/50"
                      : "border-teal-200 bg-white shadow-sm"
                    }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-xl px-3 py-2 text-center min-w-[72px] ${isDeparted ? "bg-gray-100 text-gray-500" : "bg-[#0c7b93] text-white"}`}>
                            <div className="text-xs font-bold">{fmt12(trip.departure_time)}</div>
                          </div>
                          <div>
                            <div className="font-bold text-[#134e4a] text-sm">{routeName}</div>
                            <div className="text-xs text-[#0f766e] mt-0.5">{trip.boat?.name ?? vesselName}</div>
                            {issuedForThisTrip > 0 && (
                              <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                                {issuedForThisTrip} ticket{issuedForThisTrip !== 1 ? "s" : ""} issued today
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDeparted
                            ? <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs font-semibold">Departed</span>
                            : <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">Upcoming</span>
                          }
                          <span className="rounded-full bg-teal-50 text-[#0c7b93] border border-teal-200 px-2.5 py-0.5 text-xs font-semibold">
                            {onlineSeatsLeft} online left
                          </span>
                          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                            {walkInSeatsLeft} walk-in left
                          </span>
                          <button onClick={() => toggleManifest(trip.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                              isActive ? "bg-[#0c7b93] text-white" : "border border-teal-200 bg-teal-50 text-[#0c7b93] hover:bg-teal-100"
                            }`}>
                            {isActive ? "Hide manifest" : "View manifest"}
                          </button>
                          {/* Allow issuing tickets for today's trips regardless of departed status */}
                          {walkInSeatsLeft > 0 && (upcomingVersion || trip) && (
                            <button
                              onClick={() => setBookingTrip(upcomingVersion ?? (trip as unknown as UpcomingTripForBooth))}
                              className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
                              Issue Ticket
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Manifest panel ── */}
                      {isActive && (
                        <div className="mt-4 border-t border-teal-100 pt-4">
                          {manifestLoading ? (
                            <div className="text-center py-6 text-sm text-[#0f766e] animate-pulse">Loading manifest…</div>
                          ) : manifestError ? (
                            <div className="text-center py-4 text-sm text-red-500">
                              {manifestError}
                              <button onClick={() => fetchManifest(trip.id)} className="ml-2 underline text-[#0c7b93]">Retry</button>
                            </div>
                          ) : manifest ? (
                            <>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold">Confirmed: {confirmed}</span>
                                <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Checked in: {checkedIn}</span>
                                <span className="rounded-full bg-teal-600 text-white px-3 py-1 text-xs font-semibold">Boarded: {boardedCount}</span>
                                <span className="rounded-full bg-[#0c7b93] text-white px-3 py-1 text-xs font-semibold">Total: {totalPax}</span>
                                {/* Refresh button — lets booth staff manually refresh without reloading page */}
                                <button
                                  onClick={() => fetchManifest(trip.id)}
                                  className="rounded-full border border-teal-200 bg-white text-[#0c7b93] px-3 py-1 text-xs font-semibold hover:bg-teal-50 transition-colors"
                                >
                                  ↻ Refresh
                                </button>
                              </div>
                              {manifest.passengers.length === 0 ? (
                                <div className="text-sm text-[#0f766e]/60 text-center py-4">No passengers booked for this trip yet.</div>
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
                                      {manifest.passengers.map((p) => (
                                        <tr key={`${p.ticketNumber}-${p.seq}`}>
                                          <td className="px-3 py-2 text-[#134e4a]">{p.seq}</td>
                                          <td className="px-3 py-2 font-mono text-xs font-semibold text-[#0c7b93]">{p.ticketNumber}</td>
                                          <td className="px-3 py-2 font-medium text-[#134e4a]">{p.passengerName}</td>
                                          <td className="px-3 py-2 text-xs text-[#0f766e]">{p.source}</td>
                                          <td className="px-3 py-2">
                                            <ManifestStatusButton ticketNumber={p.ticketNumber} initialStatus={p.status} />
                                            {/* Safe: only rendered after mount */}
                                            {mounted && p.boardedAt && (
                                              <div className="text-xs text-gray-400 mt-0.5">{formatTimestamp(p.boardedAt)}</div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-[#0f766e]/60 text-center py-4">No passengers booked for this trip yet.</div>
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

        {/* ── Upcoming trips — collapsible by date ── */}
        {Object.keys(tripsByDate).filter(d => d > today).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-teal-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Upcoming Trips — Issue Ticket</span>
              <div className="h-px flex-1 bg-teal-200" />
            </div>
            <div className="space-y-2">
              {Object.entries(tripsByDate)
                .filter(([date]) => date > today)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, trips], idx) => (
                  <details key={date} open={idx < 2}>
                    <summary className="cursor-pointer rounded-xl border border-teal-200 bg-white shadow-sm overflow-hidden list-none">
                      <div className="flex items-center justify-between bg-teal-50 px-4 py-2.5 border-b border-teal-100">
                        <span className="text-xs font-bold text-[#0c7b93]">{formatDate(date)}</span>
                        <span className="text-xs text-[#0f766e]/60">{trips.length} trip{trips.length !== 1 ? "s" : ""} · tap to expand</span>
                      </div>
                    </summary>
                    <div className="rounded-b-xl border border-t-0 border-teal-200 bg-white divide-y divide-teal-50">
                      {trips.map(trip => {
                        const routeName = trip.route?.display_name
                          ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ") ?? "—";
                        const onlineSeatsLeft  = (trip.online_quota  ?? 0) - (trip.online_booked  ?? 0);
                        const walkInSeatsLeft  = (trip.walk_in_quota ?? 0) - (trip.walk_in_booked ?? 0);
                        const issuedForTrip = issuedToday.filter(b => b.trip_id === trip.id).length;
                        return (
                          <div key={trip.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-[#0c7b93] text-white px-3 py-1.5 text-xs font-bold min-w-[64px] text-center">
                                {fmt12(trip.departure_time)}
                              </div>
                              <div>
                                <div className="font-semibold text-[#134e4a] text-sm">{routeName}</div>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="text-xs text-[#0c7b93]">{onlineSeatsLeft} online left</span>
                                  <span className="text-xs text-amber-700">{walkInSeatsLeft} walk-in left</span>
                                </div>
                                {issuedForTrip > 0 && (
                                  <div className="text-xs text-emerald-700 font-semibold">
                                    {issuedForTrip} ticket{issuedForTrip !== 1 ? "s" : ""} issued today
                                  </div>
                                )}
                              </div>
                            </div>
                            {walkInSeatsLeft > 0 ? (
                              <button onClick={() => setBookingTrip(trip)}
                                className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                                Issue Ticket
                              </button>
                            ) : (
                              <span className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">Walk-in Full</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
            </div>
          </div>
        )}

        {/* ── Tickets issued today ── */}
        {issuedToday.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-teal-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Tickets Issued Today</span>
              <div className="h-px flex-1 bg-teal-200" />
            </div>

            {/* Per-staff subtotals — only shown when multiple staff issued tickets */}
            {(() => {
              const staffMap = new Map<string, { name: string; role: string; total: number; pax: number; count: number }>();
              for (const b of issuedToday) {
                const key = `${b.issuer_name ?? "Unknown"}::${b.issuer_role ?? "—"}`;
                if (!staffMap.has(key)) staffMap.set(key, { name: b.issuer_name ?? "Unknown", role: b.issuer_role ?? "—", total: 0, pax: 0, count: 0 });
                const s = staffMap.get(key)!;
                s.total += b.total_amount_cents;
                s.pax   += b.passenger_count;
                s.count += 1;
              }
              const staffList = Array.from(staffMap.values());
              if (staffList.length <= 1) return null;
              return (
                <div className="mb-3 rounded-xl border-2 border-teal-100 overflow-hidden">
                  <div className="bg-teal-50 px-4 py-2 border-b border-teal-100">
                    <span className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">Staff Breakdown — Today</span>
                  </div>
                  <div className="divide-y divide-teal-50">
                    {staffList.map(s => (
                      <div key={`${s.name}::${s.role}`} className="flex items-center justify-between px-4 py-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-black text-[#0c7b93]">
                            {s.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <span className="text-sm font-semibold text-[#134e4a]">{s.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ISSUER_ROLE_BADGE[s.role] ?? "bg-gray-100 text-gray-600"}`}>
                            {ISSUER_ROLE_LABEL[s.role] ?? s.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{s.pax} pax · {s.count} booking{s.count !== 1 ? "s" : ""}</span>
                          <span className="font-black text-[#0c7b93]">{peso(s.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="rounded-xl border border-teal-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm divide-y divide-teal-50">
                <thead>
                  <tr className="bg-teal-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Reference</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Passenger</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e] hidden sm:table-cell">Trip</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#0f766e]">Issued By</th>
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
                      <td className="px-4 py-2.5 text-xs text-[#0f766e] hidden sm:table-cell">
                        {b.trip_id ? (tripLabelMap.get(b.trip_id) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[#134e4a]">{b.issuer_name ?? "—"}</span>
                          {b.issuer_role && (
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${ISSUER_ROLE_BADGE[b.issuer_role] ?? "bg-gray-100 text-gray-600"}`}>
                              {ISSUER_ROLE_LABEL[b.issuer_role] ?? b.issuer_role}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#134e4a]">{b.passenger_count}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0c7b93]">{peso(b.total_amount_cents)}</td>
                      <td className="px-4 py-2.5 text-xs text-[#0f766e]">
                        {mounted ? formatTimestamp(b.created_at) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-teal-50/60 border-t-2 border-teal-200">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-[#134e4a]">Total issued today</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#134e4a]">
                      {issuedToday.reduce((s, b) => s + b.passenger_count, 0)} pax
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#0c7b93]">
                      {peso(issuedToday.reduce((s, b) => s + b.total_amount_cents, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Cash to Hand Over ── */}
        {boatId && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-teal-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">
                Cash to Hand Over — {vesselName}
              </span>
              <div className="h-px flex-1 bg-teal-200" />
            </div>
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4">
              <p className="text-xs text-amber-700 mb-3">
                Walk-in cash collected today that must be handed over to the vessel owner.
                Once you hand it over, the owner will confirm receipt on their dashboard.
              </p>
              <CashHandoverSummary
                boatId={boatId}
                vesselName={vesselName ?? ""}
                mode="booth"
                todayOnly={true}
              />
            </div>
          </div>
        )}

        {/* ── Revenue Summary ── */}
        {boatId && (
          <TicketBoothRevenueSummary boatId={boatId} vesselName={vesselName ?? ""} />
        )}

        {/* ── Quick links ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-teal-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Quick Links</span>
            <div className="h-px flex-1 bg-teal-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: ROUTES.adminPendingPayments, icon: Clock,     label: "Pending Payments", sub: "Confirm walk-ins"    },
              { href: ROUTES.adminBookings,        icon: BookOpen,  label: "Booking History",  sub: "All bookings"        },
              { href: ROUTES.crewScan,             icon: QrCode,    label: "Scan QR Ticket",   sub: "Verify passenger"    },
              { href: ROUTES.adminReports,         icon: BarChart3, label: "Reports",          sub: "Manifests & reports" },
              { href: ROUTES.account,              icon: User,      label: "My Account",       sub: "Profile & password"  },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 rounded-xl border-2 border-teal-100 bg-white/80 px-4 py-3 shadow-sm hover:border-[#0c7b93] hover:bg-white transition-all">
                <item.icon size={18} className="text-[#0c7b93] shrink-0" />
                <div>
                  <div className="text-sm font-bold text-[#134e4a]">{item.label}</div>
                  <div className="text-xs text-[#0f766e]">{item.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-[#0f766e]/40 pb-4">
          You can only issue tickets for {vesselName}. Contact admin to change vessel assignment.
        </div>
      </div>

      {/* ── Issue Ticket Modal ── */}
      {bookingTrip && (
        <IssueTicketModal
          trip={bookingTrip}
          loggedInEmail={loggedInEmail}
          loggedInAddress={loggedInAddress}
          onClose={() => setBookingTrip(null)}
          onSuccess={(tripId) => handleTicketIssued(tripId)}
        />
      )}
    </div>
  );
}

// ── Issue Ticket Modal ────────────────────────────────────────────────────────
function IssueTicketModal({ trip, loggedInEmail, loggedInAddress, onClose, onSuccess }: {
  trip: UpcomingTripForBooth;
  loggedInEmail: string;
  loggedInAddress: string;
  onClose: () => void;
  onSuccess: (tripId: string) => void;
}) {
  const routeName = trip.route?.display_name
    ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" → ") ?? "—";

  const [fullName,       setFullName]       = useState("");
  const [email,          setEmail]          = useState("");
  const [mobile,         setMobile]         = useState("");
  const [address,        setAddress]        = useState(loggedInAddress);
  const [fareType,       setFareType]       = useState("adult");
  const [passengerCount, setPassengerCount] = useState(1);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");

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
      if (!res.ok) {
        setError(data.error ?? "Booking failed.");
        return;
      }
      // Pass tripId back so the dashboard can refresh the right manifest
      onSuccess(trip.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-teal-100 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">Issue Walk-in Ticket</div>
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
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
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
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
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
          <div className="text-xs text-[#0f766e]/60 text-center">Walk-in cash booking — no GCash processing fee</div>
        </form>
      </div>
    </div>
  );
}
