const MANILA_TZ = "Asia/Manila";

/** Today's date string (YYYY-MM-DD) in Philippines time. Use for Supabase queries. */
export function getTodayInManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: MANILA_TZ });
}

/** Start and end of current week in Manila (Monday–Sunday), YYYY-MM-DD. */
export function getWeekStartEndInManila(): { start: string; end: string } {
  const today = getTodayInManila();
  const d = new Date(today + "T12:00:00+08:00");
  const dayOfWeek = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: MANILA_TZ });
  return { start: fmt(monday), end: fmt(sunday) };
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

/**
 * True if the trip has already departed (departure date+time is in the past, Philippines time).
 * Use to hide departed trips from dashboard, manual booking, crew views.
 */
export function isTripDeparted(departureDate: string, departureTime: string): boolean {
  const timePart = String(departureTime).trim().slice(0, 8);
  const iso = `${departureDate}T${timePart}`;
  const tripDep = new Date(`${iso}+08:00`);
  if (Number.isNaN(tripDep.getTime())) return true;
  return tripDep.getTime() < Date.now();
}

/**
 * True if departure + hours has passed (Philippines time).
 * Use to hide "tickets ready" banner: e.g. 6 hours after departure, ticket is consumed.
 * - departureDate: YYYY-MM-DD
 * - departureTime: HH:MM or HH:MM:SS (local Manila)
 */
export function isDeparturePlusHoursInPast(
  departureDate: string,
  departureTime: string,
  hours: number
): boolean {
  const timePart = String(departureTime).trim().slice(0, 8);
  const iso = `${departureDate}T${timePart}`;
  const tripDep = new Date(`${iso}+08:00`);
  if (Number.isNaN(tripDep.getTime())) return true;
  const cutoff = tripDep.getTime() + hours * 60 * 60 * 1000;
  return cutoff < Date.now();
}

/**
 * True if departure is at least 24 hours from now (Philippines time).
 * Use for reschedule policy: changes only allowed 24+ hours before departure.
 */
export function isDepartureAtLeast24HoursFromNow(
  departureDate: string,
  departureTime: string
): boolean {
  const timePart = String(departureTime).trim().slice(0, 8);
  const iso = `${departureDate}T${timePart}`;
  const tripDep = new Date(`${iso}+08:00`);
  if (Number.isNaN(tripDep.getTime())) return false;
  const cutoff = Date.now() + 24 * 60 * 60 * 1000;
  return tripDep.getTime() >= cutoff;
}
