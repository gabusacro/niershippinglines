import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const refund_id = formData.get("refund_id") as string;
  const gcash_reference = formData.get("gcash_reference") as string;

  if (!refund_id) {
    return NextResponse.redirect(
      new URL("/admin/tours/refunds?error=Missing+refund+id", request.url),
      { status: 303 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tour_refunds")
    .update({
      status: "processed",
      gcash_reference: gcash_reference || null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", refund_id);

  if (error) {
    console.error("Process refund error:", error);
    return NextResponse.redirect(
      new URL("/admin/tours/refunds?error=" + encodeURIComponent(error.message), request.url),
      { status: 303 }
    );
  }

  return NextResponse.redirect(
    new URL("/admin/tours/refunds?status=processed", request.url),
    { status: 303 }
  );
}