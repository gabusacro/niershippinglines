const MANILA_TZ = "Asia/Manila";

/** Today's date string (YYYY-MM-DD) in Philippines time. Use for Supabase queries. */
export function getTodayInManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: MANILA_TZ });
}

/** Start and end of current month in Manila (YYYY-MM-DD). */
export function getMonthStartEndInManila(): { start: string; end: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const start = `${year}-${month}-01`;
  const lastDate = new Date(y, m, 0).getDate();
  const end = `${year}-${month}-${String(lastDate).padStart(2, "0")}`;
  return { start, end };
}

/** Current date/time string in Philippines for display (e.g. "10 Feb 2026, 3:45 PM PST"). */
export function getNowManilaString(): string {
  return new Date().toLocaleString("en-PH", {
    timeZone: MANILA_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Minutes from now that a trip must depart to allow time to pay and board (Philippines time). */
export const BOOKING_CUTOFF_MINUTES = 30;

/**
 * True if the trip departs at least BOOKING_CUTOFF_MINUTES from now in Philippines time.
 * Use for passenger booking: only show/allow trips that give enough time to transact and board.
 * - departureDate: YYYY-MM-DD
 * - departureTime: HH:MM or HH:MM:SS (local Manila)
 */
export function isTripDepartureAtLeast30MinFromNow(
  departureDate: string,
  departureTime: string
): boolean {
  const timePart = String(departureTime).trim().slice(0, 8);
  const iso = `${departureDate}T${timePart}`;
  const tripDep = new Date(`${iso}+08:00`);
  if (Number.isNaN(tripDep.getTime())) return false;
  const cutoff = Date.now() + BOOKING_CUTOFF_MINUTES * 60 * 1000;
  return tripDep.getTime() >= cutoff;
}
