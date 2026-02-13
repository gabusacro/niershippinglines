"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * When the dashboard is loaded with ?ref=XXX (e.g. after signup from guest booking),
 * calls the claim API to link that one booking to the current user, then removes ref from URL.
 */
export function ClaimBookingFromRef({ refParam }: { refParam: string | undefined }) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!refParam?.trim() || done) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/booking/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: refParam.trim() }),
        });
        if (cancelled) return;
        setDone(true);
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        params.delete("ref");
        const next = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        router.replace(next);
        if (res.ok) router.refresh();
      } catch {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refParam, router, done]);

  return null;
}
