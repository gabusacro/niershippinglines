import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const booking_id = formData.get("booking_id") as string;
  const reference  = formData.get("reference") as string;

  const supabase = await createClient();

  const { error } = await supabase
    .from("tour_bookings")
    .update({
      status: "confirmed",
      payment_status: "verified",
      payment_verified_by: user.id,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking_id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/tours/bookings/${booking_id}?error=${encodeURIComponent(error.message)}`, request.url),
      { status: 303 }
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/tours/bookings?status=confirmed&confirmed=${reference}`, request.url),
    { status: 303 }
  );
}