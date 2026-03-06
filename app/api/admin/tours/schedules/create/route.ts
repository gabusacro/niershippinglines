import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const formData = await request.formData();
    const tour_id        = formData.get("tour_id") as string;
    const available_date = formData.get("available_date") as string;
    const departure_time = formData.get("departure_time") as string;
    const cutoff_hours   = parseInt(formData.get("cutoff_hours") as string) || 24;
    const notes          = (formData.get("notes") as string) || null;

    const joiner_slots_total    = parseInt(formData.get("joiner_slots_total") as string) || 0;
    const private_slots_total   = parseInt(formData.get("private_slots_total") as string) || 0;
    const exclusive_units_total = parseInt(formData.get("exclusive_units_total") as string) || 0;

    const redirectBase = `/admin/tours/packages/${tour_id}/schedules`;

    if (!tour_id || !available_date || !departure_time) {
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=Missing+required+fields`, request.url)
      );
    }const tourDateTime = new Date(`${available_date}T${departure_time}:00+08:00`);
    const cutoff_at = new Date(
      tourDateTime.getTime() - cutoff_hours * 60 * 60 * 1000
    ).toISOString();

    const insertData: Record<string, unknown> = {
      tour_id,
      available_date,
      departure_time,
      cutoff_at,
      joiner_slots_total,
      joiner_slots_booked: 0,
      private_slots_total,
      private_slots_booked: 0,
      exclusive_units_total,
      exclusive_units_booked: 0,
      accepts_joiners: joiner_slots_total > 0,
      accepts_private: private_slots_total > 0,
      accepts_exclusive: exclusive_units_total > 0,
      status: "open",
    };

    if (notes) insertData.notes = notes;

    const userId = (user as unknown as Record<string, unknown>).id
      ?? (user as unknown as Record<string, unknown>).userId
      ?? null;
    if (userId) insertData.created_by = userId;

    const supabase = await createClient();
    const { error } = await supabase
      .from("tour_schedules")
      .insert(insertData);

    if (error) {
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL(`${redirectBase}?added=${encodeURIComponent(available_date)}`, request.url)
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/admin/tours?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}