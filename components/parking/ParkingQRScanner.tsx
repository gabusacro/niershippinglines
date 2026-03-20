"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (reference: string) => void;
  onClose: () => void;
}

export default function ParkingQRScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [error, setError]   = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js";
    script.onload = () => { setLoaded(true); startCamera(); };
    script.onerror = () => setError("Failed to load scanner. Please type the reference manually.");
    document.head.appendChild(script);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Camera permission denied. Please allow camera access or type the reference manually.");
      }
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { document.head.removeChild(script); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    function tick() {
      const video = videoRef.current;
      // @ts-ignore
      const jsQR = window.jsQR;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && jsQR && ctx) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data?.trim()) {
          streamRef.current?.getTracks().forEach(t => t.stop());
          cancelAnimationFrame(animRef.current);
          onScan(code.data.trim());
          return;
        }
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [loaded, onScan]);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(0,0,0,0.85)" }}>
        <p className="text-white font-bold text-sm">📷 Scan Parking QR Code</p>
        <button onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 text-xl font-bold">
          ×
        </button>
      </div>

      {/* Camera feed */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Scan frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-60 h-60">
            <div className="absolute inset-0 border-2 border-white/20 rounded-2xl" />
            {/* Corner accents */}
            {([["top-0 left-0","rounded-tl-xl border-t-4 border-l-4"],["top-0 right-0","rounded-tr-xl border-t-4 border-r-4"],["bottom-0 left-0","rounded-bl-xl border-b-4 border-l-4"],["bottom-0 right-0","rounded-br-xl border-b-4 border-r-4"]] as [string,string][]).map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 border-[#0c7b93] ${cls}`} />
            ))}
            {/* Animated scan line */}
            <div className="absolute left-0 right-0 h-0.5 bg-[#0c7b93] opacity-80 rounded-full"
              style={{ animation: "scanline 1.8s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-6 left-4 right-4 rounded-xl bg-red-500/90 px-4 py-3 text-sm text-white font-semibold text-center">
            {error}
          </div>
        )}

        {/* Loading spinner */}
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
      </div>

      <div className="px-4 py-4 text-center" style={{ background: "rgba(0,0,0,0.85)" }}>
        <p className="text-white/70 text-xs">Point camera at passenger's QR code</p>
        <p className="text-white/40 text-xs mt-1">Or close and type the reference number manually</p>
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 10%; }
          50%  { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
