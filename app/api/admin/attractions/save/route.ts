// app/api/admin/attractions/save/route.ts
// Creates or updates a row in your `attractions` table

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json();
    const supabase = await createClient();

    const row = {
      // Only include id if editing an existing item
      ...(body.id ? { id: body.id } : {}),

      // Your original columns
      title:        body.title,
      slug:         body.slug,
      description:  body.description  || null,
      image_url:    body.image_url     || null,
      sort_order:   body.sort_order    ?? 0,
      is_published: body.is_published  ?? true,

      // New columns you added
      category:        body.category        || "attractions",
      cover_gradient:  body.cover_gradient  || "from-[#085C52] to-[#0c7b93]",
      cover_emoji:     body.cover_emoji     || "🌴",
      is_live:         body.is_live         ?? false,
      is_featured:     body.is_featured     ?? false,
      read_minutes:    body.read_minutes    ?? 2,
      seo_tags:        body.seo_tags        ?? [],
      type:            body.type            || "attraction",

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("attractions")
      .upsert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[attractions/save]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("[attractions/save] Unexpected:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
