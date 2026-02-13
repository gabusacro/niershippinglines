"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Refreshes the dashboard every N seconds so pending payments etc. stay up to date. Light on Supabase: one server render per interval (same as opening the page). */
export function DashboardAutoRefresh({ intervalSeconds = 90 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      router.refresh();
    }, intervalSeconds * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router, intervalSeconds]);

  return null;
}
