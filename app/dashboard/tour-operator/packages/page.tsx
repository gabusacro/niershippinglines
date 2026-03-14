import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import OperatorPackagesClient from "./OperatorPackagesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Packages — Tour Operator" };

export default async function OperatorPackagesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const supabase = await createClient();

  // Get admin markup setting
  const { data: settings } = await supabase
    .from("tour_settings")
    .select("admin_markup_per_pax_cents")
    .eq("id", 1)
    .single();

  const markupCents = settings?.admin_markup_per_pax_cents ?? 9900;

  // Get all packages: admin packages (visible/reference) + own packages
  const { data: adminPackages } = await supabase
    .from("tour_packages")
    .select("id, title, short_description, joiner_price_cents, is_active, is_featured, sort_order, approval_status, owner_type")
    .eq("owner_type", "admin")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Own packages
  const { data: myPackages } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("owner_type", "operator")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <OperatorPackagesClient
      operatorId={user.id}
      operatorName={profile?.full_name ?? "Operator"}
      adminPackages={(adminPackages ?? []).map(p => ({
        id: p.id,
        title: p.title,
        short_description: p.short_description ?? "",
        joiner_price_cents: p.joiner_price_cents ?? 0,
        is_active: p.is_active,
      }))}
      myPackages={(myPackages ?? []).map(p => ({
        id: p.id,
        title: p.title ?? "",
        short_description: p.short_description ?? "",
        description: p.description ?? "",
        joiner_price_cents: p.joiner_price_cents ?? 0,
        private_price_cents: p.private_price_cents ?? 0,
        private_is_negotiable: p.private_is_negotiable ?? false,
        pickup_time_label: p.pickup_time_label ?? "",
        end_time_label: p.end_time_label ?? "",
        duration_label: p.duration_label ?? "",
        meeting_point: p.meeting_point ?? "",
        cancellation_policy: p.cancellation_policy ?? "",
        is_active: p.is_active ?? true,
        approval_status: p.approval_status ?? "pending",
        approval_note: p.approval_note ?? null,
        accepts_joiners: p.accepts_joiners ?? true,
        accepts_private: p.accepts_private ?? false,
        created_at: p.created_at,
      }))}
      markupCents={markupCents}
    />
  );
}
