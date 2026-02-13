"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { APP_NAME } from "@/lib/constants";

interface PrintTicketsModalProps {
  reference: string;
  open: boolean;
  onClose: () => void;
  /** Site name for share text (from admin branding). */
  siteName?: string;
}

export function PrintTicketsModal({ reference, open, onClose, siteName }: PrintTicketsModalProps) {
  const displayName = siteName ?? APP_NAME;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ticketsUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/bookings/${reference}/tickets`
      : "";

  const handlePrint = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.print();
    } else {
      window.open(ticketsUrl, "_blank", "noopener")?.print();
    }
  }, [ticketsUrl]);

  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/bookings/${reference}/tickets` : "";
    const title = "My ferry tickets";
    const text = `${displayName} – Booking ${reference}. View and print tickets: ${url}`;
    setShareMessage(null);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
        setShareMessage("Shared. You can close this or share again.");
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Link copied! Open Messenger (app or messenger.com), start a chat, and paste (Ctrl+V or tap Paste) to share.");
    } catch {
      setShareMessage(`Copy this link to share: ${url}`);
    }
  }, [reference]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-teal-200 px-4 py-3">
          <h2 className="text-lg font-bold text-[#134e4a]">Tickets — {reference}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={ticketsUrl}
            title="Tickets"
            className="h-[50vh] w-full border-0 sm:h-[60vh]"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-teal-200 bg-[#fef9e7]/50 px-4 py-4">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] rounded-xl border-2 border-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
          >
            Save as PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="min-h-[44px] rounded-xl border-2 border-teal-300 px-4 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
          >
            Share (e.g. Messenger)
          </button>
        </div>
        {shareMessage && (
          <div className="border-t border-teal-200/60 bg-teal-50/50 px-4 py-3 text-center">
            <p className="text-sm text-[#134e4a]">{shareMessage}</p>
            {shareMessage.startsWith("Link copied") && (
              <a
                href="https://www.messenger.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block min-h-[44px] rounded-xl border-2 border-[#0c7b93] px-4 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
              >
                Open Messenger in new tab
              </a>
            )}
          </div>
        )}
        <p className="px-4 pb-3 text-center text-xs text-[#0f766e]">
          Save as PDF: click &quot;Save as PDF&quot; in the print dialog. Share: link is copied or use your device share menu; then paste in Messenger or any app.
        </p>
      </div>
    </div>
  );
}
