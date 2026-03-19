"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Payload: TRAVELA:ticketNumber (unique per passenger)
 * or legacy TRAVELA:reference:passengerIndex
 *
 * Old tickets are still accepted by the scanner for backward compatibility.
 * All new tickets use TRAVELA: prefix.
 */
export function TicketQRCode({
  reference,
  passengerIndex,
  ticketNumber,
}: {
  reference: string;
  passengerIndex: number;
  ticketNumber?: string;
}) {
  const payload = ticketNumber?.trim()
    ? `TRAVELA:${ticketNumber.trim()}`
    : `TRAVELA:${reference}:${passengerIndex}`;

  return (
    <div className="mt-3 flex justify-center">
      <QRCodeSVG value={payload} size={120} level="M" includeMargin={false} />
    </div>
  );
}
