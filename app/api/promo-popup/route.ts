/**
 * /api/admin/promo-popup
 * GET  — public read (used by visitor PromoPopup component + admin page)
 * PATCH — admin-only write, bypasses RLS via admin client
 *
 * Always operates on the single most-recently-updated row.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic   = "force-dynamic";
export const revalidate = 0;

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createAdminClient() ?? (await createClient());
    const { data, error } = await supabase
      .from("promo_popup")
      .select("*")
      .order("updated_at", { ascending: false })   // ← always get the freshest row
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[promo-popup GET]", error.message);
      return NextResponse.json(null, { headers: noCacheHeaders() });
    }

    return NextResponse.json(data ?? null, { headers: noCacheHeaders() });
  } catch (e) {
    console.error("[promo-popup GET] exception", e);
    return NextResponse.json(null);
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    // Verify admin role
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const payload = {
      is_active:    Boolean(body.is_active ?? false),
      image_url:    typeof body.image_url    === "string" ? body.image_url.trim()    || null : null,
      headline:     typeof body.headline     === "string" ? body.headline.trim()     || null : null,
      subtext:      typeof body.subtext      === "string" ? body.subtext.trim()      || null : null,
      button_label: typeof body.button_label === "string" ? body.button_label.trim() || "Book Now" : "Book Now",
      button_url:   typeof body.button_url   === "string" ? body.button_url.trim()   || null : null,
      show_on:      Array.isArray(body.show_on) ? body.show_on : ["all"],
      expires_days: typeof body.expires_days === "number" ? body.expires_days : 1,
      updated_at:   new Date().toISOString(),
    };

    const supabase = createAdminClient() ?? authClient;

    // Get the most-recently-updated row to target (same as GET)
    const { data: existing } = await supabase
      .from("promo_popup")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Update that specific row by ID — no ambiguity
      const { data, error } = await supabase
        .from("promo_popup")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("[promo-popup PATCH update]", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data, message: "Saved!" }, { headers: noCacheHeaders() });
    }

    // No row yet — insert one
    const { data, error } = await supabase
      .from("promo_popup")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[promo-popup PATCH insert]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: "Created!" }, { headers: noCacheHeaders() });

  } catch (e) {
    console.error("[promo-popup PATCH] exception", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function noCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };
}
