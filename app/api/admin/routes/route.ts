import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: List all routes. Admin only. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("routes")
    .select("id, origin, destination, display_name")
    .order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST: Create a new route. Admin only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { origin?: string; destination?: string; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = String(body.origin ?? "").trim();
  const destination = String(body.destination ?? "").trim();
  const displayName = String(body.display_name ?? "").trim() || `${origin} → ${destination}`;

  if (!origin || !destination) {
    return NextResponse.json({ error: "Origin and destination are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("routes")
    .insert({ origin, destination, display_name: displayName })
    .select("id, origin, destination, display_name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Route ${origin} → ${destination} already exists` }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
