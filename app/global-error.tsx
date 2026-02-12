"use client";

/**
 * Root-level error boundary. Catches errors that escape the app (including
 * from injected extension scripts). Keeps the site stable on Chrome, Brave, Firefox.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message ?? "";
  const stack = error?.stack ?? "";
  const fromExtension =
    /chrome-extension:\/\//i.test(message + stack) ||
    /moz-extension:\/\//i.test(message + stack) ||
    /Metamask|MetaMask|Failed to connect to MetaMask/i.test(message + stack) ||
    /wallet|ethereum|web3|Ethereum provider|extension/i.test(message + stack) ||
    /Cannot assign to read only property|read only property.*ethereum/i.test(message + stack);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fef9e7", color: "#134e4a", padding: "2rem", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#0f766e", marginBottom: "1.5rem" }}>
            {fromExtension
              ? "A browser extension may have caused this. Try refreshing the page or disabling extensions for this site."
              : "We hit an unexpected error. Please refresh the page or try again later."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0c7b93",
              color: "white",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "0.75rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
