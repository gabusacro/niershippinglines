import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET: List ports (for admin Dinagat port dropdown). Public can also use for display. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ports")
    .select("id, name, region")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
