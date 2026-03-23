import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Get current logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  const path         = request.nextUrl.pathname;
  const isAdminUI    = path.startsWith("/admin");
  const isAdminApi   = path.startsWith("/api/admin");
  const isLoginPage  = path === "/login";

  // ── Protect /admin pages + /api/admin endpoints ───────────────────────────
  if (isAdminUI || isAdminApi) {

    // Not logged in at all
    if (!user) {
      if (isAdminApi) {
        // Block API calls with 401 — don't redirect API routes
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Redirect UI to login, preserving the page they wanted
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }

    // Logged in — check role in profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      if (isAdminApi) {
        // Block API call with 403 Forbidden
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Passenger/investor/crew → send to their dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Already logged-in admin visiting /login → skip to admin ──────────────
  if (isLoginPage && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}
