"use client";

import { useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type ScanResult = {
  booking_id: string;
  passenger_name: string;
};

export function CrewTicketScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const startScanner = () => {
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 5,
        qrbox: 250,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setResult({
          booking_id: decodedText,
          passenger_name: "Passenger",
        });

        scanner.clear();
        scannerRef.current = null;
        setScanning(false);
      },
      () => {}
    );

    scannerRef.current = scanner;
    setScanning(true);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Crew Ticket Scanner</h2>

      {!scanning ? (
        <button
          onClick={startScanner}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Start Scan
        </button>
      ) : (
        <button
          onClick={stopScanner}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Stop Scan
        </button>
      )}

      <div id="reader" className="mt-4" />

      {result && (
        <div className="mt-4 p-3 border rounded">
          <p><strong>Booking ID:</strong> {result.booking_id}</p>
          <p><strong>Name:</strong> {result.passenger_name}</p>
        </div>
      )}
    </div>
  );
}