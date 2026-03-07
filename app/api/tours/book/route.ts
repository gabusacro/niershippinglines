import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "TRV-TOUR-";
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const supabase = await createClient();

    const formData = await request.formData();

    const tour_id        = formData.get("tour_id") as string;
    const schedule_id    = formData.get("schedule_id") as string;
    const booking_type   = formData.get("booking_type") as string;
    const total_pax      = parseInt(formData.get("total_pax") as string) || 1;
    const total_amount_cents = parseInt(formData.get("total_amount_cents") as string) || 0;
    const first_name     = formData.get("first_name") as string;
    const last_name      = formData.get("last_name") as string;
    const email          = formData.get("email") as string;
    const phone          = formData.get("phone") as string;
    const health_declaration = formData.has("health_declaration");
    const gcash_file     = formData.get("gcash_screenshot") as File | null;

    // Validate required fields
    if (!tour_id || !schedule_id || !first_name || !last_name || !email || !phone) {
      return NextResponse.redirect(
        new URL(`/tours/${tour_id}/book?schedule=${schedule_id}&error=missing_fields`, request.url)
      );
    }

    // Upload GCash screenshot
    let gcash_url: string | null = null;
    if (gcash_file && gcash_file.size > 0) {
      const ext = gcash_file.name.split(".").pop() ?? "jpg";
      const filename = `tour-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = await gcash_file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(`tours/${filename}`, buffer, {
          contentType: gcash_file.type,
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(`tours/${filename}`);
        gcash_url = urlData?.publicUrl ?? null;
      }
    }

    // Generate unique reference
    let reference = generateReference();
    // Ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from("tour_bookings")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();
      if (!existing) break;
      reference = generateReference();
    }

    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from("tour_bookings")
      .insert({
        reference,
        tour_id,
        schedule_id,
        booking_type,
        total_pax,
        total_amount_cents,
        customer_name: `${first_name} ${last_name}`.trim(),
        customer_email: email,
        customer_phone: phone,
        health_declaration_accepted: health_declaration,
        health_declaration_accepted_at: health_declaration ? new Date().toISOString() : null,
        gcash_screenshot_url: gcash_url,
        status: "pending",
        payment_status: "pending",
        booked_by: user?.id ?? null,
      })
      .select("id, reference")
      .single();

    if (bookingError || !booking) {
      console.error("[tour booking]", bookingError?.message);
      return NextResponse.redirect(
        new URL(`/tours/${tour_id}?error=booking_failed`, request.url)
      );
    }

    // Update slot counters
    if (booking_type === "joiner") {
      await supabase.rpc("increment_tour_joiner_slots", {
        p_schedule_id: schedule_id,
        p_count: total_pax,
      });
    } else if (booking_type === "private") {
      await supabase.rpc("increment_tour_private_slots", {
        p_schedule_id: schedule_id,
      });
    }

    // Redirect to confirmation page
    return NextResponse.redirect(
      new URL(`/tours/confirmation?ref=${booking.reference}`, request.url)
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tour booking error]", message);
    return NextResponse.redirect(
      new URL(`/tours?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}