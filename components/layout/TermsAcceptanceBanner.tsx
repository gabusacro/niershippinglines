"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

// Kept as-is to avoid re-asking users who already accepted
const STORAGE_KEY = "nier_terms_accepted";

export function TermsAcceptanceBanner() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setAccepted(stored === "true");
    } catch {
      setAccepted(true);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      setAccepted(true);
    } catch {
      setAccepted(true);
    }
  }

  if (accepted === null || accepted) return null;

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed banner */}
      <div className="h-24 sm:h-16" aria-hidden="true" />

      {/* Fixed banner — always visible at bottom of viewport regardless of scroll */}
      <div
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
        className="border-t-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-2xl"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            By using this website, you agree to our{" "}
            <Link
              href={ROUTES.terms}
              className="font-semibold text-amber-800 underline hover:no-underline"
              target="_blank"
            >
              Terms and Conditions
            </Link>
            {" "}and{" "}
            <Link
              href={ROUTES.privacy}
              className="font-semibold text-amber-800 underline hover:no-underline"
              target="_blank"
            >
              Privacy Policy
            </Link>.
          </p>
          <button
            type="button"
            onClick={handleAccept}
            className="shrink-0 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors touch-manipulation"
          >
            I Accept
          </button>
        </div>
      </div>
    </>
  );
}
