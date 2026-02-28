import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const body = await req.json();
  const {
    investorId,
    year,
    month,
    grossPlatformCents,
    vesselBonusDeductionCents,
    expenseDeductionCents,
    netPoolCents,
    sharePercent,
    shareCents,
    paymentReference,
    paymentNotes,
  } = body;

  if (!investorId || !year || !month || !paymentReference) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("investor_payouts")
    .upsert(
      {
        investor_id: investorId,
        year,
        month,
        gross_platform_cents: grossPlatformCents ?? 0,
        vessel_bonus_deduction_cents: vesselBonusDeductionCents ?? 0,
        expense_deduction_cents: expenseDeductionCents ?? 0,
        net_pool_cents: netPoolCents ?? 0,
        share_percent: sharePercent ?? 0,
        share_cents: shareCents ?? 0,
        status: "paid",
        payment_reference: paymentReference,
        payment_notes: paymentNotes ?? null,
        paid_at: new Date().toISOString(),
        paid_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "investor_id,year,month" }
    );

  if (error) {
    console.error("investor_payouts upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("investor_payouts")
    .update({
      status: "pending",
      payment_reference: null,
      payment_notes: null,
      paid_at: null,
      paid_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
