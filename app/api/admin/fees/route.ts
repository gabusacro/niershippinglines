import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const intFields = ["admin_fee_cents_per_passenger", "gcash_fee_cents"];
  const textFields = ["admin_fee_label", "gcash_fee_label"];
  const integerFields = ["child_min_age", "child_max_age", "infant_max_age"];
  const decimalFields = ["child_discount_percent", "senior_discount_percent", "pwd_discount_percent"];
  const boolFields = ["infant_is_free"];

  for (const f of intFields) {
    if (typeof body[f] === "number") updates[f] = Math.round(body[f] as number);
  }
  for (const f of textFields) {
    if (typeof body[f] === "string" && (body[f] as string).trim()) updates[f] = (body[f] as string).trim();
  }
  for (const f of integerFields) {
    if (typeof body[f] === "number") updates[f] = Math.round(body[f] as number);
  }
  for (const f of decimalFields) {
    if (typeof body[f] === "number") updates[f] = body[f];
  }
  for (const f of boolFields) {
    if (typeof body[f] === "boolean") updates[f] = body[f];
  }

  const { error } = await supabase.from("fee_settings").update(updates).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await supabase.from("fee_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json(data);
}
