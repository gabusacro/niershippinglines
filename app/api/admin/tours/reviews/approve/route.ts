import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const review_id = formData.get("review_id") as string;

  if (!review_id) {
    return NextResponse.redirect(new URL("/admin/tours/reviews?error=Missing+review+id", request.url));
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tour_reviews")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", review_id);

  if (error) {
    console.error("Approve review error:", error);
    return NextResponse.redirect(
      new URL("/admin/tours/reviews?error=" + encodeURIComponent(error.message), request.url),
      { status: 303 }
    );
  }

  return NextResponse.redirect(
    new URL("/admin/tours/reviews?status=pending&success=approved", request.url),
    { status: 303 }
  );
}