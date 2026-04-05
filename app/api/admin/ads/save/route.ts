// app/api/admin/ads/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json();
    const supabase = await createClient();

    const row = {
      ...(body.id ? { id: body.id } : {}),
      name:           body.name,
      type:           body.type           || "custom",
      is_active:      body.is_active      ?? false,
      placement:      body.placement      || "attraction_detail",
      image_url:      body.image_url      || null,
      image_alt:      body.image_alt      || null,
      link_url:       body.link_url       || null,
      title:          body.title          || null,
      description:    body.description    || null,
      adsense_client: body.adsense_client || null,
      adsense_slot:   body.adsense_slot   || null,
    };

    const { data, error } = await supabase
      .from("ads")
      .upsert(row)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
// app/api/admin/ads/delete/route.ts
// (put this in a separate file: app/api/admin/ads/delete/route.ts)
//
// import { NextRequest, NextResponse } from "next/server";
// import { createClient } from "@/lib/supabase/server";
//
// export async function POST(req: NextRequest) {
//   const { id } = await req.json();
//   const supabase = await createClient();
//   const { error } = await supabase.from("ads").delete().eq("id", id);
//   if (error) return NextResponse.json({ error: error.message }, { status: 500 });
//   return NextResponse.json({ success: true });
// }
