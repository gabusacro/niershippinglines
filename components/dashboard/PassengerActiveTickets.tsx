"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Ship, Calendar, Clock, Tag, Users, QrCode, Info, Printer, FileText, ArrowRight } from "lucide-react";
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

        if (!dateStr) return true;

        try {
          const timeComponent = timeStr ? timeStr.trim().slice(0, 5) : "00:00";
          const depManila = new Date(`${dateStr}T${timeComponent}:00+08:00`);
          if (Number.isNaN(depManila.getTime())) return true;
          const hideAfter = new Date(depManila.getTime() + 6 * 60 * 60 * 1000);
          return current < hideAfter;
        } catch {
          return true;
        }
      });

      setVisibleTickets(filtered);
    };

    computeVisible();
    const interval = setInterval(computeVisible, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tickets]);

  const displayTickets = mounted ? visibleTickets : tickets;
  if (displayTickets.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(5,150,105,0.2)]" />
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-800">
            Active Tickets — Ready to Board
          </span>
        </div>
        <span className="text-xs font-semibold text-emerald-600">
          {displayTickets.length} ticket{displayTickets.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="px-5 pt-3 pb-2 text-xs text-emerald-700">
        Show your QR code at the ticket booth when boarding. Tickets shown here up to 6 hours after departure.
      </p>

      <ul className="space-y-3 px-4 pb-4">
        {displayTickets.map((b) => {
          const depDate = b.trip_snapshot_departure_date;
          const depTime = b.trip_snapshot_departure_time;

          // Format date — safe, no toLocaleDateString
          let depDateLabel = "";
          if (depDate) {
            try {
              const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const d = new Date(depDate + "T00:00:00+08:00");
              depDateLabel = `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
            } catch {
              depDateLabel = depDate;
            }
          }

          // Format time — safe
          let depTimeLabel = "";
          if (depTime) {
            try {
              const [h, m] = depTime.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              depTimeLabel = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
            } catch { /* skip */ }
          }

          // Departed status (only after mount)
          let isDeparted = false;
          if (depDate && mounted && now) {
            try {
              const timeComponent = depTime ? depTime.slice(0, 5) : "00:00";
              const depManila = new Date(`${depDate}T${timeComponent}:00+08:00`);
              isDeparted = now >= depManila;
            } catch { /* skip */ }
          }

          const refundBadge =
            b.refund_status === "pending"      ? { label: "Refund pending",      cls: "bg-amber-100 text-amber-800"    } :
            b.refund_status === "under_review" ? { label: "Refund under review", cls: "bg-blue-100 text-blue-800"      } :
            b.refund_status === "approved"     ? { label: "Refund approved",     cls: "bg-emerald-100 text-emerald-800" } :
            b.refund_status === "processed"    ? { label: "Refunded",            cls: "bg-teal-100 text-teal-800"       } :
            b.refund_status === "rejected"     ? { label: "Refund rejected",     cls: "bg-red-100 text-red-800"         } :
            null;

          return (
            <li key={b.id} className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
              {/* Departure status bar */}
              <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 ${
                isDeparted
                  ? "bg-slate-100 text-slate-600"
                  : "bg-emerald-600 text-white"
              }`}>
                {isDeparted ? (
                  <>
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    Departed — boarding window open
                  </>
                ) : (
                  <>
                    <Ship className="h-3.5 w-3.5 flex-shrink-0" />
                    Upcoming departure
                  </>
                )}
              </div>

              <div className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    {/* Reference */}
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-[#0c7b93] flex-shrink-0" />
                      <span className="font-mono text-sm font-bold text-[#0c7b93] tracking-wide">
                        {b.reference}
                      </span>
                    </div>
                    {/* Route */}
                    {b.trip_snapshot_route_name && (
                      <div className="flex items-center gap-1.5">
                        <Ship className="h-3.5 w-3.5 text-[#134e4a] flex-shrink-0" />
                        <span className="text-sm font-semibold text-[#134e4a]">
                          {b.trip_snapshot_route_name}
                        </span>
                      </div>
                    )}
                    {/* Date */}
                    {depDateLabel && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#6B8886] flex-shrink-0" />
                        <span className="text-xs text-[#6B8886]">{depDateLabel}</span>
                        {depTimeLabel && (
                          <>
                            <span className="text-[#6B8886] opacity-40">·</span>
                            <Clock className="h-3.5 w-3.5 text-[#6B8886] flex-shrink-0" />
                            <span className="text-xs text-[#6B8886]">{depTimeLabel}</span>
                          </>
                        )}
                      </div>
                    )}
                    {/* Passengers */}
                    {b.passenger_count && b.passenger_count > 1 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#6B8886] flex-shrink-0" />
                        <span className="text-xs text-[#6B8886]">{b.passenger_count} passengers</span>
                      </div>
                    )}
                  </div>

                  {/* Refund badge */}
                  {refundBadge && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${refundBadge.cls}`}>
                      {refundBadge.label}
                    </span>
                  )}
                </div>

                {/* Action buttons — always visible */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* QR Button */}
                  <Link
                    href={`/dashboard/bookings/${b.reference}/tickets`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
                    Show QR Ticket
                  </Link>

                  {/* Details Button */}
                  <Link
                    href={`/dashboard/bookings/${b.reference}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border-[1.5px] border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5 flex-shrink-0" />
                    Details
                  </Link>

                  {/* Print Button */}
                  <PrintTicketsTrigger
                    reference={b.reference}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border-[1.5px] border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5 flex-shrink-0" />
                    Print tickets
                  </PrintTicketsTrigger>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer link */}
      <div className="px-4 pb-4">
        <Link
          href="/dashboard/bookings"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 border-[1.5px] border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors w-full"
        >
          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
          View all bookings
          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
