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

/** Day label: Today, Tomorrow, or "Wed, Feb 12". Uses Philippines time for consistency with PHILIPPINES TIME display. */
export function getDayLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  if (dateStr === today) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  try {
    return new Date(dateStr + "Z").toLocaleDateString("en-PH", {
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
  try {
    return new Date(dateStr + "T12:00:00+08:00").toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
