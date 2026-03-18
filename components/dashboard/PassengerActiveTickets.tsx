"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PrintTicketsTrigger } from "@/components/tickets/PrintTicketsTrigger";

type ActiveTicket = {
  id: string;
  reference: string;
  trip_snapshot_departure_date: string | null;
  trip_snapshot_departure_time: string | null;
  trip_snapshot_route_name?: string | null;
  refund_status?: string | null;
  passenger_count?: number;
};

type Props = {
  tickets: ActiveTicket[];
};

/**
 * Shows confirmed tickets that are upcoming OR departed within the last 6 hours.
 * After 6 hours from departure, the ticket disappears from dashboard
 * (but remains accessible via My Bookings).
 *
 * All time logic runs client-side only (inside useEffect) to avoid
 * hydration mismatches — no server/client date conflict.
 */
export function PassengerActiveTickets({ tickets }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visibleTickets, setVisibleTickets] = useState<ActiveTicket[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);

    const computeVisible = () => {
      const current = new Date();
      setNow(current);

      const filtered = tickets.filter((t) => {
        const dateStr = t.trip_snapshot_departure_date;
        const timeStr = t.trip_snapshot_departure_time;

        // If no departure info, always show (safe fallback)
        if (!dateStr) return true;

        try {
          const timeComponent = timeStr ? timeStr.trim().slice(0, 5) : "00:00";
          const depManila = new Date(`${dateStr}T${timeComponent}:00+08:00`);
          // If date is invalid/unparseable → SHOW the ticket (safe fallback).
          // NOTE: ph-time.ts returns true (hide) on NaN — we do the opposite here
          // because hiding a valid ticket is worse than showing an old one.
          if (Number.isNaN(depManila.getTime())) return true;
          const hideAfter = new Date(depManila.getTime() + 6 * 60 * 60 * 1000);
          return current < hideAfter;
        } catch {
          return true; // Safe fallback: show if parsing fails
        }
      });

      setVisibleTickets(filtered);
    };

    computeVisible();
    // Re-check every 5 minutes so tickets auto-disappear without page reload
    const interval = setInterval(computeVisible, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tickets]);

  // Before mount: show all tickets passed in (already server-pre-filtered by 6hr rule).
  // After mount: switch to client-filtered list (re-checks time in real time).
  // This prevents the "blank on first load" problem while keeping hydration safe.
  const displayTickets = mounted ? visibleTickets : tickets;
  if (displayTickets.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(5,150,105,0.2)]" />
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-800">
            ✅ Active Tickets — Ready to Board
          </span>
        </div>
        <span className="text-xs text-emerald-600 font-medium">
          {displayTickets.length} ticket{displayTickets.length !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="mb-3 text-xs text-emerald-700">
        Show your QR code at the ticket booth when boarding. Tickets shown here up to 6 hours after departure.
      </p>
      <ul className="space-y-3">
        {displayTickets.map((b) => {
          const depDate = b.trip_snapshot_departure_date;
          const depTime = b.trip_snapshot_departure_time;

          // Format departure nicely
          let depLabel = "";
          if (depDate) {
            try {
              depLabel = new Date(depDate + "T00:00:00+08:00").toLocaleDateString("en-PH", {
                weekday: "short", month: "short", day: "numeric",
              });
            } catch { depLabel = depDate; }
          }
          if (depTime) {
            try {
              const [h, m] = depTime.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              depLabel += ` · ${h12}:${String(m).padStart(2, "0")} ${ampm}`;
            } catch { /* skip */ }
          }

          // Check if departed (for "boarding window" indicator)
          let isDeparted = false;
          // Only compute departed status after mount (now is available)
          if (depDate && mounted && now) {
            try {
              const timeComponent = depTime ? depTime.slice(0, 5) : "00:00";
              const depManila = new Date(`${depDate}T${timeComponent}:00+08:00`);
              isDeparted = now >= depManila;
            } catch { /* skip */ }
          }

          const refundBadge =
            b.refund_status === "pending"      ? { emoji: "⏳", label: "Refund pending",      color: "bg-amber-100 text-amber-800"    } :
            b.refund_status === "under_review" ? { emoji: "🔍", label: "Refund under review", color: "bg-blue-100 text-blue-800"      } :
            b.refund_status === "approved"     ? { emoji: "✅", label: "Refund approved",     color: "bg-emerald-100 text-emerald-800" } :
            b.refund_status === "processed"    ? { emoji: "💸", label: "Refunded",            color: "bg-teal-100 text-teal-800"       } :
            b.refund_status === "rejected"     ? { emoji: "❌", label: "Refund rejected",     color: "bg-red-100 text-red-800"         } :
            null;

          return (
            <li key={b.id} className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
              {/* Departure status bar */}
              <div className={`px-4 py-1.5 text-xs font-semibold flex items-center gap-2 ${
                isDeparted
                  ? "bg-gray-100 text-gray-600"
                  : "bg-emerald-600 text-white"
              }`}>
                {isDeparted ? (
                  <><span className="animate-pulse">⏱</span> Departed — boarding window open</>
                ) : (
                  <><span>🚢</span> Upcoming departure</>
                )}
              </div>

              <div className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-bold text-[#0c7b93]">{b.reference}</div>
                    {b.trip_snapshot_route_name && (
                      <div className="text-xs font-semibold text-[#134e4a] mt-0.5">{b.trip_snapshot_route_name}</div>
                    )}
                    {depLabel && (
                      <div className="text-xs text-[#6B8886] mt-0.5">{depLabel}</div>
                    )}
                    {b.passenger_count && b.passenger_count > 1 && (
                      <div className="text-xs text-[#6B8886]">{b.passenger_count} passengers</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {refundBadge && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${refundBadge.color}`}>
                        {refundBadge.emoji} {refundBadge.label}
                      </span>
                    )}
  
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href={`/dashboard/bookings/${b.reference}/tickets`}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                  >
                    📱 Show QR Ticket
                  </Link>
                  <Link
                    href={`/dashboard/bookings/${b.reference}`}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    View Details
                  </Link>
                  <PrintTicketsTrigger reference={b.reference} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        href="/dashboard/bookings"
        className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
      >
        View all bookings →
      </Link>
    </div>
  );
}
