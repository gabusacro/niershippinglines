import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/** GET: Admin or ticket_booth. Look up profile by email to pre-fill address/name for walk-in. */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ found: false });
  }
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, address")
    .ilike("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ found: false });
  }
  return NextResponse.json({
    found: true,
    full_name: profile.full_name?.trim() ?? null,
    address: profile.address?.trim() ?? null,
  });
}
