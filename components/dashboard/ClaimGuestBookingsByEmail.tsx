"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * When a passenger loads the dashboard, claim any guest bookings whose customer_email
 * matches their account email (so bookings made before signup appear in My bookings).
 */
export function ClaimGuestBookingsByEmail() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/booking/claim-by-email", { method: "POST" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.claimed > 0) router.refresh();
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
