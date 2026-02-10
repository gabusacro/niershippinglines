"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { Boat } from "@/components/icons";

const NAV_LINKS = [
  { href: ROUTES.home, label: "Home" },
  { href: ROUTES.schedule, label: "Schedule" },
  { href: ROUTES.book, label: "Book" },
  { href: ROUTES.attractions, label: "Attractions" },
  { href: ROUTES.weather, label: "Weather" },
  { href: ROUTES.signup, label: "Sign up" },
  { href: ROUTES.login, label: "Log in" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c7b93] shadow-sm safe-area-pad md:bg-[#0c7b93]/95 md:backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.home}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-white drop-shadow-sm hover:text-[#fef9e7] transition-colors duration-200 touch-target md:flex-initial md:min-w-0"
          onClick={() => setMenuOpen(false)}
        >
          <Boat size={24} className="shrink-0 text-[#fef9e7] sm:w-7 sm:h-7" />
          <span className="text-sm font-semibold leading-tight tracking-tight text-white line-clamp-2 min-w-0 sm:text-base md:text-lg md:font-bold md:leading-normal md:line-clamp-none md:truncate md:max-w-[200px] lg:max-w-none">
            {APP_NAME}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium">
          {NAV_LINKS.slice(0, -1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
                pathname === href ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={ROUTES.login}
            className="min-h-[44px] flex items-center rounded-xl bg-white/20 px-4 py-2 text-white hover:bg-white/30 active:scale-[0.98] transition-all duration-200 touch-target"
          >
            Log in
          </Link>
        </nav>

        {/* Mobile: hamburger */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/15 active:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0c7b93] md:hidden touch-target transition-all duration-200"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile nav drawer */}
      <div
        className={`md:hidden overflow-hidden transition-[height] duration-200 ease-out ${
          menuOpen ? "h-auto" : "h-0"
        }`}
        aria-hidden={!menuOpen}
      >
        <nav className="border-t border-white/15 bg-[#0f766e]/98 backdrop-blur-md px-4 py-3">
          <ul className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
                    pathname === href ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
