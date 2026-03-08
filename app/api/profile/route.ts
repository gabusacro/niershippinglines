import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    full_name?: string;
    salutation?: string;
    address?: string;
    gender?: string;
    birthdate?: string;
    nationality?: string;
    recovery_email?: string;
    mobile?: string;
    emergency_contact_name?: string;
    emergency_contact_number?: string;
    email?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() || null : undefined;
  const salutation = typeof body.salutation === "string"
    ? (["Mr", "Mrs", "Ms"].includes(body.salutation) ? body.salutation : null)
    : undefined;
  const address = typeof body.address === "string" ? body.address.trim() || null : undefined;
  const gender = typeof body.gender === "string" ? body.gender.trim() || null : undefined;
  const birthdate = typeof body.birthdate === "string" ? body.birthdate || null : undefined;
  const nationality = typeof body.nationality === "string" ? body.nationality.trim() || null : undefined;
  const recoveryEmail = typeof body.recovery_email === "string" ? body.recovery_email.trim() || null : undefined;
  const mobile = typeof body.mobile === "string" ? body.mobile.trim() || null : undefined;
  const emergencyContactName = typeof body.emergency_contact_name === "string" ? body.emergency_contact_name.trim() || null : undefined;
  const emergencyContactNumber = typeof body.emergency_contact_number === "string" ? body.emergency_contact_number.trim() || null : undefined;
  const newEmail = typeof body.email === "string" ? body.email.trim() || null : undefined;

  if (recoveryEmail && recoveryEmail === user.email) {
    return NextResponse.json({ error: "Recovery email must differ from your main email." }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const profileUpdates: Record<string, unknown> = { updated_at: updatedAt };
  if (fullName !== undefined) profileUpdates.full_name = fullName;
  if (salutation !== undefined) profileUpdates.salutation = salutation;
  if (address !== undefined) profileUpdates.address = address;
  if (gender !== undefined) profileUpdates.gender = gender;
  if (birthdate !== undefined) profileUpdates.birthdate = birthdate;
  if (nationality !== undefined) profileUpdates.nationality = nationality;
  if (recoveryEmail !== undefined) profileUpdates.recovery_email = recoveryEmail;
  if (mobile !== undefined) profileUpdates.mobile = mobile;
  if (emergencyContactName !== undefined) profileUpdates.emergency_contact_name = emergencyContactName;
  if (emergencyContactNumber !== undefined) profileUpdates.emergency_contact_number = emergencyContactNumber;

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...profileUpdates }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (fullName !== undefined || salutation !== undefined) {
    const meta = (user.user_metadata as Record<string, unknown>) ?? {};
    const newMeta: Record<string, unknown> = { ...meta };
    if (fullName !== undefined) newMeta.full_name = fullName ?? undefined;
    if (salutation !== undefined) newMeta.salutation = salutation ?? undefined;
    await supabase.auth.updateUser({ data: newMeta });
  }

  if (newEmail && newEmail !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
    if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 });
    await supabase.from("profiles").update({ email: newEmail }).eq("id", user.id);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/account", "layout");
  return NextResponse.json({ ok: true });
}
