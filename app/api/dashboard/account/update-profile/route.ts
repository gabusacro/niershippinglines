import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { full_name, salutation, mobile, address } = await request.json();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name?.trim() || null,
      salutation: salutation?.trim() || null,
      mobile: mobile?.trim() || null,
      address: address?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
