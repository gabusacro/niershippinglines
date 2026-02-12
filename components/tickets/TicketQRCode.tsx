"use client";

import { QRCodeSVG } from "qrcode.react";

/** Format: NIER:reference:passengerIndex — crew scans and validates via /api/crew/validate-ticket */
export function TicketQRCode({ reference, passengerIndex }: { reference: string; passengerIndex: number }) {
  const payload = `NIER:${reference}:${passengerIndex}`;
  return (
    <div className="mt-3 flex justify-center">
      <QRCodeSVG value={payload} size={120} level="M" includeMargin={false} />
    </div>
  );
}
