"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

function isLikelyFromExtension(message?: string, stack?: string): boolean {
  const str = [message, stack].filter(Boolean).join(" ");
  return (
    /chrome-extension:\/\//i.test(str) ||
    /moz-extension:\/\//i.test(str) ||
    /Metamask|MetaMask|Failed to connect to MetaMask/i.test(str) ||
    /wallet|ethereum|web3|Ethereum provider|extension/i.test(str) ||
    /Cannot assign to read only property|read only property.*ethereum/i.test(str)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isLikelyFromExtension(error.message, error.stack)) {
      console.error("[App error]", error.message, error.stack);
    }
  }, [error]);

  const fromExtension = isLikelyFromExtension(error.message, error.stack);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 lg:px-8 text-center">
      <h1 className="text-xl font-bold text-[#134e4a]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        {fromExtension
          ? "A browser extension may have caused this. Try refreshing the page or disabling extensions for this site."
          : "We hit an unexpected error. You can try again or go back home."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
        >
          Try again
        </button>
        <Link
          href={ROUTES.home}
          className="rounded-xl border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
