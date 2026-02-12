import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export interface FuelSettings {
  defaultFuelLitersPerTrip: number;
  fuelPesosPerLiter: number;
}

const DEFAULTS: FuelSettings = {
  defaultFuelLitersPerTrip: 100,
  fuelPesosPerLiter: 61.4,
};

/** GET: Fuel & revenue settings (admin or ticket_booth). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "ticket_booth") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error } = await supabase
    .from("app_settings")
    .select("default_fuel_liters_per_trip, fuel_pesos_per_liter")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[settings] fetch error:", error.message);
    return NextResponse.json(DEFAULTS);
  }

  const defaultFuelLitersPerTrip =
    typeof row?.default_fuel_liters_per_trip === "number" && row.default_fuel_liters_per_trip >= 0
      ? row.default_fuel_liters_per_trip
      : DEFAULTS.defaultFuelLitersPerTrip;
  const fuelPesosPerLiter =
    typeof row?.fuel_pesos_per_liter === "number" && row.fuel_pesos_per_liter >= 0
      ? Number(row.fuel_pesos_per_liter)
      : DEFAULTS.fuelPesosPerLiter;

  return NextResponse.json({
    defaultFuelLitersPerTrip,
    fuelPesosPerLiter,
  });
}

/** PATCH: Update fuel & revenue settings (admin only). */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { defaultFuelLitersPerTrip?: number; fuelPesosPerLiter?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const defaultFuelLitersPerTrip =
    typeof body.defaultFuelLitersPerTrip === "number" && body.defaultFuelLitersPerTrip >= 0
      ? Math.round(body.defaultFuelLitersPerTrip)
      : undefined;
  const fuelPesosPerLiter =
    typeof body.fuelPesosPerLiter === "number" && body.fuelPesosPerLiter >= 0
      ? body.fuelPesosPerLiter
      : undefined;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (defaultFuelLitersPerTrip !== undefined) updates.default_fuel_liters_per_trip = defaultFuelLitersPerTrip;
  if (fuelPesosPerLiter !== undefined) updates.fuel_pesos_per_liter = fuelPesosPerLiter;

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "Send defaultFuelLitersPerTrip and/or fuelPesosPerLiter" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_settings")
    .update(updates)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/reports", "layout");
  return NextResponse.json({
    ok: true,
    defaultFuelLitersPerTrip: defaultFuelLitersPerTrip ?? null,
    fuelPesosPerLiter: fuelPesosPerLiter ?? null,
  });
}
