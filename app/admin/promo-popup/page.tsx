"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const PAGES = [
  { value: "all", label: "All Pages" },
  { value: "/", label: "Homepage" },
  { value: "/tours", label: "Tours" },
  { value: "/schedule", label: "Schedule" },
  { value: "/book", label: "Booking Page" },
  { value: "/parking", label: "Pay Parking (when built)" },
];

type PopupForm = {
  is_active: boolean;
  image_url: string;
  headline: string;
  subtext: string;
  button_label: string;
  button_url: string;
  show_on: string[];
  expires_days: number;
};

const DEFAULT: PopupForm = {
  is_active: false,
  image_url: "",
  headline: "",
  subtext: "",
  button_label: "Book Now",
  button_url: "",
  show_on: ["all"],
  expires_days: 7,
};

export default function PromoPopupPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<PopupForm>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<"url" | "upload">("upload");

  // Load existing settings
  useEffect(() => {
    fetch("/api/admin/promo-popup")
      .then((r) => r.json())
      .then((d) => {
        if (d) {
          setForm({
            is_active: d.is_active ?? false,
            image_url: d.image_url ?? "",
            headline: d.headline ?? "",
            subtext: d.subtext ?? "",
            button_label: d.button_label ?? "Book Now",
            button_url: d.button_url ?? "",
            show_on: d.show_on ?? ["all"],
            expires_days: d.expires_days ?? 7,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Handle image upload to Supabase Storage
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `promo-popup/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("promo-media")
        .upload(path, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from("promo-media").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: publicUrl }));
      toast.showSuccess("Image uploaded!");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function togglePage(val: string) {
    if (val === "all") {
      setForm((f) => ({ ...f, show_on: ["all"] }));
      return;
    }
    setForm((f) => {
      const curr = f.show_on.filter((v) => v !== "all");
      return {
        ...f,
        show_on: curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.showSuccess(data.message ?? "Promo popup saved.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#0c7b93] text-sm font-medium animate-pulse">Loading popup settings…</div>
      </div>
    );
  }

  // Live preview — mirrors PromoPopup.tsx exactly
  const hasImage = Boolean(form.image_url);
  const hasText = Boolean(form.headline || form.subtext);
  const hasButton = Boolean(form.button_label && form.button_url);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#134e4a]">📢 Promo Popup Banner</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        Set up a promotional popup that appears to visitors. Shows once, then hides for the number of days you set.
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Active toggle */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#134e4a]">Popup Active</p>
                <p className="text-xs text-[#0f766e] mt-0.5">Turn on to show popup to visitors</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/40 ${
                  form.is_active ? "bg-[#0c7b93]" : "bg-gray-300"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                  form.is_active ? "left-7" : "left-1"
                }`} />
              </button>
            </div>
            {form.is_active && (
              <p className="mt-3 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                ✅ Popup is LIVE — visitors will see it on your site
              </p>
            )}
          </div>

          {/* Image */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Promo Image</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setImageMode("upload")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  imageMode === "upload" ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"
                }`}>
                📁 Upload Image
              </button>
              <button type="button" onClick={() => setImageMode("url")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  imageMode === "url" ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"
                }`}>
                🔗 Paste URL
              </button>
            </div>

            {imageMode === "upload" ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-teal-200 rounded-xl py-6 text-sm text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  {uploading ? "⏳ Uploading…" : "Click to choose image"}
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="https://example.com/promo-banner.jpg"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            )}

            {form.image_url && (
              <div className="relative">
                <img src={form.image_url} alt="Preview" className="rounded-xl w-full max-h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-black/80"
                >×</button>
              </div>
            )}
          </div>

          {/* Text overlay */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Text Overlay</p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Headline</label>
              <input
                type="text"
                placeholder="e.g. 🏝️ Summer Sale! 20% Off Tours"
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Subtext</label>
              <input
                type="text"
                placeholder="e.g. Book now and save on island tours"
                value={form.subtext}
                onChange={(e) => setForm((f) => ({ ...f, subtext: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
          </div>

          {/* Button */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Button</p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Button Label</label>
              <input
                type="text"
                placeholder="e.g. Book Now"
                value={form.button_label}
                onChange={(e) => setForm((f) => ({ ...f, button_label: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Button URL</label>
              <input
                type="text"
                placeholder="e.g. /tours or https://..."
                value={form.button_url}
                onChange={(e) => setForm((f) => ({ ...f, button_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
          </div>

          {/* Show on pages */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Show On Pages</p>
            <div className="grid grid-cols-2 gap-2">
              {PAGES.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer text-[#134e4a]">
                  <input
                    type="checkbox"
                    checked={form.show_on.includes(p.value) || form.show_on.includes("all")}
                    onChange={() => togglePage(p.value)}
                    className="accent-[#0c7b93] w-4 h-4"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-2">
            <p className="font-semibold text-[#134e4a]">Hide After Showing (days)</p>
            <input
              type="number"
              min={1}
              max={30}
              value={form.expires_days}
              onChange={(e) => setForm((f) => ({ ...f, expires_days: parseInt(e.target.value) || 7 }))}
              className="w-24 rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
            />
            <p className="text-xs text-[#0f766e]">Popup reappears after this many days (default: 7)</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0c7b93] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save Popup Settings"}
          </button>
        </form>

        {/* ── RIGHT: Live Preview ── */}
        <div className="lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-[#134e4a] mb-3">👁️ Live Preview</p>
          <p className="text-xs text-[#0f766e] mb-4">This is exactly how your popup will look to visitors.</p>

          {/* Phone-like frame */}
          <div className="relative mx-auto w-full max-w-sm">
            {/* Simulated page background */}
            <div className="rounded-2xl overflow-hidden border-2 border-gray-200 shadow-xl bg-[#fef9e7]" style={{ minHeight: 500 }}>
              {/* Fake page header */}
              <div className="bg-[#0c7b93] px-4 py-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/30" />
                <div className="h-3 w-24 bg-white/40 rounded-full" />
              </div>
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 bg-teal-100 rounded-full" />
                <div className="h-3 w-1/2 bg-teal-100 rounded-full" />
                <div className="h-20 bg-teal-50 rounded-xl mt-4" />
              </div>

              {/* Popup overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-4 rounded-2xl"
                style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}>
                <div className="relative w-full max-w-[280px] rounded-2xl overflow-hidden shadow-2xl bg-white">

                  {/* Close button */}
                  <div className="absolute top-2 right-2 z-10 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold cursor-default">
                    ×
                  </div>

                  {/* Image with text overlay */}
                  {hasImage ? (
                    <div className="relative">
                      <img
                        src={form.image_url}
                        alt="Promo"
                        className="w-full object-cover"
                        style={{ maxHeight: 180 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {hasText && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          {form.headline && (
                            <p className="text-white font-bold text-sm leading-tight">{form.headline}</p>
                          )}
                          {form.subtext && (
                            <p className="text-white/90 text-xs mt-0.5">{form.subtext}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hasText ? (
                    <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-5">
                      {form.headline && (
                        <p className="text-white font-bold text-base leading-tight">{form.headline}</p>
                      )}
                      {form.subtext && (
                        <p className="text-white/90 text-sm mt-1">{form.subtext}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-8 flex items-center justify-center">
                      <p className="text-white/50 text-sm text-center">Add an image or headline to see preview</p>
                    </div>
                  )}

                  {/* Button */}
                  {hasButton && (
                    <div className="bg-white p-3">
                      <div className="w-full bg-[#0c7b93] text-white text-center font-bold py-2.5 rounded-xl text-sm cursor-default">
                        {form.button_label}
                      </div>
                      <p className="text-center text-xs text-gray-400 mt-2 cursor-default">No thanks</p>
                    </div>
                  )}

                  {/* Empty state button area */}
                  {!hasButton && (
                    <div className="bg-white p-3">
                      <div className="w-full border-2 border-dashed border-gray-200 text-gray-300 text-center py-2.5 rounded-xl text-xs">
                        Button will appear here
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div className={`mt-3 text-center text-xs font-semibold px-3 py-1.5 rounded-full inline-block ${
              form.is_active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {form.is_active ? "🟢 Popup is LIVE" : "⚫ Popup is OFF"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
