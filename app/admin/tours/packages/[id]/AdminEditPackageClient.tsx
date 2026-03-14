"use client";

import { useState } from "react";
import Link from "next/link";
import PackagePhotoUpload from "@/components/PackagePhotoUpload";

interface PkgData {
  title: string;
  short_description: string;
  description: string;
  pickup_time_label: string;
  end_time_label: string;
  duration_label: string;
  meeting_point: string;
  cancellation_policy: string;
  joiner_price_cents: number;
  private_price_cents: number;
  private_is_negotiable: boolean;
  exclusive_price_cents: number;
  exclusive_unit_label: string;
  hourly_price_min_cents: number;
  hourly_price_max_cents: number;
  per_person_price_cents: number;
  accepts_joiners: boolean;
  accepts_private: boolean;
  accepts_exclusive: boolean;
  is_hourly: boolean;
  is_per_person: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_weather_dependent: boolean;
  requires_health_declaration: boolean;
  sort_order: number;
  cover_image_url: string | null;
  gallery_urls: string[];
}

interface Props {
  id: string;
  pkg: PkgData;
}

export default function AdminEditPackageClient({ id, pkg }: Props) {
  const [form, setForm] = useState(pkg);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function setField<K extends keyof PkgData>(key: K, value: PkgData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/tours/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          short_description: form.short_description || null,
          description: form.description || null,
          pickup_time_label: form.pickup_time_label || null,
          end_time_label: form.end_time_label || null,
          duration_label: form.duration_label || null,
          meeting_point: form.meeting_point || null,
          cancellation_policy: form.cancellation_policy || null,
          joiner_price: form.joiner_price_cents / 100 || null,
          private_price: form.private_price_cents / 100 || null,
          private_is_negotiable: form.private_is_negotiable,
          exclusive_price: form.exclusive_price_cents / 100 || null,
          exclusive_unit_label: form.exclusive_unit_label || null,
          hourly_price_min: form.hourly_price_min_cents / 100 || null,
          hourly_price_max: form.hourly_price_max_cents / 100 || null,
          per_person_price: form.per_person_price_cents / 100 || null,
          is_active: form.is_active,
          is_featured: form.is_featured,
          is_weather_dependent: form.is_weather_dependent,
          requires_health_declaration: form.requires_health_declaration,
          sort_order: form.sort_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSuccess("Package updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4 flex-wrap">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <Link href="/admin/tours/packages" className="hover:underline">Packages</Link>
        <span>/</span>
        <span className="font-semibold truncate max-w-[200px]">{form.title}</span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">✏️ Edit Package</h1>
        <Link href={`/admin/tours/packages/${id}/schedules`}
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100">
          📅 Manage Schedules
        </Link>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold border ${
          error ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {error || success}
        </div>
      )}

      <div className="space-y-4">

        {/* 📸 Photos — first so it's prominent */}
        <PackagePhotoUpload
          packageId={id}
          currentCoverUrl={form.cover_image_url}
          currentGalleryUrls={form.gallery_urls}
          onUpdate={(coverUrl, galleryUrls) => {
            setField("cover_image_url", coverUrl);
            setField("gallery_urls", galleryUrls);
          }}
        />

        {/* Basic Info */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Basic Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input value={form.title} onChange={e => setField("title", e.target.value)} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
              <input value={form.short_description} onChange={e => setField("short_description", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
              <textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
                <input value={form.pickup_time_label} onChange={e => setField("pickup_time_label", e.target.value)}
                  placeholder="e.g. 7:45–8:00 AM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input value={form.end_time_label} onChange={e => setField("end_time_label", e.target.value)}
                  placeholder="e.g. 4:30–5:00 PM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <input value={form.duration_label} onChange={e => setField("duration_label", e.target.value)}
                  placeholder="e.g. Full day (~8–9 hours)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Point</label>
                <input value={form.meeting_point} onChange={e => setField("meeting_point", e.target.value)}
                  placeholder="e.g. General Luna area"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Pricing</h2>
          <div className="space-y-4">
            {form.accepts_joiners && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Joiner Price (₱) — per person</label>
                <input type="number" min="0" step="50"
                  value={form.joiner_price_cents ? form.joiner_price_cents / 100 : ""}
                  onChange={e => setField("joiner_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                  placeholder="e.g. 1700"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            )}
            {form.accepts_private && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Private Price (₱) — per group</label>
                  <input type="number" min="0" step="100"
                    value={form.private_price_cents ? form.private_price_cents / 100 : ""}
                    onChange={e => setField("private_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                    placeholder="Leave blank if negotiable"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.private_is_negotiable}
                      onChange={e => setField("private_is_negotiable", e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600" />
                    Price is negotiable
                  </label>
                </div>
              </div>
            )}
            {form.accepts_exclusive && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exclusive Price (₱) — per {form.exclusive_unit_label || "unit"}
                  </label>
                  <input type="number" min="0" step="100"
                    value={form.exclusive_price_cents ? form.exclusive_price_cents / 100 : ""}
                    onChange={e => setField("exclusive_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                    placeholder="e.g. 6500"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Label</label>
                  <input value={form.exclusive_unit_label}
                    onChange={e => setField("exclusive_unit_label", e.target.value)}
                    placeholder="e.g. van, tuk tuk"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
            )}
            {form.is_hourly && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Hourly Rate (₱)</label>
                  <input type="number" min="0" step="50"
                    value={form.hourly_price_min_cents ? form.hourly_price_min_cents / 100 : ""}
                    onChange={e => setField("hourly_price_min_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                    placeholder="e.g. 500"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Hourly Rate (₱)</label>
                  <input type="number" min="0" step="50"
                    value={form.hourly_price_max_cents ? form.hourly_price_max_cents / 100 : ""}
                    onChange={e => setField("hourly_price_max_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                    placeholder="e.g. 800"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
            )}
            {form.is_per_person && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Person Price (₱)</label>
                <input type="number" min="0" step="50"
                  value={form.per_person_price_cents ? form.per_person_price_cents / 100 : ""}
                  onChange={e => setField("per_person_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                  placeholder="e.g. 300"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            )}
          </div>
        </section>

        {/* Cancellation Policy */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Cancellation Policy</h2>
          <textarea value={form.cancellation_policy}
            onChange={e => setField("cancellation_policy", e.target.value)}
            rows={4} placeholder="e.g. Full refund if cancelled 48 hours before tour date."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
        </section>

        {/* Visibility & Flags */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Visibility & Flags</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "is_active" as const,                label: "Active",               desc: "Visible on public /tours page" },
              { key: "is_featured" as const,              label: "Featured",             desc: "Shows ⭐ badge on listing" },
              { key: "is_weather_dependent" as const,     label: "Weather Dependent",    desc: "Shows weather warning badge" },
              { key: "requires_health_declaration" as const, label: "Health Declaration", desc: "Required at booking" },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <input type="checkbox" checked={form[key] as boolean}
                  onChange={e => setField(key, e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 w-4 h-4" />
                <div>
                  <div className="text-sm font-medium text-gray-800">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sort_order}
              onChange={e => setField("sort_order", parseInt(e.target.value) || 0)}
              className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            <p className="text-xs text-gray-400 mt-1">Lower number = shown first</p>
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center justify-between pt-2 pb-6">
          <Link href="/admin/tours/packages" className="text-sm text-gray-500 hover:underline">
            ← Cancel
          </Link>
          <div className="flex gap-3">
            <Link href={`/admin/tours/packages/${id}/schedules`}
              className="rounded-xl border-2 border-teal-200 bg-teal-50 px-5 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
              📅 Schedules
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="rounded-2xl bg-emerald-600 px-8 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
