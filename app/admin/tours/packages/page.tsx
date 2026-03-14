import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import AdminPackagesApprovalClient from "./AdminPackagesApprovalClient";

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
  if (pkg.accepts_joiners)   types.push("Joiners");
  if (pkg.accepts_private)   types.push("Private");
  if (pkg.accepts_exclusive) types.push(`Exclusive (${pkg.exclusive_unit_label})`);
  if (pkg.is_hourly)         types.push("Hourly");
  if (pkg.is_per_person)     types.push("Per Person");
  return types.join(" · ") || "—";
}

export default async function AdminTourPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { updated, error: updateError } = await searchParams;

  const supabase = await createClient();

  // Admin markup setting
  const { data: settings } = await supabase
    .from("tour_settings")
    .select("admin_markup_per_pax_cents")
    .eq("id", 1)
    .single();
  const markupCents = settings?.admin_markup_per_pax_cents ?? 9900;

  // All packages
  const { data: packages, error } = await supabase
    .from("tour_packages")
    .select("*")
    .order("owner_type", { ascending: true }) // admin packages first
    .order("sort_order", { ascending: true });

  // Pending operator packages — need operator name
  const pendingRaw = (packages ?? []).filter(
    p => p.owner_type === "operator" && p.approval_status === "pending"
  );

  const operatorIds = [...new Set(pendingRaw.map(p => p.owner_id).filter(Boolean))];
  const { data: operatorProfiles } = operatorIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", operatorIds)
    : { data: [] };

  const profileMap = Object.fromEntries((operatorProfiles ?? []).map(p => [p.id, p.full_name ?? "—"]));

  const pendingPackages = pendingRaw.map(p => ({
    id: p.id,
    title: p.title ?? "",
    short_description: p.short_description ?? null,
    description: p.description ?? null,
    joiner_price_cents: p.joiner_price_cents ?? null,
    private_price_cents: p.private_price_cents ?? null,
    private_is_negotiable: p.private_is_negotiable ?? false,
    pickup_time_label: p.pickup_time_label ?? null,
    end_time_label: p.end_time_label ?? null,
    duration_label: p.duration_label ?? null,
    meeting_point: p.meeting_point ?? null,
    cancellation_policy: p.cancellation_policy ?? null,
    accepts_joiners: p.accepts_joiners ?? true,
    accepts_private: p.accepts_private ?? false,
    approval_status: p.approval_status ?? "pending",
    operator_name: p.owner_id ? (profileMap[p.owner_id] ?? "—") : "—",
    created_at: p.created_at,
  }));

  // Separate admin vs operator packages for display
  const adminPackages = (packages ?? []).filter(p => !p.owner_type || p.owner_type === "admin");
  const operatorPackages = (packages ?? []).filter(p => p.owner_type === "operator" && p.approval_status === "approved");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8 mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tour Packages</h1>
        <p className="mt-2 text-sm text-white/90">
          Manage your packages and review operator submissions.
        </p>
      </div>

      {/* Toasts */}
      {updated && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          ✅ &quot;{updated}&quot; updated successfully.
        </div>
      )}
      {updateError && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          ⚠️ {updateError}
        </div>
      )}

      {/* Pending approval queue — client component */}
      {pendingPackages.length > 0 && (
        <AdminPackagesApprovalClient
          pendingPackages={pendingPackages}
          markupCents={markupCents}
        />
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#134e4a]">
          Admin Packages
          <span className="ml-2 text-sm font-normal text-gray-400">({adminPackages.length})</span>
        </h2>
        <Link href="/admin/tours/packages/new"
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold transition-colors">
          + New Package
        </Link>
      </div>

      {/* Admin packages list */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          Failed to load packages: {error.message}
        </div>
      )}

      {adminPackages.length === 0 && !error ? (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 p-12 text-center mb-6">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold text-[#134e4a]">No packages yet</p>
          <p className="text-sm text-gray-500 mt-1">Create your first tour package to get started.</p>
          <Link href="/admin/tours/packages/new"
            className="mt-4 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            + New Package
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-gray-100 bg-white overflow-hidden mb-6">
          <div className="divide-y divide-gray-50">
            {adminPackages.map((pkg) => (
              <div key={pkg.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#134e4a]">{pkg.title}</p>
                    {!pkg.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    {pkg.is_featured && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⭐ Featured</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatBookingType(pkg as Record<string, unknown>)}</p>
                  {pkg.duration_label && (
                    <p className="text-xs text-gray-400">⏱ {pkg.duration_label}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-emerald-700">
                    {formatPrice(pkg as Record<string, unknown>)}
                  </div>
                  {pkg.accepts_private && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Private: {pkg.private_is_negotiable ? "Negotiable" : pkg.private_price_cents
                        ? `₱${(pkg.private_price_cents / 100).toLocaleString()}` : "Admin-set"}
                    </div>
                  )}
                </div>
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
        </div>
      )}

      {/* Approved operator packages */}
      {operatorPackages.length > 0 && (
        <>
          <h2 className="font-bold text-[#134e4a] mb-4">
            Operator Packages (Approved)
            <span className="ml-2 text-sm font-normal text-gray-400">({operatorPackages.length})</span>
          </h2>
          <div className="rounded-2xl border-2 border-purple-100 bg-white overflow-hidden mb-6">
            <div className="divide-y divide-gray-50">
              {operatorPackages.map((pkg) => {
                const opName = pkg.owner_id ? (profileMap[pkg.owner_id] ?? "—") : "—";
                return (
                  <div key={pkg.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[#134e4a]">{pkg.title}</p>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                          {opName}
                        </span>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✅ Approved</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatBookingType(pkg as Record<string, unknown>)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-emerald-700">
                        {formatPrice(pkg as Record<string, unknown>)}
                      </div>
                      <div className="text-xs text-gray-400">
                        +₱{(markupCents / 100)} markup → ₱{((( pkg.joiner_price_cents ?? 0) + markupCents) / 100).toLocaleString()} guest
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Back */}
      <div className="mt-6">
        <Link href="/admin/tours" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Tour Management
        </Link>
      </div>

    </div>
  );
}
