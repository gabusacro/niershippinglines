"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { formatTime } from "@/lib/dashboard/format";
import { getNowManilaString } from "@/lib/admin/ph-time";
import type { TodayTripForCrew } from "@/lib/dashboard/get-todays-trips-for-boats";
import type { TripManifestData } from "@/lib/admin/trip-manifest";
import { ManifestStatusButton } from "@/components/admin/ManifestStatusButton";

type Props = {
  roleLabel: string;
  todayTrips: TodayTripForCrew[];
  currentTrip: TodayTripForCrew | null;
  selectedTripId: string | null;
  manifest: TripManifestData | null;
  // Optional — pass from dashboard page if available
  avatarUrl?: string | null;
  ownerName?: string;
  vesselNames?: string[];
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

export function CrewCaptainManifestSection({
  roleLabel, todayTrips, currentTrip, selectedTripId, manifest,
  avatarUrl, ownerName, vesselNames = [],
}: Props) {
  const nowManila = getNowManilaString();
  const [activeTripId, setActiveTripId] = useState<string | null>(selectedTripId);

  const selectedTrip = todayTrips.find((t) => t.id === activeTripId) ?? currentTrip;
  const routeLabel = selectedTrip
    ? (selectedTrip.route?.display_name
        ?? [selectedTrip.route?.origin, selectedTrip.route?.destination].filter(Boolean).join(" ↔ ")
        ?? "—")
    : "—";
  const vesselName  = selectedTrip?.boat?.name ?? vesselNames[0] ?? "—";
  const departureTime = selectedTrip ? fmt12(selectedTrip.departure_time) : "—";

  const totalPax      = manifest?.totalPassengers ?? 0;
  const confirmedCount = manifest?.passengers.filter(p => p.status === "confirmed").length ?? 0;
  const checkedInCount = manifest?.passengers.filter(p => p.status === "checked_in").length ?? 0;
  const boardedCount   = manifest?.passengers.filter(p => p.status === "boarded" || p.status === "completed").length ?? 0;

  const initials = ownerName
    ? ownerName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : roleLabel[0]?.toUpperCase() ?? "C";

  const roleColor = roleLabel === "Captain"
    ? "#0c7b93"
    : roleLabel === "Deck crew" || roleLabel === "Crew"
    ? "#0f766e"
    : "#7c3aed";

  return (
    <div className="space-y-5">

      {/* ── Hero header ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-6 shadow-lg relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064E44 0%, #0c7b93 55%, #1AB5A3 100%)" }}
      >
        {/* Wave pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' viewBox='0 0 120 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q30 10 60 30 Q90 50 120 30' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
            backgroundSize: "120px 60px",
          }}
        />
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
              {vesselName}
              {vesselNames.length > 1 && ` · ${vesselNames.length} vessels`}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 border border-white/20"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span style={{ color: "#ffffff", fontSize: 12, fontWeight: 600 }}>{nowManila}</span>
            </div>
          </div>

          {/* Today's trips count pill */}
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
            { label: "Total Pax",   value: String(totalPax) },
            { label: "Confirmed",   value: String(confirmedCount) },
            { label: "Checked in",  value: String(checkedInCount), yellow: true },
            { label: "Boarded",     value: String(boardedCount) },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ color: s.yellow ? "#fde68a" : "#d0f0f7", fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Link href={ROUTES.crewScan}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
          📷 Scan QR Ticket
        </Link>
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

      {/* ── Trip selector ───────────────────────────────────────────────────── */}
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected trip info ──────────────────────────────────────────────── */}
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

      {/* ── Manifest table ──────────────────────────────────────────────────── */}
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

    </div>
  );
}
