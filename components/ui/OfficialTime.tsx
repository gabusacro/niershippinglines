"use client";

import { useState, useEffect } from "react";

const MANILA_TZ = "Asia/Manila";

/**
 * Live clock in Philippines time (Asia/Manila). Use as the single reference for boarding and operations.
 */
export function OfficialTime() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const format = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-PH", {
          timeZone: MANILA_TZ,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setDate(
        now.toLocaleDateString("en-PH", {
          timeZone: MANILA_TZ,
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };
    format();
    const interval = setInterval(format, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col items-end justify-center text-white/95"
      title="Official time for boarding. Captains and passengers follow this time."
    >
      <span className="text-xs font-medium uppercase tracking-wider text-white/80">Philippines time</span>
      <span className="font-mono text-sm font-semibold tabular-nums md:text-base" aria-live="polite">
        {time}
      </span>
      <span className="text-xs text-white/80">{date}</span>
    </div>
  );
}
