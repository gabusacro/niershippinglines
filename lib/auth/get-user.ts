import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/database";

export interface AuthUser {
  id: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
  salutation: string | null;
  address: string | null;
  approvedAt: string | null;
  gender: string | null;
  birthdate: string | null;
  nationality: string | null;
  recoveryEmail: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name, salutation, address, approved_at, gender, birthdate, nationality, recovery_email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[getAuthUser] profiles fetch error:", profileError.message);
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const metaFullName = typeof meta?.full_name === "string" ? meta.full_name.trim() || null : null;
  const metaSalutation = typeof meta?.salutation === "string" ? meta.salutation.trim() || null : null;

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as AppRole) ?? "passenger",
    fullName: profile?.full_name?.trim() || metaFullName || null,
    salutation: profile?.salutation?.trim() || metaSalutation || null,
    address: profile?.address ?? null,
    approvedAt: profile?.approved_at ?? null,
    gender: profile?.gender ?? null,
    birthdate: profile?.birthdate ?? null,
    nationality: profile?.nationality ?? null,
    recoveryEmail: profile?.recovery_email ?? null,
  };
}

export function isAdmin(role: AppRole): boolean {
  return role === "admin";
}
export function isCrewOrBooth(role: AppRole): boolean {
  return role === "crew" || role === "ticket_booth";
}
export function canAccessAdmin(role: AppRole): boolean {
  return role === "admin";
}
export function canAccessCrewDashboard(role: AppRole): boolean {
  return role === "admin" || role === "ticket_booth" || role === "crew";
}
export function canAccessCaptainDashboard(role: AppRole): boolean {
  return role === "admin" || role === "captain";
}
export function isPassenger(role: AppRole): boolean {
  return role === "passenger";
}
export function isStaff(role: AppRole): boolean {
  return role === "admin" || role === "captain" || role === "crew" || role === "ticket_booth";
}
export async function hasAnyAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}
