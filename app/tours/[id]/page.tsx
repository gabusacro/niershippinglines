import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!pkg) notFound();

  // Fetch markup — only needed for operator packages
  const isOperator = pkg.owner_type === "operator";
  const markupCents = isOperator ? await supabase
    .from("tour_settings")
    .select("admin_markup_per_pax_cents")
    .eq("id", 1)
    .single()
    .then(r => r.data?.admin_markup_per_pax_cents ?? 9900)
    : 0;

  const today = new Date().toISOString().slice(0, 10);

  const { data: schedules } = await supabase
    .from("tour_schedules")
    .select("id, available_date, departure_time, status, joiner_slots_total, joiner_slots_booked, private_slots_total, private_slots_booked, cutoff_at")
    .eq("tour_id", id)
    .eq("status", "open")
    .gte("available_date", today)
    .order("available_date", { ascending: true });

  function formatPrice(): string {
    if (pkg.joiner_price_cents) {
      const cents = pkg.joiner_price_cents + markupCents;
      return `₱${(cents / 100).toLocaleString()}/pax`;
    }
    if (pkg.exclusive_price_cents)
      return `₱${(pkg.exclusive_price_cents / 100).toLocaleString()}/${pkg.exclusive_unit_label}`;
    if (pkg.per_person_price_cents) {
      const cents = pkg.per_person_price_cents + markupCents;
      return `₱${(cents / 100).toLocaleString()}/person`;
    }
    if (pkg.hourly_price_min_cents) {
      const min = pkg.hourly_price_min_cents / 100;
      const max = pkg.hourly_price_max_cents ? pkg.hourly_price_max_cents / 100 : null;
      return max ? `₱${min}–₱${max}/hr` : `₱${min}/hr`;
    }
    return "Contact us";
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const availableSchedules = (schedules ?? []).filter(s => {
    const joinersAvailable = !pkg.accepts_joiners || s.joiner_slots_booked < s.joiner_slots_total;
    const privateAvailable = !pkg.accepts_private || s.private_slots_booked < s.private_slots_total;
    return joinersAvailable || privateAvailable;
  });

  return (
    <div className="min-h-screen bg-[#fafaf7]">

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/tours" className="text-sm text-white/70 hover:text-white mb-4 inline-block">
            ← Back to Tours
          </Link>
          <h1 className="text-3xl font-bold mb-3">{pkg.title}</h1>
          {pkg.short_description && (
            <p className="text-white/80 text-sm mb-4">{pkg.short_description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            {pkg.pickup_time_label && (
              <span>🕐 Pickup: <strong className="text-white">{pkg.pickup_time_label}</strong></span>
            )}
            {pkg.end_time_label && (
              <span>🏁 End: <strong className="text-white">{pkg.end_time_label}</strong></span>
            )}
            {pkg.duration_label && (
              <span>⏱ <strong className="text-white">{pkg.duration_label}</strong></span>
            )}
            {pkg.meeting_point && (
              <span>📍 <strong className="text-white">{pkg.meeting_point}</strong></span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Price & booking type */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-white p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-bold text-emerald-700">{formatPrice()}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pkg.accepts_joiners && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                  👥 Joiners available
                </span>
              )}
              {pkg.accepts_private && (
                <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-xs font-semibold text-teal-700">
                  🔒 Private booking available
                  {pkg.private_is_negotiable ? " (negotiable)" : pkg.private_price_cents ? ` – ₱${(pkg.private_price_cents / 100).toLocaleString()}` : ""}
                </span>
              )}
            </div>
          </div>
          {availableSchedules.length > 0 && (
            <a href="#pick-date"
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
              Book Now ↓
            </a>
          )}
        </div>

        {/* Description */}
        {pkg.description && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 mb-6">
            <h2 className="font-bold text-[#134e4a] mb-3">About this tour</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{pkg.description}</p>
          </div>
        )}

        {/* Requirements */}
        {(pkg.requires_health_declaration || pkg.min_age_override || pkg.max_age_override || pkg.is_weather_dependent) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6">
            <h2 className="font-bold text-amber-900 mb-2">⚠️ Requirements</h2>
            <ul className="text-sm text-amber-800 space-y-1">
              {pkg.min_age_override && <li>• Minimum age: {pkg.min_age_override} years old</li>}
              {pkg.max_age_override && <li>• Maximum age: {pkg.max_age_override} years old</li>}
              {pkg.requires_health_declaration && (
                <li>• Health declaration required — guests with heart conditions or serious medical issues are advised not to join</li>
              )}
              {pkg.is_weather_dependent && (
                <li>• This tour may be cancelled or rescheduled due to bad weather. Full refund if cancelled by operator.</li>
              )}
            </ul>
          </div>
        )}

        {/* Cancellation policy */}
        {pkg.cancellation_policy && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 mb-6">
            <h2 className="font-bold text-[#134e4a] mb-2">Cancellation Policy</h2>
            <p className="text-sm text-gray-600">{pkg.cancellation_policy}</p>
          </div>
        )}

        {/* Pick a date */}
        <div id="pick-date">
          <h2 className="text-lg font-bold text-[#134e4a] mb-4">📅 Available Dates</h2>

          {availableSchedules.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">📅</div>
              <p className="font-semibold text-gray-600">No available dates right now</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">New dates are added regularly. Contact us to request a date.</p>
              <a href="https://m.me/travelasiargao" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]">
                💬 Message us on Facebook
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {availableSchedules.map(s => {
                const joinersLeft = s.joiner_slots_total - s.joiner_slots_booked;
                const privateLeft = s.private_slots_total - s.private_slots_booked;
                return (
                  <div key={s.id}
                    className="rounded-2xl border-2 border-emerald-100 bg-white p-5 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#134e4a]">{formatDate(s.available_date)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Departure: {s.departure_time?.slice(0, 5)}</div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {pkg.accepts_joiners && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${joinersLeft > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                            👥 {joinersLeft > 0 ? `${joinersLeft} joiner slots left` : "Joiners full"}
                          </span>
                        )}
                        {pkg.accepts_private && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${privateLeft > 0 ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-400"}`}>
                            🔒 {privateLeft > 0 ? `${privateLeft} private slot${privateLeft > 1 ? "s" : ""} left` : "Private full"}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/tours/${id}/book?schedule=${s.id}`}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors flex-shrink-0">
                      Book This Date →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
