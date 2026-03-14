import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ToursContactForm from "@/components/ToursContactForm";

export const metadata = {
  title: "Tours — Travela Siargao",
  description: "Book island hopping, land tours, transfers and more with Travela Siargao.",
};

export default async function ToursPage() {
  const supabase = await createClient();

  const { data: packages } = await supabase
    .from("tour_packages")
    .select("id, title, short_description, joiner_price_cents, exclusive_price_cents, per_person_price_cents, hourly_price_min_cents, hourly_price_max_cents, accepts_joiners, accepts_private, accepts_exclusive, is_hourly, is_per_person, exclusive_unit_label, is_featured, is_weather_dependent, pickup_time_label, end_time_label, duration_label, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  function formatPrice(pkg: typeof packages extends (infer T)[] | null ? T : never): string {
    if (!pkg) return "";
    if ("joiner_price_cents" in pkg && pkg.joiner_price_cents)
      return `₱${((pkg.joiner_price_cents as number) / 100).toLocaleString()}/pax`;
    if ("exclusive_price_cents" in pkg && pkg.exclusive_price_cents)
      return `₱${((pkg.exclusive_price_cents as number) / 100).toLocaleString()}/${pkg.exclusive_unit_label}`;
    if ("per_person_price_cents" in pkg && pkg.per_person_price_cents)
      return `₱${((pkg.per_person_price_cents as number) / 100).toLocaleString()}/person`;
    if ("hourly_price_min_cents" in pkg && pkg.hourly_price_min_cents) {
      const min = (pkg.hourly_price_min_cents as number) / 100;
      const max = pkg.hourly_price_max_cents ? (pkg.hourly_price_max_cents as number) / 100 : null;
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
        <h1 className="text-3xl font-bold sm:text-4xl">🏝️ Travel & Tours</h1>
        <p className="mt-3 max-w-xl mx-auto text-white/80 text-sm">
          Island hopping, lagoon adventures, transfers and more. All tours include a local guide and are run by Local Tour Operator/s.
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Featured packages */}
        {featured.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-[#134e4a] mb-4">⭐ Popular Tours</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(pkg => (
                <Link key={pkg.id} href={`/tours/${pkg.id}`}
                  className="group rounded-2xl border-2 border-emerald-200 bg-white p-5 hover:border-emerald-400 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-[#134e4a] group-hover:text-emerald-700 transition-colors">
                      {pkg.title}
                    </h3>
                    {pkg.is_weather_dependent && (
                      <span className="flex-shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">🌤</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{pkg.short_description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-4">
                    {pkg.pickup_time_label && <span>🕐 {pkg.pickup_time_label}</span>}
                    {pkg.duration_label && <span>⏱ {pkg.duration_label}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-emerald-700">{formatPrice(pkg)}</span>
                    <span className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white group-hover:bg-emerald-700 transition-colors">
                      Book Now →
                    </span>
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
                  className="group flex flex-wrap items-center gap-4 rounded-2xl border-2 border-gray-100 bg-white p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                    <div className="text-lg font-bold text-emerald-700">{formatPrice(pkg)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">View details →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(packages ?? []).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏝️</div>
            <p className="font-semibold">No tours available right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}




        {/* Contact footer */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-6 text-center text-white">
          <p className="font-bold text-lg mb-1">Need a custom tour?</p>
          <p className="text-sm text-white/80 mb-4">Email us directly for group rates, special requests, or same-day bookings.</p>
          <a href="https://m.me/travelasiargao" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-white/90 transition-colors">
            💬 Message on Facebook
          </a>
        </div>

        
        <ToursContactForm />

      </div>
    </div>
  );
}