"use client";

import { useState, useEffect, useCallback } from "react";
import { Banknote, CreditCard, ChevronDown, ChevronLeft, ChevronRight, X, Ship, Calendar } from "lucide-react";

interface DayBreakdownRow {
  departure_date: string;
  vessel_name: string;
  boat_id: string;
  passengers: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_cents: number;
}

interface FeeBreakdownResponse {
  rows: DayBreakdownRow[];
  total_platform_fee_cents: number;
  total_processing_fee_cents: number;
  total_passengers: number;
  start: string;
  end: string;
}

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-PH", { weekday: "short" }),
    date: d.getDate(),
  };
}

// ── Fee Breakdown Modal ───────────────────────────────────────────────────────
function FeeBreakdownModal({
  title, icon: Icon, accentColor, adminFeeLabel, gcashFeeLabel, onClose,
}: {
  title: string;
  icon: React.ElementType;
  accentColor: string;
  adminFeeLabel: string;
  gcashFeeLabel: string;
  onClose: () => void;
}) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState<FeeBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const { start, end } = getMonthRange(y, m);
    try {
      const res = await fetch(`/api/admin/fee-breakdown?start=${start}&end=${end}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const handleNextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const days = getDaysInMonth(year, month);
  const daysWithData = new Set((data?.rows ?? []).map(r => r.departure_date));

  // Rows to show — selected day or all days with data
  const filteredRows = selectedDay
    ? (data?.rows ?? []).filter(r => r.departure_date === selectedDay)
    : (data?.rows ?? []);

  // Group rows by date for the table
  const groupedByDate = filteredRows.reduce<Record<string, DayBreakdownRow[]>>((acc, r) => {
    if (!acc[r.departure_date]) acc[r.departure_date] = [];
    acc[r.departure_date].push(r);
    return acc;
  }, {});

  const totalPlatform   = filteredRows.reduce((s, r) => s + r.platform_fee_cents, 0);
  const totalProcessing = filteredRows.reduce((s, r) => s + r.processing_fee_cents, 0);
  const totalPax        = filteredRows.reduce((s, r) => s + r.passengers, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-teal-100 max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-teal-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentColor}`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <div className="font-black text-[#134e4a] text-base">{title}</div>
              <div className="text-xs text-[#0f766e]/60">Daily breakdown by vessel</div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-teal-50 bg-teal-50/40 shrink-0">
          <button type="button" onClick={handlePrevMonth}
            className="flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#0c7b93]" />
            <span className="text-sm font-bold text-[#134e4a]">{getMonthLabel(year, month)}</span>
          </div>
          <button type="button" onClick={handleNextMonth}
            className="flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-[#0c7b93] hover:bg-teal-50 transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>

        {/* Day selector — scrollable row */}
        <div className="px-4 py-3 border-b border-teal-50 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 min-w-max">
            {/* All days button */}
            <button type="button"
              onClick={() => setSelectedDay(null)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-bold transition-all min-w-[48px] border-2 ${
                selectedDay === null
                  ? "bg-[#0c7b93] border-[#0c7b93] text-white shadow-md"
                  : "border-teal-100 bg-white text-[#0f766e] hover:border-teal-300"
              }`}>
              <span className="text-[10px] font-semibold">ALL</span>
              <span className="text-base font-black leading-tight">—</span>
            </button>

            {days.map(day => {
              const { day: dayName, date } = formatDay(day);
              const hasData = daysWithData.has(day);
              const isSelected = selectedDay === day;
              return (
                <button key={day} type="button"
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`flex flex-col items-center px-2.5 py-2 rounded-xl text-xs transition-all min-w-[44px] border-2 ${
                    isSelected
                      ? "bg-[#0c7b93] border-[#0c7b93] text-white shadow-md"
                      : hasData
                      ? "border-teal-300 bg-teal-50 text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-100"
                      : "border-gray-100 bg-white text-gray-300 cursor-default"
                  }`}
                  disabled={!hasData && !isSelected}>
                  <span className="text-[10px] font-semibold uppercase">{dayName}</span>
                  <span className={`text-sm font-black leading-tight ${hasData && !isSelected ? "text-[#0c7b93]" : ""}`}>{date}</span>
                  {hasData && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-teal-50/30 border-b border-teal-100 shrink-0">
          {[
            { label: "Passengers",       value: String(totalPax) },
            { label: adminFeeLabel,      value: peso(totalPlatform) },
            { label: gcashFeeLabel,      value: peso(totalProcessing) },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white border border-teal-100 px-3 py-2 text-center">
              <div className="text-xs text-[#0f766e]/60 font-medium truncate">{s.label}</div>
              <div className="text-sm font-black text-[#134e4a] mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#0f766e] animate-pulse">
              Loading…
            </div>
          ) : Object.keys(groupedByDate).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Ship size={32} className="text-teal-200" />
              <div className="text-sm font-semibold text-[#134e4a]">No data for this period</div>
              <div className="text-xs text-[#0f766e]/50">
                {selectedDay ? "No bookings on this day" : "No confirmed bookings this month"}
              </div>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-teal-100 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#0f766e]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#0f766e]">Vessel</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#0f766e]">Pax</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#0f766e]">{adminFeeLabel}</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#0f766e]">{gcashFeeLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {Object.entries(groupedByDate).map(([date, rows]) => {
                  const dayPlatform   = rows.reduce((s, r) => s + r.platform_fee_cents, 0);
                  const dayProcessing = rows.reduce((s, r) => s + r.processing_fee_cents, 0);
                  const dayPax        = rows.reduce((s, r) => s + r.passengers, 0);
                  const { day: dayName, date: dayNum } = formatDay(date);
                  return (
                    <>
                      {/* Date subheader */}
                      <tr key={`header-${date}`} className="bg-teal-50/60">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#0c7b93]">{dayName} {dayNum}</span>
                              <span className="text-xs text-[#0f766e]/60">{date}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#0f766e]/70">
                              <span>{dayPax} pax</span>
                              <span className="font-semibold text-[#0c7b93]">{peso(dayPlatform + dayProcessing)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Vessel rows */}
                      {rows.map((r, i) => (
                        <tr key={`${date}-${r.boat_id}-${i}`} className="hover:bg-teal-50/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-[#0f766e]/50 pl-6">└</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Ship size={13} className="text-[#0c7b93] shrink-0" />
                              <span className="font-semibold text-[#134e4a] text-sm">{r.vessel_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#134e4a]">{r.passengers}</td>
                          <td className="px-4 py-3 text-right font-bold text-teal-700">{peso(r.platform_fee_cents)}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">{peso(r.processing_fee_cents)}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              {/* Grand total footer */}
              <tfoot>
                <tr className="bg-[#0c7b93]/5 border-t-2 border-[#0c7b93]/20">
                  <td colSpan={2} className="px-4 py-3 text-xs font-black text-[#134e4a] uppercase tracking-wide">
                    {selectedDay ? "Day Total" : "Month Total"}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#134e4a]">{totalPax}</td>
                  <td className="px-4 py-3 text-right font-black text-teal-700">{peso(totalPlatform)}</td>
                  <td className="px-4 py-3 text-right font-black text-blue-700">{peso(totalProcessing)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Fee Summary Cards (exported — drop into AdminSnapshotClient grid) ─────────
export function FeeBreakdownCards({
  platformFeeCents, processingFeeCents, adminFeeLabel, gcashFeeLabel,
}: {
  platformFeeCents: number;
  processingFeeCents: number;
  adminFeeLabel: string;
  gcashFeeLabel: string;
}) {
  const [modal, setModal] = useState<"platform" | "processing" | null>(null);

  return (
    <>
      {/* Platform Service Fee card */}
      <button type="button" onClick={() => setModal("platform")} className="w-full text-left">
        <div className="rounded-2xl border-2 border-teal-200 bg-white shadow-sm overflow-hidden hover:border-[#0c7b93] hover:shadow-md transition-all group">
          <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0 group-hover:bg-teal-200 transition-colors">
                <Banknote size={18} className="text-teal-700" />
              </div>
              <div>
                <div className="font-bold text-sm text-[#134e4a]">{adminFeeLabel}</div>
                <div className="text-xs text-[#0f766e]/60">Click to view daily breakdown</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-black text-teal-700">{peso(platformFeeCents)}</span>
              <ChevronDown size={14} className="text-gray-400 group-hover:text-[#0c7b93] transition-colors" />
            </div>
          </div>
        </div>
      </button>

      {/* Payment Processing Fee card */}
      <button type="button" onClick={() => setModal("processing")} className="w-full text-left">
        <div className="rounded-2xl border-2 border-blue-200 bg-white shadow-sm overflow-hidden hover:border-blue-500 hover:shadow-md transition-all group">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400" />
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                <CreditCard size={18} className="text-blue-700" />
              </div>
              <div>
                <div className="font-bold text-sm text-blue-900">{gcashFeeLabel}</div>
                <div className="text-xs text-blue-600/60">Click to view daily breakdown</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-black text-blue-700">{peso(processingFeeCents)}</span>
              <ChevronDown size={14} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      </button>

      {/* Modals */}
      {modal === "platform" && (
        <FeeBreakdownModal
          title={adminFeeLabel}
          icon={Banknote}
          accentColor="bg-teal-600"
          adminFeeLabel={adminFeeLabel}
          gcashFeeLabel={gcashFeeLabel}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "processing" && (
        <FeeBreakdownModal
          title={gcashFeeLabel}
          icon={CreditCard}
          accentColor="bg-blue-600"
          adminFeeLabel={adminFeeLabel}
          gcashFeeLabel={gcashFeeLabel}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
