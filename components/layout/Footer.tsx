import Link from "next/link";
import { DEVELOPER_LINK, DEVELOPER_COPYRIGHT, APP_NAME, ROUTES } from "@/lib/constants";
import { TermsAcceptanceBanner } from "@/components/layout/TermsAcceptanceBanner";

type FooterProps = { siteName?: string };

export function Footer({ siteName }: FooterProps = {}) {
  const displayName = siteName ?? APP_NAME;
  return (
    <footer className="border-t border-white/10 bg-[#0f766e] text-white safe-area-pad backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <p className="text-xs text-white/90 sm:text-sm">
              {displayName}. Booking, ticketing &amp; ferry schedules.
            </p>
            <span className="hidden text-white/50 sm:inline">·</span>
            <Link
              href={ROUTES.terms}
              className="text-xs text-white/90 underline decoration-white/50 underline-offset-2 hover:decoration-white sm:text-sm"
            >
              Terms
            </Link>
            <Link
              href={ROUTES.privacy}
              className="text-xs text-white/90 underline decoration-white/50 underline-offset-2 hover:decoration-white sm:text-sm"
            >
              Privacy
            </Link>
          </div>
          <p className="text-xs text-white/90 sm:text-sm">
            <Link
              href={DEVELOPER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/50 underline-offset-2 hover:decoration-white transition-colors"
            >
              {DEVELOPER_COPYRIGHT}
            </Link>
          </p>
        </div>
      </div>
      <TermsAcceptanceBanner />
    </footer>
  );
}
