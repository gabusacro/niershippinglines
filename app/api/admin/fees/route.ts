import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getFeeSettings } from "@/lib/get-fee-settings";
import { ROUTES } from "@/lib/constants";
import { NextRequest, NextResponse } from "next/server";

/** GET: Return current fee settings (admin only). */
export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getFeeSettings();
  return NextResponse.json(settings);
}

/** PATCH: Update fee settings (admin only). */
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { admin_fee_cents_per_passenger?: number; gcash_fee_cents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const adminFee = typeof body.admin_fee_cents_per_passenger === "number" ? body.admin_fee_cents_per_passenger : undefined;
  const gcashFee = typeof body.gcash_fee_cents === "number" ? body.gcash_fee_cents : undefined;
  if (adminFee === undefined && gcashFee === undefined) {
    return NextResponse.json({ error: "Provide admin_fee_cents_per_passenger and/or gcash_fee_cents" }, { status: 400 });
  }
  if (adminFee !== undefined && (adminFee < 0 || !Number.isInteger(adminFee))) {
    return NextResponse.json({ error: "admin_fee_cents_per_passenger must be a non-negative integer" }, { status: 400 });
  }
  if (gcashFee !== undefined && (gcashFee < 0 || !Number.isInteger(gcashFee))) {
    return NextResponse.json({ error: "gcash_fee_cents must be a non-negative integer" }, { status: 400 });
  }

  const supabase = await createClient();
  const updates: Record<string, number | string> = { updated_at: new Date().toISOString() };
  if (adminFee !== undefined) updates.admin_fee_cents_per_passenger = adminFee;
  if (gcashFee !== undefined) updates.gcash_fee_cents = gcashFee;

  const { error } = await supabase
    .from("fee_settings")
    .update(updates)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings = await getFeeSettings();
  return NextResponse.json(settings);
}
