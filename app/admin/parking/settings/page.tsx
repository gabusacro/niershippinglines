import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ParkingSettingsClient } from "./ParkingSettingsClient";

export const metadata = {
  title: "Parking Settings — Admin",
  description: "Configure parking rates, fees, commission, and policies",
};

export const dynamic = "force-dynamic";

export default async function ParkingSettingsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("parking_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    default_car_rate_cents:        data?.default_car_rate_cents        ?? 25000,
    default_motorcycle_rate_cents: data?.default_motorcycle_rate_cents ?? 25000,
    default_van_rate_cents:        data?.default_van_rate_cents        ?? null,
    commission_per_vehicle_cents:  data?.commission_per_vehicle_cents  ?? 10000,
    platform_fee_cents:            data?.platform_fee_cents            ?? 3500,
    processing_fee_cents:          data?.processing_fee_cents          ?? 3000,
    max_parking_days:              data?.max_parking_days              ?? 45,
    overstay_warning_day:          data?.overstay_warning_day          ?? 40,
    checkout_cutoff_hour:          data?.checkout_cutoff_hour          ?? 8,
    required_documents_text:       data?.required_documents_text       ?? "",
    surrender_policy_text:         data?.surrender_policy_text         ?? "",
    overstay_instructions_text:    data?.overstay_instructions_text    ?? "",
  };

  return <ParkingSettingsClient settings={settings} />;
}
