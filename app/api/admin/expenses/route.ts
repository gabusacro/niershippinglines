import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_expenses")
    .select("*")
    .order("is_recurring", { ascending: false })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, amount_cents, is_recurring, applies_month, applies_year } = body;
  if (!name || !amount_cents) {
    return NextResponse.json({ error: "Name and amount are required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_expenses")
    .insert({ name, amount_cents, is_recurring: is_recurring ?? true, applies_month: applies_month ?? null, applies_year: applies_year ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { id, name, amount_cents, is_recurring, applies_month, applies_year } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_expenses")
    .update({ name, amount_cents, is_recurring, applies_month, applies_year, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("operational_expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
