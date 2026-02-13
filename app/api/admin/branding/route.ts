import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** PATCH: Update site branding. Admin only. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { site_name?: string; routes_text?: string; tagline?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const site_name = typeof body.site_name === "string" ? body.site_name.trim() : undefined;
  const routes_text = typeof body.routes_text === "string" ? body.routes_text.trim() : undefined;
  const tagline = typeof body.tagline === "string" ? body.tagline.trim() : undefined;

  if (!site_name && !routes_text && !tagline) {
    return NextResponse.json({ error: "Provide at least one of site_name, routes_text, tagline" }, { status: 400 });
  }

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (site_name !== undefined) updates.site_name = site_name || "Nier Shipping Lines";
  if (routes_text !== undefined) updates.routes_text = routes_text || "Siargao Island ↔ Surigao · Dinagat ↔ Surigao City";
  if (tagline !== undefined) updates.tagline = tagline || "Feel the island before you arrive. Sun, waves, and a smooth sail away.";

  const { error } = await supabase
    .from("site_branding")
    .update(updates)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, message: "Branding updated. Changes will appear across the site, tickets, and manifest." });
}
