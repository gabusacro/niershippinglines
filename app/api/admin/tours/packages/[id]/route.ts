import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { id } = await params;
  const formData = await request.formData();

  // Helper to get a string value or null
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  // Helper to convert ₱ amount → cents, or null if blank
  const cents = (key: string) => {
    const v = str(key);
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.round(n * 100);
  };

  // Helper for checkboxes (only present in form if checked)
  const bool = (key: string) => formData.has(key);

  const updates = {
    title:                      str("title"),
    short_description:          str("short_description"),
    description:                str("description"),
    pickup_time_label:          str("pickup_time_label"),
    end_time_label:             str("end_time_label"),
    duration_label:             str("duration_label"),
    meeting_point:              str("meeting_point"),
    cancellation_policy:        str("cancellation_policy"),

    // Pricing — only update what's present
    joiner_price_cents:         cents("joiner_price"),
    private_price_cents:        cents("private_price"),
    exclusive_price_cents:      cents("exclusive_price"),
    exclusive_unit_label:       str("exclusive_unit_label"),
    hourly_price_min_cents:     cents("hourly_price_min"),
    hourly_price_max_cents:     cents("hourly_price_max"),
    per_person_price_cents:     cents("per_person_price"),

    // Flags
    is_active:                  bool("is_active"),
    is_featured:                bool("is_featured"),
    is_weather_dependent:       bool("is_weather_dependent"),
    requires_health_declaration: bool("requires_health_declaration"),
    private_is_negotiable:      bool("private_is_negotiable"),

    // Sort order
    sort_order: (() => {
      const v = str("sort_order");
      if (!v) return undefined;
      const n = parseInt(v);
      return isNaN(n) ? undefined : n;
    })(),

    updated_at: new Date().toISOString(),
  };

  // Remove undefined values — don't overwrite with undefined
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_packages")
    .update(clean)
    .eq("id", id);

  if (error) {
    // Redirect back with error param
    return NextResponse.redirect(
      new URL(`/admin/tours/packages/${id}?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // Success — redirect back to package list
  return NextResponse.redirect(
    new URL(`/admin/tours/packages?updated=${encodeURIComponent(str("title") ?? "Package")}`, request.url)
  );
}