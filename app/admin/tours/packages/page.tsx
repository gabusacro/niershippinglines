import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Tour Packages — Admin",
};

function formatPrice(pkg: Record<string, unknown>): string {
  if (pkg.joiner_price_cents)
    return `₱${((pkg.joiner_price_cents as number) / 100).toLocaleString()}/pax`;
  if (pkg.exclusive_price_cents)
    return `₱${((pkg.exclusive_price_cents as number) / 100).toLocaleString()}/${pkg.exclusive_unit_label}`;
  if (pkg.per_person_price_cents)
    return `₱${((pkg.per_person_price_cents as number) / 100).toLocaleString()}/person`;
  if (pkg.hourly_price_min_cents) {
    const min = (pkg.hourly_price_min_cents as number) / 100;
    const max = pkg.hourly_price_max_cents
      ? (pkg.hourly_price_max_cents as number) / 100
      : null;
    return max ? `₱${min}–₱${max}/hr` : `₱${min}/hr`;
  }
  return "Admin-set";
}

function formatBookingType(pkg: Record<string, unknown>): string {
  const types: string[] = [];
  if (pkg.accepts_joiners)  types.push("Joiners");
  if (pkg.accepts_private)  types.push("Private");
  if (pkg.accepts_exclusive) types.push(`Exclusive (${pkg.exclusive_unit_label})`);
  if (pkg.is_hourly)        types.push("Hourly");
  if (pkg.is_per_person)    types.push("Per Person");
  return types.join(" · ") || "—";
}

export default async function AdminTourPackagesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: packages, error } = await supabase
    .from("tour_packages")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-emerald-700 mb-1">
            <Link href="/admin" className="hover:underline">Admin</Link>
            <span>/</span>
            <Link href="/admin/tours" className="hover:underline">Tours</Link>
            <span>/</span>
            <span className="font-semibold">Packages</span>
          </div>
          <h1 className="text-2xl font-bold text-[#134e4a]">📦 Tour Packages</h1>
          <p className="text-sm text-[#0f766e]/80 mt-1">
            {packages?.length ?? 0} packages · All prices editable from each package
          </p>
        </div>
        <Link href="/admin/tours/packages/new"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
          + New Package
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
          Failed to load packages: {error.message}
        </div>
      )}

      {/* Package list */}
      <div className="space-y-3">
        {(packages ?? []).map((pkg) => (
          <div key={pkg.id}
            className="rounded-2xl border-2 border-emerald-100 bg-white p-5 flex flex-wrap items-center gap-4 hover:border-emerald-300 hover:shadow-sm transition-all">

            {/* Sort order badge */}
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
              {pkg.sort_order}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-[#134e4a] text-base">{pkg.title}</span>
                {pkg.is_featured && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">⭐ Featured</span>
                )}
                {!pkg.is_active && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Inactive</span>
                )}
                {pkg.is_weather_dependent && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600">🌤 Weather dependent</span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{pkg.short_description}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#0f766e]">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium border border-emerald-100">
                  {formatBookingType(pkg as Record<string, unknown>)}
                </span>
                {pkg.pickup_time_label && (
                  <span className="text-gray-400">🕐 {pkg.pickup_time_label} → {pkg.end_time_label}</span>
                )}
                {pkg.duration_label && (
                  <span className="text-gray-400">⏱ {pkg.duration_label}</span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-emerald-700">
                {formatPrice(pkg as Record<string, unknown>)}
              </div>
              {pkg.accepts_private && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Private: {pkg.private_is_negotiable ? "Negotiable" : pkg.private_price_cents ? `₱${(pkg.private_price_cents / 100).toLocaleString()}` : "Admin-set"}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/admin/tours/packages/${pkg.id}`}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                Edit
              </Link>
              <Link href={`/admin/tours/packages/${pkg.id}/schedules`}
                className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
                Schedules
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {(packages ?? []).length === 0 && !error && (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold text-[#134e4a]">No packages yet</p>
          <p className="text-sm text-gray-500 mt-1">Create your first tour package to get started.</p>
          <Link href="/admin/tours/packages/new"
            className="mt-4 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            + New Package
          </Link>
        </div>
      )}

      {/* Back */}
      <div className="mt-6">
        <Link href="/admin/tours"
          className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Tours
        </Link>
      </div>
    </div>
  );
}