"use client";

import { useEffect } from "react";

/**
 * Suppresses errors and unhandled rejections that come from browser extensions
 * (e.g. MetaMask, wallet injectors) so they don't break or clutter our app.
 * Chrome, Brave, Firefox, and extension-heavy setups stay stable.
 */
function isLikelyFromExtension(
  message?: string,
  source?: string,
  stack?: string
): boolean {
  const str = [message, source, stack].filter(Boolean).join(" ");
  return (
    /chrome-extension:\/\//i.test(str) ||
    /moz-extension:\/\//i.test(str) ||
    /Metamask|MetaMask/i.test(str) ||
    /Failed to connect to MetaMask/i.test(str) ||
    /wallet|ethereum|web3|Ethereum provider/i.test(str) ||
    /extension/i.test(str) ||
    /Cannot assign to read only property/i.test(str) ||
    /read only property.*ethereum|ethereum.*read only/i.test(str)
  );
}

export function ExtensionFriendlyHandlers() {
  useEffect(() => {
    const onError = (event: ErrorEvent): boolean => {
      const message = event.message ?? "";
      const source = event.filename ?? "";
      const stack = event.error?.stack ?? "";
      if (isLikelyFromExtension(message, source, stack)) {
        event.preventDefault();
        return true; // handled – don't propagate
      }
      return false;
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason;
      const message = typeof reason === "object" && reason !== null && "message" in reason
        ? String((reason as { message?: unknown }).message)
        : String(reason);
      const stack = typeof reason === "object" && reason !== null && "stack" in reason
        ? String((reason as { stack?: unknown }).stack)
        : "";
      if (isLikelyFromExtension(message, undefined, stack)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
