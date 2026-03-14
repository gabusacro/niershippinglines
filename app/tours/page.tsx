import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ToursContactForm from "@/components/ToursContactForm";

export const metadata = {
  title: "Tours — Travela Siargao",
  description: "Book island hopping, land tours, transfers and more with Travela Siargao.",
};

export default async function ToursPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("tour_settings")
    .select("admin_markup_per_pax_cents")
    .eq("id", 1)
    .single();
  const markupCents = settings?.admin_markup_per_pax_cents ?? 9900;

  const { data: packages } = await supabase
    .from("tour_packages")
    .select("id, title, short_description, joiner_price_cents, exclusive_price_cents, per_person_price_cents, hourly_price_min_cents, hourly_price_max_cents, accepts_joiners, accepts_private, accepts_exclusive, is_hourly, is_per_person, exclusive_unit_label, is_featured, is_weather_dependent, pickup_time_label, end_time_label, duration_label, sort_order, owner_type, cover_image_url")
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("sort_order", { ascending: true });

  function getDisplayPrice(pkg: {
    owner_type?: string | null;
    joiner_price_cents?: number | null;
    exclusive_price_cents?: number | null;
    exclusive_unit_label?: string | null;
    per_person_price_cents?: number | null;
    hourly_price_min_cents?: number | null;
    hourly_price_max_cents?: number | null;
  }): string {
    const isOperator = pkg.owner_type === "operator";
    if (pkg.joiner_price_cents) {
      const cents = pkg.joiner_price_cents + (isOperator ? markupCents : 0);
      return `₱${(cents / 100).toLocaleString()}/pax`;
    }
    if (pkg.exclusive_price_cents)
      return `₱${(pkg.exclusive_price_cents / 100).toLocaleString()}/${pkg.exclusive_unit_label}`;
    if (pkg.per_person_price_cents) {
      const cents = pkg.per_person_price_cents + (isOperator ? markupCents : 0);
      return `₱${(cents / 100).toLocaleString()}/person`;
    }
    if (pkg.hourly_price_min_cents) {
      const min = pkg.hourly_price_min_cents / 100;
      const max = pkg.hourly_price_max_cents ? pkg.hourly_price_max_cents / 100 : null;
      return max ? `₱${min}–₱${max}/hr` : `₱${min}/hr`;
    }
    return "Contact us";
  }

  const featured = (packages ?? []).filter(p => p.is_featured);
  const regular  = (packages ?? []).filter(p => !p.is_featured);

  return (
    <div className="min-h-screen bg-[#fafaf7]">

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-16 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-widest text-white/70 mb-2">Travela Siargao</p>
        <h1 className="text-3xl font-bold sm:text-4xl">🌴 Travel & Tours</h1>
        <p className="mt-3 max-w-xl mx-auto text-white/80 text-sm">
          Island hopping, lagoon adventures, transfers and more. All tours include a local guide and are run by Local Tour Operator/s.
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Featured packages */}
        {featured.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-[#134e4a] mb-4">⭐ Popular Tours</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(pkg => (
                <Link key={pkg.id} href={`/tours/${pkg.id}`}
                  className="group flex flex-col rounded-2xl border-2 border-emerald-100 bg-white hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden">
                  {/* Cover photo or placeholder */}
                  {pkg.cover_image_url ? (
                    <div className="h-44 overflow-hidden">
                      <img src={pkg.cover_image_url} alt={pkg.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <span className="text-5xl opacity-40">🌴</span>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-[#134e4a] group-hover:text-emerald-700 transition-colors leading-tight">
                          {pkg.title}
                        </h3>
                        {pkg.is_weather_dependent && (
                          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">🌤</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{pkg.short_description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                        {pkg.pickup_time_label && <span>🕐 {pkg.pickup_time_label}</span>}
                        {pkg.duration_label && <span>⏱ {pkg.duration_label}</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-emerald-700">{getDisplayPrice(pkg)}</span>
                      <span className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white group-hover:bg-emerald-700 transition-colors">
                        Book Now →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All other packages */}
        {regular.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-[#134e4a] mb-4">All Services</h2>
            <div className="space-y-3">
              {regular.map(pkg => (
                <Link key={pkg.id} href={`/tours/${pkg.id}`}
                  className="group flex items-center gap-4 rounded-2xl border-2 border-gray-100 bg-white p-4 hover:border-emerald-200 hover:shadow-sm transition-all overflow-hidden">
                  {/* Thumbnail */}
                  {pkg.cover_image_url ? (
                    <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden">
                      <img src={pkg.cover_image_url} alt={pkg.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 shrink-0 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <span className="text-2xl opacity-40">🌴</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-bold text-[#134e4a] group-hover:text-emerald-700 transition-colors">
                        {pkg.title}
                      </h3>
                      {pkg.is_weather_dependent && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">🌤 Weather dependent</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{pkg.short_description}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                      {pkg.pickup_time_label && <span>🕐 {pkg.pickup_time_label}</span>}
                      {pkg.duration_label && <span>⏱ {pkg.duration_label}</span>}
                      {pkg.accepts_joiners && <span className="text-emerald-600">👥 Joiners available</span>}
                      {pkg.accepts_private && <span className="text-teal-600">🔒 Private available</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-emerald-700">{getDisplayPrice(pkg)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">View details →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(packages ?? []).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🌴</div>
            <p className="font-semibold">No tours available right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}

        <ToursContactForm />
      </div>
    </div>
  );
}
