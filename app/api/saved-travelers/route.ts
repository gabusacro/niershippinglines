import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const SELECT_FIELDS = "id, full_name, gender, birthdate, nationality, address, phone, fare_type, id_verified, id_verified_at, id_expires_at";

// GET: list saved travelers for logged-in user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_travelers")
    .select(SELECT_FIELDS)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ travelers: data ?? [] });
}

// POST: add a saved traveler
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_travelers")
    .insert({
      profile_id:  user.id,
      full_name:   body.full_name.trim(),
      gender:      body.gender      || null,
      birthdate:   body.birthdate   || null,
      nationality: body.nationality || null,
      address:     body.address     || null,
      phone:       body.phone       || null,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ traveler: data });
}
