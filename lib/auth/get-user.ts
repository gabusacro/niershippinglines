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
}

export async function getAuthUser(): Promise<AuthUser | null> {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name, salutation, address, approved_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[getAuthUser] profiles fetch error:", profileError.message);
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as AppRole) ?? "passenger",
    fullName: profile?.full_name ?? null,
    salutation: profile?.salutation ?? null,
    address: profile?.address ?? null,
    approvedAt: profile?.approved_at ?? null,
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

/** Staff = admin, captain, crew, ticket_booth (assigned by admin). Passengers are everyone else. */
export function isStaff(role: AppRole): boolean {
  return role === "admin" || role === "captain" || role === "crew" || role === "ticket_booth";
}

/** True if at least one admin exists (used to hide first-admin setup link once an admin is set). */
export async function hasAnyAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}
