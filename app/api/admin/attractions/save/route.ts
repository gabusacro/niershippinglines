import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json();
    const supabase = await createClient();

    const row = {
      ...(body.id ? { id: body.id } : {}),
      title:            body.title,
      slug:             body.slug,
      description:      body.description      ?? null,
      description_html: body.description_html ?? null,
      meta_description: body.meta_description ?? null,
      image_url:        body.image_url        ?? null,
      sort_order:       body.sort_order       ?? 0,
      is_published:     body.is_published     ?? true,
      category:         body.category         ?? null,
      cover_gradient:   body.cover_gradient   ?? null,
      cover_emoji:      body.cover_emoji      ?? null,
      is_live:          body.is_live          ?? false,
      is_featured:      body.is_featured      ?? false,
      read_minutes:     body.read_minutes     ?? 2,
      seo_tags:         body.seo_tags         ?? [],
      type:             body.type             ?? "attraction",
      hero_position:    body.hero_position    ?? "center center",
      photos:           body.photos           ?? [],
      layout_style:     body.layout_style     ?? "standard",
      auto_links:       body.auto_links       ?? [],
    };

    const { data, error } = await supabase
      .from("attractions")
      .upsert(row)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("[save-attraction]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}