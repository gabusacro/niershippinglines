import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

// ── Existing POST handler (HTML form submit) ──────────────────────────────
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

  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const cents = (key: string) => {
    const v = str(key);
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.round(n * 100);
  };
  const bool = (key: string) => formData.has(key);

  const updates = {
    title:                       str("title"),
    short_description:           str("short_description"),
    description:                 str("description"),
    pickup_time_label:           str("pickup_time_label"),
    end_time_label:              str("end_time_label"),
    duration_label:              str("duration_label"),
    meeting_point:               str("meeting_point"),
    cancellation_policy:         str("cancellation_policy"),
    joiner_price_cents:          cents("joiner_price"),
    private_price_cents:         cents("private_price"),
    exclusive_price_cents:       cents("exclusive_price"),
    exclusive_unit_label:        str("exclusive_unit_label"),
    hourly_price_min_cents:      cents("hourly_price_min"),
    hourly_price_max_cents:      cents("hourly_price_max"),
    per_person_price_cents:      cents("per_person_price"),
    is_active:                   bool("is_active"),
    is_featured:                 bool("is_featured"),
    is_weather_dependent:        bool("is_weather_dependent"),
    requires_health_declaration: bool("requires_health_declaration"),
    private_is_negotiable:       bool("private_is_negotiable"),
    sort_order: (() => {
      const v = str("sort_order");
      if (!v) return undefined;
      const n = parseInt(v);
      return isNaN(n) ? undefined : n;
    })(),
    updated_at: new Date().toISOString(),
  };

  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_packages")
    .update(clean)
    .eq("id", id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/tours/packages/${id}?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/tours/packages?updated=${encodeURIComponent(str("title") ?? "Package")}`, request.url)
  );
}

// ── New PATCH handler (JSON from AdminEditPackageClient) ──────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const toNullableCents = (v: number | null | undefined) =>
    v && v > 0 ? Math.round(v * 100) : null;

  const updates = {
    title:                       body.title?.trim() ?? null,
    short_description:           body.short_description?.trim() || null,
    description:                 body.description?.trim() || null,
    pickup_time_label:           body.pickup_time_label?.trim() || null,
    end_time_label:              body.end_time_label?.trim() || null,
    duration_label:              body.duration_label?.trim() || null,
    meeting_point:               body.meeting_point?.trim() || null,
    cancellation_policy:         body.cancellation_policy?.trim() || null,
    joiner_price_cents:          toNullableCents(body.joiner_price),
    private_price_cents:         toNullableCents(body.private_price),
    exclusive_price_cents:       toNullableCents(body.exclusive_price),
    exclusive_unit_label:        body.exclusive_unit_label?.trim() || null,
    hourly_price_min_cents:      toNullableCents(body.hourly_price_min),
    hourly_price_max_cents:      toNullableCents(body.hourly_price_max),
    per_person_price_cents:      toNullableCents(body.per_person_price),
    is_active:                   body.is_active ?? true,
    is_featured:                 body.is_featured ?? false,
    is_weather_dependent:        body.is_weather_dependent ?? false,
    requires_health_declaration: body.requires_health_declaration ?? true,
    private_is_negotiable:       body.private_is_negotiable ?? false,
    sort_order:                  body.sort_order ?? 0,
    updated_at:                  new Date().toISOString(),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_packages")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
