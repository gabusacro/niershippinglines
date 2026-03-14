import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import AdminEditPackageClient from "./AdminEditPackageClient";

export const metadata = { title: "Edit Tour Package — Admin" };

export default async function EditTourPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: pkg, error } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("id", id)
    .single();

  if (!pkg || error) notFound();

  return (
    <AdminEditPackageClient
      id={id}
      pkg={{
        title: pkg.title ?? "",
        short_description: pkg.short_description ?? "",
        description: pkg.description ?? "",
        pickup_time_label: pkg.pickup_time_label ?? "",
        end_time_label: pkg.end_time_label ?? "",
        duration_label: pkg.duration_label ?? "",
        meeting_point: pkg.meeting_point ?? "",
        cancellation_policy: pkg.cancellation_policy ?? "",
        joiner_price_cents: pkg.joiner_price_cents ?? 0,
        private_price_cents: pkg.private_price_cents ?? 0,
        private_is_negotiable: pkg.private_is_negotiable ?? false,
        exclusive_price_cents: pkg.exclusive_price_cents ?? 0,
        exclusive_unit_label: pkg.exclusive_unit_label ?? "",
        hourly_price_min_cents: pkg.hourly_price_min_cents ?? 0,
        hourly_price_max_cents: pkg.hourly_price_max_cents ?? 0,
        per_person_price_cents: pkg.per_person_price_cents ?? 0,
        accepts_joiners: pkg.accepts_joiners ?? false,
        accepts_private: pkg.accepts_private ?? false,
        accepts_exclusive: pkg.accepts_exclusive ?? false,
        is_hourly: pkg.is_hourly ?? false,
        is_per_person: pkg.is_per_person ?? false,
        is_active: pkg.is_active ?? true,
        is_featured: pkg.is_featured ?? false,
        is_weather_dependent: pkg.is_weather_dependent ?? false,
        requires_health_declaration: pkg.requires_health_declaration ?? true,
        sort_order: pkg.sort_order ?? 0,
        cover_image_url: pkg.cover_image_url ?? null,
        gallery_urls: pkg.gallery_urls ?? [],
      }}
    />
  );
}
