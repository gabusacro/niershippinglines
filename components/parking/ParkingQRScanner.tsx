"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onScan: (ref: string) => void;
  onClose: () => void;
};

export default function ParkingQRScanner({ onScan, onClose }: Props) {
  const [scanning,  setScanning]  = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [manualRef, setManualRef] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  // ── Dynamically import Html5Qrcode only in browser — fixes Next.js SSR crash
  const initScanner = useCallback(() => {
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          const qrboxSize = Math.min(260, typeof window !== "undefined" ? window.innerWidth - 48 : 240);
          const html5QrCode = new Html5Qrcode("parking-qr-reader");
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: "environment" },
              { fps: 4, qrbox: { width: qrboxSize, height: qrboxSize }, aspectRatio: 1.0 },
              (decodedText: string) => {
                html5QrCode.stop().catch(() => {});
                setScanning(false);
                setStarting(false);
                onScan(decodedText.trim());
              },
              () => {}
            )
            .then(() => { setStarting(false); setScanning(true); })
            .catch((err: unknown) => {
              setStarting(false);
              setScanning(false);
              scannerRef.current = null;
              setError("Camera error: " + (err instanceof Error ? err.message : String(err)));
            });
        })
        .catch((err: unknown) => {
          setStarting(false);
          setScanning(false);
          const msg = err instanceof Error ? err.message : String(err);
          if (/denied|not allowed|permission/i.test(msg)) {
            setError("Camera permission denied. Allow camera access in your browser, then try again.");
          } else {
            setError("Could not access camera: " + msg);
          }
        });
    }).catch(() => {
      setStarting(false);
      setError("Scanner library failed to load. Please refresh and try again.");
    });
  }, [onScan]);

  // ── Double rAF so the div is mounted before Html5Qrcode tries to attach ──
  useEffect(() => {
    if (!starting) return;
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => { initScanner(); });
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, [starting, initScanner]);

  const startScan = useCallback(() => { setError(null); setStarting(true); }, []);

  const stopScan = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
    setStarting(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  function handleManualSubmit() {
    const val = manualRef.trim().toUpperCase();
    if (!val) return;
    setManualRef("");
    stopScan();
    onScan(val);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { stopScan(); onClose(); } }}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 shrink-0 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-bold uppercase">Parking</p>
            <h2 className="text-lg font-black text-white">🔍 Scan Parking QR</h2>
          </div>
          <button onClick={() => { stopScan(); onClose(); }}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {error && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
              {error}
            </div>
          )}

          {!scanning && !starting && (
            <button type="button" onClick={startScan}
              className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
              📷 Open Camera &amp; Scan QR
            </button>
          )}

          {starting && (
            <div className="flex items-center justify-center rounded-xl border-2 border-teal-200 bg-teal-50 py-8">
              <p className="text-sm text-[#0f766e] animate-pulse">Starting camera…</p>
            </div>
          )}

          {(scanning || starting) && (
            <div className="space-y-3">
              <div id="parking-qr-reader"
                className="w-full overflow-hidden rounded-xl border-2 border-teal-300"
                style={{ minHeight: 300 }} />
              {scanning && (
                <button type="button" onClick={stopScan}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Stop scanning
                </button>
              )}
            </div>
          )}

          {/* Manual entry */}
          <div className="rounded-xl border-2 border-teal-100 bg-teal-50/50 p-4">
            <p className="text-xs font-bold text-[#0f766e] uppercase tracking-wide mb-2">
              Or Enter Reference Manually
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value.toUpperCase())}
                placeholder="e.g. TRV-PRK-YCXANB"
                className="flex-1 rounded-xl border-2 border-teal-200 bg-white px-3 py-2.5 text-sm text-[#134e4a] placeholder:text-gray-400 focus:border-[#0c7b93] focus:outline-none uppercase"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
              />
              <button type="button" onClick={handleManualSubmit}
                disabled={!manualRef.trim()}
                className="rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
                Search
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[#0f766e]/60">
              Press Enter or tap Search. Works with parking reference numbers.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
