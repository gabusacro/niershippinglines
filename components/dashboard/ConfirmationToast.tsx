"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { PrintTicketsModal } from "@/components/tickets/PrintTicketsModal";
import { ROUTES } from "@/lib/constants";

export type ConfirmationToastItem = { reference: string };

const TOAST_DURATION_MS = 10_000;
const POLL_INTERVAL_MS = 15_000;

interface ConfirmationToastProps {
  items: ConfirmationToastItem[];
}

export function ConfirmationToast({ items: initialItems }: ConfirmationToastProps) {
  const [items, setItems] = useState<ConfirmationToastItem[]>(initialItems);
  const [visible, setVisible] = useState(initialItems.length > 0);
  const [printRef, setPrintRef] = useState<string | null>(null);
  const shownRefs = useRef<Set<string>>(new Set(initialItems.map((i) => i.reference)));
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setVisible(false), []);

  const scheduleDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(dismiss, TOAST_DURATION_MS);
  }, [dismiss]);

  // Initial show and auto-dismiss
  useEffect(() => {
    if (initialItems.length > 0) {
      setItems(initialItems);
      setVisible(true);
      shownRefs.current = new Set(initialItems.map((i) => i.reference));
      scheduleDismiss();
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only on mount

  // Poll for new confirmations and re-show toast when new refs appear
  useEffect(() => {
    if (initialItems.length === 0) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/dashboard/recently-confirmed", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const list: ConfirmationToastItem[] = data?.items ?? [];
        const refs = new Set(list.map((i: ConfirmationToastItem) => i.reference));
        const hasNew = list.some((i: ConfirmationToastItem) => !shownRefs.current.has(i.reference));
        if (hasNew && list.length > 0) {
          shownRefs.current = refs;
          setItems(list);
          setVisible(true);
          scheduleDismiss();
        }
      } catch {
        // ignore
      }
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [initialItems.length, scheduleDismiss]);

  if (items.length === 0 || !visible) return null;

  const firstRef = items[0].reference;
  const isMultiple = items.length > 1;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col rounded-2xl border-2 border-emerald-500 bg-white p-4 shadow-lg animate-toast-in sm:bottom-6 sm:right-6"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900">
              Payment confirmed — tickets ready
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              {isMultiple
                ? `${items.length} booking(s) confirmed. You can print tickets now.`
                : "You can print or view your tickets now."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Close notification"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintRef(firstRef)}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 touch-manipulation"
          >
            Print tickets
          </button>
          {isMultiple && (
            <Link
              href={ROUTES.myBookings}
              className="min-h-[44px] rounded-xl border-2 border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 touch-manipulation"
            >
              View all
            </Link>
          )}
        </div>
      </div>
      <PrintTicketsModal
        reference={printRef ?? ""}
        open={!!printRef}
        onClose={() => setPrintRef(null)}
      />
    </>
  );
}
