import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/database";

export interface AuthUser {
  id: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
  approvedAt: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, approved_at")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as AppRole) ?? "crew",
    fullName: profile?.full_name ?? null,
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
