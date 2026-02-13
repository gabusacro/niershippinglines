"use client";

import { QRCodeSVG } from "qrcode.react";

/** Payload: NIER:ticketNumber (unique per passenger) or legacy NIER:reference:passengerIndex — crew scans via /api/crew/validate-ticket */
export function TicketQRCode({
  reference,
  passengerIndex,
  ticketNumber,
}: {
  reference: string;
  passengerIndex: number;
  ticketNumber?: string;
}) {
  const payload = ticketNumber?.trim() ? `NIER:${ticketNumber.trim()}` : `NIER:${reference}:${passengerIndex}`;
  return (
    <div className="mt-3 flex justify-center">
      <QRCodeSVG value={payload} size={120} level="M" includeMargin={false} />
    </div>
  );
}
