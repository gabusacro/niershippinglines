import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Supabase Auth callback: exchange code for session (email confirm, magic link, OAuth).
 * After deploy, set Supabase Dashboard > Authentication > URL Configuration:
 * - Site URL = your production URL (e.g. https://your-app.vercel.app)
 * - Redirect URLs = your production URL + /** and keep http://localhost:3000/** for local
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
