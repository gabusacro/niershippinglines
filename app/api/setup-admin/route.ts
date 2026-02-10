import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * One-time setup: set the user with the given email as admin.
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (get from Supabase Dashboard > Project Settings > API).
 * Call once: GET /api/setup-admin?email=gabu.sacro@gmail.com
 * Then remove SUPABASE_SERVICE_ROLE_KEY from .env.local for security.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();

  if (!email) {
    return NextResponse.json(
      { error: "Missing email. Use: /api/setup-admin?email=your@email.com" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Server not configured for admin setup.",
        hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Project Settings > API > service_role). Call this route once, then remove the key.",
      },
      { status: 501 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: "Could not list users", detail: listError.message }, { status: 500 });
  }

  const user = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    return NextResponse.json(
      { error: "No user found with that email. Sign up at /signup first.", email },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: "admin", full_name: "Admin", approved_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update profile", detail: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "User is now admin. Log in at /login. Remove SUPABASE_SERVICE_ROLE_KEY from .env.local.",
    email: user.email,
  });
}
