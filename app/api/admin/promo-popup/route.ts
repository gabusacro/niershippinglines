/**
 * /api/admin/promo-popup
 * GET  — public read for PromoPopup visitor component
 * PATCH — admin-only write, bypasses RLS via admin client
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createAdminClient() ?? (await createClient());
    const { data, error } = await supabase
      .from("promo_popup")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[promo-popup GET]", error.message);
      return NextResponse.json(null);
    }

    return NextResponse.json(data ?? null, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (e) {
    console.error("[promo-popup GET] exception", e);
    return NextResponse.json(null);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Verify admin role first
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

    // Sanitize — only allow known fields
    const payload = {
      is_active:    Boolean(body.is_active ?? false),
      image_url:    typeof body.image_url === "string"    ? body.image_url.trim()    : null,
      headline:     typeof body.headline === "string"     ? body.headline.trim()     : null,
      subtext:      typeof body.subtext === "string"      ? body.subtext.trim()      : null,
      button_label: typeof body.button_label === "string" ? body.button_label.trim() : "Book Now",
      button_url:   typeof body.button_url === "string"   ? body.button_url.trim()   : null,
      show_on:      Array.isArray(body.show_on)           ? body.show_on             : ["all"],
      expires_days: typeof body.expires_days === "number" ? body.expires_days        : 7,
      updated_at:   new Date().toISOString(),
    };

    // Always use admin client for writes to bypass RLS
    const supabase = createAdminClient() ?? authClient;

    const { data: existing } = await supabase
      .from("promo_popup")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
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
      return NextResponse.json({ data, message: "Promo popup saved!" });
    }

    const { data, error } = await supabase
      .from("promo_popup")
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error("[promo-popup PATCH insert]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: "Promo popup created!" });

  } catch (e) {
    console.error("[promo-popup PATCH] exception", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
