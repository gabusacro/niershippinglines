import Link from "next/link";
import { DEVELOPER_LINK, DEVELOPER_COPYRIGHT, APP_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0f766e] text-white safe-area-pad backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-white/90 sm:text-sm">
            {APP_NAME}. Booking, ticketing &amp; ferry schedules.
          </p>
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
    </footer>
  );
}
