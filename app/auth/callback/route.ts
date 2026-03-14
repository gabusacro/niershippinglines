import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ── Role → dashboard redirect ─────────────────────────────────────────────────
function getDashboardForRole(role: string | null): string {
  switch (role) {
    case "admin":         return "/admin";
    case "vessel_owner":  return "/dashboard/vessel-owner";
    case "investor":      return "/dashboard/investor";
    case "tour_operator": return "/dashboard/tour-operator";
    case "tour_guide":    return "/dashboard/tour-guide";
    case "ticket_booth":  return "/dashboard";
    case "passenger":     return "/dashboard";
    default:              return "/dashboard";
  }
}

/**
 * Supabase Auth callback:
 * - email confirmation → auto-login → redirect to role dashboard (Feature 4)
 * - password reset     → redirect to /account?reset=1
 * - magic link / OAuth → redirect to next param or role dashboard
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // ── Password reset → always go to change password page ────────────────
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/account?reset=1", origin));
      }

      // ── Email confirmation or magic link → auto-login + role redirect ──────
      // Read the user's role and send them to the right dashboard (Feature 4)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // If a specific next param was provided, respect it
        // Otherwise redirect based on role
        if (next) {
          return NextResponse.redirect(new URL(next, origin));
        }

        const destination = getDashboardForRole(profile?.role ?? null);
        return NextResponse.redirect(new URL(destination, origin));
      }

      // Fallback
      return NextResponse.redirect(new URL(next ?? "/dashboard", origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
