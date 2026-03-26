"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  reference: string;
  status: string;
}

export default function ParkingQRCode({ reference, status }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const showQR = ["confirmed", "checked_in", "overstay"].includes(status);

  useEffect(() => {
    if (!showQR || !containerRef.current) return;

    // Clear any previous render
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => {
      if (!containerRef.current) return;
      // @ts-ignore
      new window.QRCode(containerRef.current, {
        text: reference,
        width: 220,
        height: 220,
        colorDark: "#134e4a",
        colorLight: "#ffffff",
        correctLevel: 2,
      });
      setQrReady(true);
    };
    script.onerror = () => console.error("QRCode library failed to load");
    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch {}
    };
  }, [reference, showQR]);

  function handleDownload() {
  setDownloading(true);
  try {
    const qrCanvas = containerRef.current?.querySelector("canvas");
    if (!qrCanvas) { setDownloading(false); return; }

    const final = document.createElement("canvas");
    final.width = 300;
    final.height = 360;
    const ctx = final.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 300, 360);

    // Wait for the QR canvas to be fully painted before copying
    setTimeout(() => {
      ctx.drawImage(qrCanvas, 40, 20, 220, 220);

      ctx.fillStyle = "#134e4a";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(reference, 150, 268);

      ctx.fillStyle = "#0f766e";
      ctx.font = "12px sans-serif";
      ctx.fillText("Travela Parking", 150, 290);
      ctx.fillText("Show to crew on arrival", 150, 308);

      const link = document.createElement("a");
      link.download = `parking-qr-${reference}.png`;
      link.href = final.toDataURL("image/png");
      link.click();
      setDownloading(false);
    }, 100);
  } catch {
    setDownloading(false);
  }
}

  if (!showQR) return null;

  return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden">
      <div className="bg-teal-50 px-5 py-3 border-b border-teal-100">
        <h2 className="text-sm font-black text-[#134e4a]">📱 Your Parking QR Code</h2>
        <p className="text-xs text-gray-400 mt-0.5">Show this to crew on arrival — they will scan it to check you in.</p>
      </div>
      <div className="p-5 flex flex-col items-center gap-4">

        {/* QR container — QRCode lib injects canvas here */}
        <div className="rounded-2xl border-2 border-teal-100 p-4 bg-white shadow-sm flex items-center justify-center" style={{ minWidth: 252, minHeight: 252 }}>
          {!qrReady && (
            <div className="w-10 h-10 rounded-full border-2 border-teal-200 border-t-[#0c7b93] animate-spin" />
          )}
          <div ref={containerRef} style={{ display: qrReady ? "block" : "none" }} />
        </div>

        {/* Reference */}
        <div className="text-center">
          <p className="font-mono font-black text-[#0c7b93] text-lg tracking-wider">{reference}</p>
          <p className="text-xs text-gray-400 mt-0.5">Parking reference number</p>
        </div>

        {/* Instructions */}
        <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800 space-y-1">
          <p className="font-semibold">📋 On arrival:</p>
          <p>• Show this QR code to the parking crew</p>
          <p>• Bring your original OR/CR and government ID</p>
          <p>• Crew will scan and confirm your slot</p>
        </div>

        {/* Download */}
        {qrReady && (
          <button onClick={handleDownload} disabled={downloading}
            className="w-full rounded-xl border-2 border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors disabled:opacity-50">
            {downloading ? "Preparing…" : "⬇ Save QR Code as Image"}
          </button>
        )}
      </div>
    </div>
  );
}
