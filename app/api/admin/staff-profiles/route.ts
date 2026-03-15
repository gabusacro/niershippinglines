import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/staff-profiles
// Returns captain, crew, ticket_booth profiles for crew assignment dropdown
// Excludes vessel_owner — they are financial partners, not operational crew
export async function GET(_req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: requester } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (requester?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Only return actual operational staff roles ──────────────────────────
  // captain, crew, ticket_booth — NOT vessel_owner (financial role, not crew)
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["captain", "crew", "ticket_booth"])
    .order("role")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
