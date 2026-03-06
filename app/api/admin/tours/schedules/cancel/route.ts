import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const schedule_id = formData.get("schedule_id") as string;
  const tour_id     = formData.get("tour_id") as string;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_schedules")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", schedule_id);

  const redirectBase = `/admin/tours/packages/${tour_id}/schedules`;

  if (error) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL(redirectBase, request.url));
}