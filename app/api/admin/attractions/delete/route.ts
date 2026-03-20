// app/api/admin/attractions/delete/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { id }   = await req.json();
    if (!id) return NextResponse.json({ error: "No id provided" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("attractions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[attractions/delete]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[attractions/delete] Unexpected:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
