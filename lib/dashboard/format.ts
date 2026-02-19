/** Format DB time "HH:MM:SS" to "H:MM AM/PM" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m || "00"} ${am ? "AM" : "PM"}`;
}

/** Display label for passenger fare type (Adult, Senior, PWD, Child, Infant (<7)) */
export function passengerTypeLabel(fareType: string | null | undefined): string {
  if (!fareType) return "—";
  const labels: Record<string, string> = {
    adult: "Adult",
    senior: "Senior",
    pwd: "PWD",
    child: "Child",
    infant: "Infant (<7)",
  };
  return labels[fareType.toLowerCase()] ?? fareType.charAt(0).toUpperCase() + fareType.slice(1).toLowerCase();
}

/** Parse YYYY-MM-DD to a Date at noon UTC (avoids timezone/NaN on mobile). Returns null if invalid. */
export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m, d));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) return null;
  return date;
}

/** Day-of-month number (1–31) from YYYY-MM-DD, or null if invalid. Use for calendar tiles. */
export function getDayOfMonth(dateStr: string | null | undefined): number | null {
  const date = parseDateString(dateStr);
  return date ? date.getUTCDate() : null;
}

/** Day label: Today, Tomorrow, or "Wed, Feb 12". Uses Philippines time for consistency with PHILIPPINES TIME display. */
export function getDayLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  if (dateStr === today) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  const date = parseDateString(dateStr);
  if (!date) return String(dateStr || "—");
  try {
    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Always show explicit date (e.g. "Sat, Feb 14") so dropdowns don't repeat "Tomorrow" for many trips on the same day. Uses Philippines date. */
export function getDayLabelExplicit(dateStr: string): string {
  const date = parseDateString(dateStr);
  if (!date) return dateStr;
  try {
    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
