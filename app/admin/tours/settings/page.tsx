import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export const metadata = {
  title: "Settings — Tours Admin",
};

export default async function TourSettingsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("tour_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings) redirect("/admin/tours");

  // Ensure markup has a default if column was just added
  const settingsWithDefaults = {
    ...settings,
    admin_markup_per_pax_cents: settings.admin_markup_per_pax_cents ?? 9900,
  };

  return <SettingsClient settings={settingsWithDefaults} />;
}
