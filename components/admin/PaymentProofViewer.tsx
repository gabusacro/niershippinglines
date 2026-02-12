"use client";

import { useState } from "react";

export function PaymentProofViewer({
  proofUrl,
  isPdf,
  thumbnailClassName,
  label = "Payment proof",
}: {
  proofUrl: string;
  isPdf?: boolean;
  thumbnailClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (isPdf) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 inline-flex items-center rounded-lg border-2 border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:border-amber-500"
        >
          View PDF →
        </button>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Payment proof"
          >
            <div
              className="relative h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-2 text-[#134e4a] shadow hover:bg-white"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <iframe src={proofUrl} title={label} className="h-full w-full" />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-block rounded-lg border-2 border-amber-300 bg-white p-1 hover:border-amber-500"
      >
        <img
          src={proofUrl}
          alt={label}
          className={thumbnailClassName ?? "h-24 w-auto max-w-[160px] rounded object-contain"}
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div
            className="relative max-h-[95vh] max-w-[95vw] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-2 text-[#134e4a] shadow hover:bg-white"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={proofUrl}
              alt={label}
              className="max-h-[90vh] w-auto max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
