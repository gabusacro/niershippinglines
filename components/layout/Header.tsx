"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";
import { OfficialTime } from "@/components/ui/OfficialTime";
import { createClient } from "@/lib/supabase/client";

type HeaderProps = { siteName?: string };

const STAFF_ROLES = [
  "admin", "crew", "captain", "ticket_booth", "tour_guide",
  "tour_operator", "pay_parking_owner", "pay_parking_crew",
];

function ScheduleLink({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  const isHome = pathname === "/";
  const href = isHome ? "#schedule" : "/#schedule";
  return (
    <a href={href} onClick={onClick}
      className={`min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
        isHome ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
      }`}>
      Schedule
    </a>
  );
}

function ScheduleLinkMobile({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  const isHome = pathname === "/";
  const href = isHome ? "#schedule" : "/#schedule";
  return (
    <a href={href} onClick={onClick}
      className={`flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
        isHome ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
      }`}>
      Schedule
    </a>
  );
}

function desktopLink(active: boolean) {
  return `min-h-[44px] flex items-center px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
    active ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
  }`;
}
function mobileLink(active: boolean) {
  return `flex min-h-[48px] items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
    active ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
  }`;
}

export function Header({ siteName }: HeaderProps = {}) {
  const displayName = siteName ?? APP_NAME;
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [user,      setUser]      = useState<{ id: string } | null>(null);
  const [role,      setRole]      = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const router   = useRouter();
  const toast    = useToast();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u?.id) {
        supabase.from("profiles").select("role, avatar_url").eq("id", u.id).maybeSingle().then(({ data: p }) => {
          setRole((p as any)?.role ?? null);
          setAvatarUrl((p as any)?.avatar_url ?? null);
        });
      } else { setRole(null); setAvatarUrl(null); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.id) {
        supabase.from("profiles").select("role, avatar_url").eq("id", u.id).maybeSingle().then(({ data: p }) => {
          setRole((p as any)?.role ?? null);
          setAvatarUrl((p as any)?.avatar_url ?? null);
        });
      } else { setRole(null); setAvatarUrl(null); }
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

  const showBookATrip   = !user;
  const showPublicLinks = !role || role === "passenger";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c7b93] shadow-sm safe-area-pad md:bg-[#0c7b93]/95 md:backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href={ROUTES.home}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-white drop-shadow-sm hover:text-[#fef9e7] transition-colors duration-200 touch-target md:flex-initial md:min-w-0"
          onClick={() => setMenuOpen(false)}>
          <img src="/favicon.png" alt="logo" className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-full" />
          <span className="text-sm font-semibold leading-tight tracking-tight text-white line-clamp-2 min-w-0 sm:text-base md:text-lg md:font-bold md:leading-normal md:line-clamp-none md:truncate md:max-w-[200px] lg:max-w-none">
            {displayName}
          </span>
        </Link>

        <div className="hidden sm:block shrink-0">
          <OfficialTime />
        </div>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium">

          {showPublicLinks && (
            <Link href={ROUTES.home} className={desktopLink(pathname === ROUTES.home)}>Home</Link>
          )}

          {/* ✅ Amber/orange standout button — matches View Schedule style */}
          {showBookATrip && (
            <Link href={ROUTES.book}
              className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white transition-all duration-200 touch-target active:scale-[0.97] shadow-sm"
              style={{ background: "#F59E0B" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#D97706")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#F59E0B")}
            >
              🚢 Book A Trip
            </Link>
          )}

          {showPublicLinks && (
            <Link href={ROUTES.attractions} className={desktopLink(pathname === ROUTES.attractions)}>Attractions</Link>
          )}

          {showPublicLinks && (
            <Link href="/tours" className={desktopLink(pathname === "/tours")}>Tours</Link>
          )}

          {showPublicLinks && (
            <Link href="/faq" className={desktopLink(pathname === "/faq")}>FAQ</Link>
          )}

          {showPublicLinks && (
            <Link href="/parking" className={desktopLink(pathname === "/parking")}>Parking</Link>
          )}

          {user ? (
            <>
              {role && ["crew", "captain", "ticket_booth", "admin"].includes(role) && (
                <Link href={ROUTES.crewScan} className={desktopLink(pathname === ROUTES.crewScan)}>
                  Scan ticket
                </Link>
              )}
              <Link href={ROUTES.dashboard}
                className={`min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 touch-target ${
                  pathname === ROUTES.dashboard ? "text-white bg-white/20" : "text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98]"
                }`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover border-2 border-white/40 shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {(user as any)?.email?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                Dashboard
              </Link>
              <button type="button" onClick={handleSignOut}
                className="min-h-[44px] flex items-center px-3 py-2 rounded-xl text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200 touch-target">
                Sign out
              </button>
            </>
          ) : (
            <Link href={ROUTES.login} className={desktopLink(pathname === ROUTES.login)}>
              Login / Sign up
            </Link>
          )}
        </nav>

        {/* Mobile time + hamburger */}
        <div className="flex sm:hidden shrink-0 items-center gap-2">
          <OfficialTime />
        </div>
        <button type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/15 active:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0c7b93] md:hidden touch-target transition-all duration-200"
          onClick={() => setMenuOpen((o) => !o)}>
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

      {/* ── Mobile nav drawer ── */}
      <div className={`md:hidden overflow-hidden transition-[height] duration-200 ease-out ${menuOpen ? "h-auto" : "h-0"}`} aria-hidden={!menuOpen}>
        <nav className="border-t border-white/15 bg-[#0f766e]/98 backdrop-blur-md px-4 py-3">
          <ul className="flex flex-col gap-0.5">

            {showPublicLinks && (
              <li>
                <Link href={ROUTES.home} onClick={() => setMenuOpen(false)} className={mobileLink(pathname === ROUTES.home)}>
                  Home
                </Link>
              </li>
            )}

            {/* ✅ Amber button in mobile drawer too */}
            {showBookATrip && (
              <li>
                <Link href={ROUTES.book} onClick={() => setMenuOpen(false)}
                  className="flex min-h-[48px] items-center gap-2 rounded-2xl px-4 font-bold text-white transition-all duration-200 touch-target active:scale-[0.99]"
                  style={{ background: "#F59E0B" }}>
                  🚢 Book A Trip
                </Link>
              </li>
            )}

            {showPublicLinks && (
              <li>
                <Link href={ROUTES.attractions} onClick={() => setMenuOpen(false)} className={mobileLink(pathname === ROUTES.attractions)}>
                  Attractions
                </Link>
              </li>
            )}

            {showPublicLinks && (
              <li>
                <Link href="/tours" onClick={() => setMenuOpen(false)} className={mobileLink(pathname === "/tours")}>
                  Tours
                </Link>
              </li>
            )}

            {showPublicLinks && (
              <li>
                <Link href="/faq" onClick={() => setMenuOpen(false)} className={mobileLink(pathname === "/faq")}>
                  FAQ
                </Link>
              </li>
            )}

            {showPublicLinks && (
              <li>
                <Link href="/parking" onClick={() => setMenuOpen(false)} className={mobileLink(pathname === "/parking")}>
                  Parking
                </Link>
              </li>
            )}

            {user ? (
              <>
                {role && ["crew", "captain", "ticket_booth", "admin"].includes(role) && (
                  <li>
                    <Link href={ROUTES.crewScan} onClick={() => setMenuOpen(false)} className={mobileLink(pathname === ROUTES.crewScan)}>
                      Scan ticket
                    </Link>
                  </li>
                )}
                <li>
                  <Link href={ROUTES.dashboard} onClick={() => setMenuOpen(false)}
                    className={`flex min-h-[48px] items-center gap-2 rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] ${
                      pathname === ROUTES.dashboard ? "bg-white/20" : "hover:bg-white/10 active:bg-white/15"
                    }`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover border-2 border-white/40 shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xs font-black text-white shrink-0">
                        {(user as any)?.email?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    Dashboard
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={() => { handleSignOut(); }}
                    className="flex min-h-[48px] w-full items-center rounded-2xl px-4 text-white font-medium transition-all duration-200 touch-target active:scale-[0.99] hover:bg-white/10 active:bg-white/15 text-left">
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link href={ROUTES.login} onClick={() => setMenuOpen(false)} className={mobileLink(pathname === ROUTES.login)}>
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
