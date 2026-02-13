"use client";

import { useState } from "react";
import { PrintTicketsModal } from "./PrintTicketsModal";

interface PrintTicketsTriggerProps {
  reference: string;
  passengerCount?: number;
  className?: string;
  children?: React.ReactNode;
  siteName?: string;
}

export function PrintTicketsTrigger({
  reference,
  passengerCount,
  className = "inline-flex min-h-[44px] items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors",
  children,
  siteName,
}: PrintTicketsTriggerProps) {
  const [open, setOpen] = useState(false);

  const label =
    children ??
    (passengerCount != null && passengerCount > 0
      ? `Print tickets (${passengerCount} passenger${passengerCount !== 1 ? "s" : ""}) →`
      : "Print tickets →");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </button>
      <PrintTicketsModal
        reference={reference}
        open={open}
        onClose={() => setOpen(false)}
        siteName={siteName}
      />
    </>
  );
}
