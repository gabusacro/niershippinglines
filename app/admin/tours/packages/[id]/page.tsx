import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <Link href="/admin/tours/packages" className="hover:underline">Packages</Link>
        <span>/</span>
        <span className="font-semibold truncate">{pkg.title}</span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">✏️ Edit Package</h1>
        <Link href={`/admin/tours/packages/${id}/schedules`}
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100">
          📅 Manage Schedules
        </Link>
      </div>

      <form action={`/api/admin/tours/packages/${id}`} method="POST">
        <input type="hidden" name="_method" value="PATCH" />

        {/* Basic Info */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
          <h2 className="font-bold text-[#134e4a] mb-4">Basic Info</h2>
          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input name="title" defaultValue={pkg.title} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
              <input name="short_description" defaultValue={pkg.short_description ?? ""}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
              <textarea name="description" defaultValue={pkg.description ?? ""} rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
                <input name="pickup_time_label" defaultValue={pkg.pickup_time_label ?? ""}
                  placeholder="e.g. 7:45–8:00 AM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input name="end_time_label" defaultValue={pkg.end_time_label ?? ""}
                  placeholder="e.g. 4:30–5:00 PM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <input name="duration_label" defaultValue={pkg.duration_label ?? ""}
                  placeholder="e.g. Full day (~8–9 hours)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Point</label>
                <input name="meeting_point" defaultValue={pkg.meeting_point ?? ""}
                  placeholder="e.g. General Luna area"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>

          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
          <h2 className="font-bold text-[#134e4a] mb-4">Pricing</h2>
          <div className="space-y-4">

            {pkg.accepts_joiners && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Joiner Price (₱) — per person
                </label>
                <input name="joiner_price" type="number" min="0" step="50"
                  defaultValue={pkg.joiner_price_cents ? pkg.joiner_price_cents / 100 : ""}
                  placeholder="e.g. 1700"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            )}

            {pkg.accepts_private && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Price (₱) — per group
                  </label>
                  <input name="private_price" type="number" min="0" step="100"
                    defaultValue={pkg.private_price_cents ? pkg.private_price_cents / 100 : ""}
                    placeholder="Leave blank if negotiable"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" name="private_is_negotiable"
                      defaultChecked={pkg.private_is_negotiable}
                      className="rounded border-gray-300 text-emerald-600" />
                    Price is negotiable
                  </label>
                </div>
              </div>
            )}

            {pkg.accepts_exclusive && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exclusive Price (₱) — per {pkg.exclusive_unit_label ?? "unit"}
                  </label>
                  <input name="exclusive_price" type="number" min="0" step="100"
                    defaultValue={pkg.exclusive_price_cents ? pkg.exclusive_price_cents / 100 : ""}
                    placeholder="e.g. 6500"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Label</label>
                  <input name="exclusive_unit_label" defaultValue={pkg.exclusive_unit_label ?? ""}
                    placeholder="e.g. van, tuk tuk"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
            )}

            {pkg.is_hourly && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Hourly Rate (₱)</label>
                  <input name="hourly_price_min" type="number" min="0" step="50"
                    defaultValue={pkg.hourly_price_min_cents ? pkg.hourly_price_min_cents / 100 : ""}
                    placeholder="e.g. 500"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Hourly Rate (₱)</label>
                  <input name="hourly_price_max" type="number" min="0" step="50"
                    defaultValue={pkg.hourly_price_max_cents ? pkg.hourly_price_max_cents / 100 : ""}
                    placeholder="e.g. 800"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
            )}

            {pkg.is_per_person && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Per Person Price (₱)
                </label>
                <input name="per_person_price" type="number" min="0" step="50"
                  defaultValue={pkg.per_person_price_cents ? pkg.per_person_price_cents / 100 : ""}
                  placeholder="e.g. 300"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            )}

          </div>
        </section>

        {/* Visibility & Flags */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
          <h2 className="font-bold text-[#134e4a] mb-4">Visibility & Flags</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <input type="checkbox" name="is_active" defaultChecked={pkg.is_active}
                className="rounded border-gray-300 text-emerald-600 w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-gray-800">Active</div>
                <div className="text-xs text-gray-500">Visible on public /tours page</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <input type="checkbox" name="is_featured" defaultChecked={pkg.is_featured}
                className="rounded border-gray-300 text-emerald-600 w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-gray-800">Featured</div>
                <div className="text-xs text-gray-500">Shows ⭐ badge on listing</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <input type="checkbox" name="is_weather_dependent" defaultChecked={pkg.is_weather_dependent}
                className="rounded border-gray-300 text-emerald-600 w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-gray-800">Weather Dependent</div>
                <div className="text-xs text-gray-500">Shows weather warning badge</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <input type="checkbox" name="requires_health_declaration" defaultChecked={pkg.requires_health_declaration}
                className="rounded border-gray-300 text-emerald-600 w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-gray-800">Health Declaration</div>
                <div className="text-xs text-gray-500">Required at booking</div>
              </div>
            </label>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input name="sort_order" type="number" min="1" max="99"
              defaultValue={pkg.sort_order}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            <p className="text-xs text-gray-400 mt-1">Lower number = shown first</p>
          </div>
        </section>

        {/* Cancellation Policy */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Cancellation Policy</h2>
          <textarea name="cancellation_policy" defaultValue={pkg.cancellation_policy ?? ""} rows={3}
            placeholder="e.g. Full refund if cancelled 48 hours before tour date."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
        </section>

        {/* Save button — NOTE: wires up after API route is built */}
        <div className="flex items-center justify-between">
          <Link href="/admin/tours/packages"
            className="text-sm font-medium text-gray-500 hover:text-gray-700">
            ← Cancel
          </Link>
          <div className="flex gap-3">
            <Link href={`/admin/tours/packages/${id}/schedules`}
              className="rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              📅 Schedules
            </Link>
            <button type="submit"
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </form>

    </div>
  );
}