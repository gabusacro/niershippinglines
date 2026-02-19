"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";
import { Boat } from "@/components/icons";
import { OfficialTime } from "@/components/ui/OfficialTime";
import { createClient } from "@/lib/supabase/client";

type HeaderProps = { siteName?: string };

const BASE_NAV_LINKS = [
  { href: ROUTES.home, label: "Home" },
  { href: ROUTES.schedule, label: "Schedule" },
  { href: ROUTES.book, label: "Book A Trip" },
  { href: ROUTES.attractions, label: "Attractions" },
];

export function Header({ siteName }: HeaderProps = {}) {
  const displayName = siteName ?? APP_NAME;
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u?.id) {
        supabase.from("profiles").select("role").eq("id", u.id).maybeSingle().then(({ data: p }) => {
          setRole((p as { role?: string } | null)?.role ?? null);
        });
      } else setRole(null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.id) {
        supabase.from("profiles").select("role").eq("id", u.id).maybeSingle().then(({ data: p }) => {
          setRole((p as { role?: string } | null)?.role ?? null);
        });
      } else setRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    toast.showSuccess("Signed out successfully");
    router.refresh();
    router.push(ROUTES.home);
  }

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
            {displayName}
          </span>
        </Link>

        {/* Official time (Philippines) — reference for boarding */}
        <div className="hidden sm:block shrink-0">
          <OfficialTime />
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium">
          {BASE_NAV_LINKS.map(({ href, label }) => (
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
          {user ? (
            <>
              {role && ["crew", "captain", "ticket_booth", "admin"].includes(role) && (
                <Link
                  href={ROUTES.crewScan}
                  className={`min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
                    pathname === ROUTES.crewScan ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
                  }`}
                >
                  Scan ticket
                </Link>
              )}
              <Link
                href={ROUTES.dashboard}
                className={`min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
                  pathname === ROUTES.dashboard ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
                }`}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] flex items-center px-3 py-2 rounded-xl text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200 touch-target"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href={ROUTES.login}
              className={`min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
                pathname === ROUTES.login ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
              }`}
            >
              Login / Sign up
            </Link>
          )}
        </nav>

        {/* Mobile: time + hamburger */}
        <div className="flex sm:hidden shrink-0 items-center gap-2">
          <OfficialTime />
        </div>
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
            {BASE_NAV_LINKS.map(({ href, label }) => (
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
            {user ? (
              <>
                {role && ["crew", "captain", "ticket_booth", "admin"].includes(role) && (
                  <li>
                    <Link
                      href={ROUTES.crewScan}
                      onClick={() => setMenuOpen(false)}
                      className={`flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
                        pathname === ROUTES.crewScan ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
                      }`}
                    >
                      Scan ticket
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href={ROUTES.dashboard}
                    onClick={() => setMenuOpen(false)}
                    className={`flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
                      pathname === ROUTES.dashboard ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
                    }`}
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => { handleSignOut(); }}
                    className="flex min-h-[48px] w-full items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] hover:bg-white/10 active:bg-white/15 text-left"
                  >
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link
                  href={ROUTES.login}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
                    pathname === ROUTES.login ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
                  }`}
                >
                  Login / Sign up
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
