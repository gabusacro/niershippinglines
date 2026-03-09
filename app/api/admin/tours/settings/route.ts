import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_settings")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
