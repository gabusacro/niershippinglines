"use client";

import { useState } from "react";
import ParkingQRScanner from "@/components/parking/ParkingQRScanner";
import { useRouter } from "next/navigation";

export default function ScanButton() {
  const [showScanner, setShowScanner] = useState(false);
  const [msg, setMsg]                 = useState<string | null>(null);
  const router = useRouter();

  async function handleScan(ref: string) {
    setShowScanner(false);
    setMsg(`🔍 Looking up ${ref}…`);
    try {
      const res = await fetch(`/api/admin/parking/checkin-lookup?q=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (data?.id) {
        // Redirect to admin checkin with the reference prefilled
        router.push(`/admin/parking/checkin?q=${encodeURIComponent(ref)}`);
      } else {
        setMsg(`No booking found for: ${ref}`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch {
      setMsg("Network error.");
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowScanner(true)}
        className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors"
      >
        📷 Scan QR
      </button>

      {msg && (
        <span className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80">
          {msg}
        </span>
      )}

      {showScanner && (
        <ParkingQRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </>
  );
}
