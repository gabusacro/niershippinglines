"use client";

/**
 * /admin/promo-popup
 * Admin UI for managing the promotional popup banner.
 * - Reliable save (no revert)
 * - Working page checkboxes
 * - Image shown with object-contain (no cropping)
 * - Text overlay preview matches actual popup
 * - Close button shown below image in preview
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/ActionToast";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const PAGES = [
  { value: "all",       label: "🌐 All Pages" },
  { value: "/",         label: "🏠 Homepage" },
  { value: "/tours",    label: "🏝️ Tours" },
  { value: "/schedule", label: "🗓️ Schedule" },
  { value: "/book",     label: "🎫 Booking Page" },
  { value: "/parking",  label: "🅿️ Pay Parking" },
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
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<PopupForm>(DEFAULT);
  const [saved, setSaved] = useState<PopupForm>(DEFAULT); // tracks what's actually in DB
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promo-popup", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const d = await res.json();
      if (d) {
        const loaded: PopupForm = {
          is_active:    Boolean(d.is_active ?? false),
          image_url:    d.image_url    ?? "",
          headline:     d.headline     ?? "",
          subtext:      d.subtext      ?? "",
          button_label: d.button_label ?? "Book Now",
          button_url:   d.button_url   ?? "",
          show_on:      Array.isArray(d.show_on) && d.show_on.length > 0 ? d.show_on : ["all"],
          expires_days: d.expires_days ?? 7,
        };
        setForm(loaded);
        setSaved(loaded);
      }
    } catch {
      toast.showError("Failed to load popup settings.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      toast.showError("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.showError("Image must be under 5MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `promo-popup/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("promo-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("promo-media")
        .getPublicUrl(path);

      setForm((f) => ({ ...f, image_url: publicUrl }));
      toast.showSuccess("Image uploaded! Remember to save.");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function togglePage(val: string) {
    setForm((f) => {
      if (val === "all") {
        // Clicking "All Pages" → select only "all"
        return { ...f, show_on: ["all"] };
      }
      // Remove "all" from selection when picking specific pages
      const without = f.show_on.filter((v) => v !== "all");
      if (without.includes(val)) {
        // Deselect this page
        const next = without.filter((v) => v !== val);
        // If nothing selected, fall back to "all"
        return { ...f, show_on: next.length > 0 ? next : ["all"] };
      }
      // Select this page
      return { ...f, show_on: [...without, val] };
    });
  }

  function isPageChecked(val: string): boolean {
    if (val === "all") return form.show_on.includes("all");
    // Specific page is checked if explicitly in list AND "all" is not selected
    return !form.show_on.includes("all") && form.show_on.includes(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          ...form,
          // Send null for empty strings so DB is clean
          image_url:    form.image_url.trim()    || null,
          headline:     form.headline.trim()     || null,
          subtext:      form.subtext.trim()      || null,
          button_label: form.button_label.trim() || "Book Now",
          button_url:   form.button_url.trim()   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");

      // Update saved state to reflect what's in DB
      setSaved({ ...form });
      toast.showSuccess(data.message ?? "Promo popup saved!");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#0c7b93] text-sm font-medium animate-pulse">
          Loading popup settings…
        </div>
      </div>
    );
  }

  // Preview helpers
  const hasImage  = Boolean(form.image_url.trim());
  const hasText   = Boolean(form.headline.trim() || form.subtext.trim());
  const hasButton = Boolean(form.button_label.trim() && form.button_url.trim());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin"
        className="text-sm font-semibold text-[#0c7b93] hover:underline"
      >
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">📢 Promo Popup Banner</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Set up a popup that appears to visitors. Shows once, then hides for the days you set.
          </p>
        </div>
        {isDirty && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
            ⚠️ Unsaved changes
          </span>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ══════════════════════════════════════════
            LEFT — Form
        ══════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Active toggle */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#134e4a]">Popup Active</p>
                <p className="text-xs text-[#0f766e] mt-0.5">
                  Turn on to show this popup to visitors
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/40 ${
                  form.is_active ? "bg-[#0c7b93]" : "bg-gray-300"
                }`}
                aria-pressed={form.is_active}
                aria-label="Toggle popup active"
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                    form.is_active ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
            <div className={`mt-3 text-xs font-medium rounded-lg px-3 py-2 ${
              form.is_active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-50 text-gray-500"
            }`}>
              {form.is_active
                ? "✅ Popup will be LIVE after saving"
                : "⚫ Popup is OFF — visitors won't see it"}
            </div>
          </div>

          {/* Image */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Promo Image</p>
            <p className="text-xs text-[#0f766e]">
              PNG with transparent background works great — image will not be cropped.
            </p>

            <div className="flex gap-2">
              {(["upload", "url"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImageMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    imageMode === mode
                      ? "bg-[#0c7b93] text-white border-[#0c7b93]"
                      : "text-[#134e4a] border-teal-200 hover:border-[#0c7b93]"
                  }`}
                >
                  {mode === "upload" ? "📁 Upload Image" : "🔗 Paste URL"}
                </button>
              ))}
            </div>

            {imageMode === "upload" ? (
              <>
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
                  className="w-full border-2 border-dashed border-teal-200 rounded-xl py-8 text-sm text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                >
                  <span className="text-2xl">{uploading ? "⏳" : "🖼️"}</span>
                  <span>{uploading ? "Uploading…" : "Click to choose image"}</span>
                  <span className="text-xs text-gray-400">PNG, JPG, WebP — max 5MB</span>
                </button>
              </>
            ) : (
              <input
                type="url"
                placeholder="https://example.com/promo.png"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            )}

            {hasImage && (
              <div className="relative rounded-xl overflow-hidden border border-teal-100 bg-[#f0fdfa] p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="max-h-48 w-full rounded-lg"
                  style={{ objectFit: "contain", objectPosition: "center" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 text-sm flex items-center justify-center transition-colors"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Text overlay */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <div>
              <p className="font-semibold text-[#134e4a]">Text Overlay</p>
              <p className="text-xs text-[#0f766e] mt-0.5">
                Appears between the image and close button. Optional.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">
                Headline
              </label>
              <input
                type="text"
                placeholder="e.g. 🏝️ Summer Sale! 20% Off Tours"
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">
                Subtext
              </label>
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
            <p className="font-semibold text-[#134e4a]">CTA Button</p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">
                Button Label
              </label>
              <input
                type="text"
                placeholder="e.g. Book Now"
                value={form.button_label}
                onChange={(e) => setForm((f) => ({ ...f, button_label: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">
                Button URL
              </label>
              <input
                type="text"
                placeholder="e.g. /tours or https://travelasiargao.com/book"
                value={form.button_url}
                onChange={(e) => setForm((f) => ({ ...f, button_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            </div>
          </div>

          {/* Show on pages — FIXED checkboxes */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <div>
              <p className="font-semibold text-[#134e4a]">Show On Pages</p>
              <p className="text-xs text-[#0f766e] mt-0.5">
                Select &quot;All Pages&quot; or pick specific pages.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PAGES.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-2.5 text-sm cursor-pointer text-[#134e4a] rounded-lg hover:bg-teal-50 px-2 py-1.5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isPageChecked(p.value)}
                    onChange={() => togglePage(p.value)}
                    className="accent-[#0c7b93] w-4 h-4 rounded cursor-pointer"
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-[#9ca3af]">
              Currently showing on:{" "}
              <strong className="text-[#0c7b93]">
                {form.show_on.includes("all")
                  ? "All Pages"
                  : form.show_on.join(", ")}
              </strong>
            </p>
          </div>

          {/* Expiry */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-2">
            <p className="font-semibold text-[#134e4a]">Re-show After (days)</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={form.expires_days}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expires_days: Math.max(1, Math.min(30, parseInt(e.target.value) || 7)),
                  }))
                }
                className="w-24 rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
              <span className="text-sm text-[#0f766e]">days</span>
            </div>
            <p className="text-xs text-[#9ca3af]">
              Popup reappears to the same visitor after this many days.
            </p>
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white transition-all ${
              isDirty
                ? "bg-[#0c7b93] hover:bg-[#0f766e] shadow-md hover:shadow-lg"
                : "bg-gray-300 cursor-default"
            } disabled:opacity-60`}
          >
            {submitting ? "Saving…" : isDirty ? "💾 Save Popup Settings" : "✅ All changes saved"}
          </button>
        </form>

        {/* ══════════════════════════════════════════
            RIGHT — Live Preview
        ══════════════════════════════════════════ */}
        <div className="lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-[#134e4a] mb-1">👁️ Live Preview</p>
          <p className="text-xs text-[#0f766e] mb-4">
            Exactly how your popup appears to visitors.
          </p>

          {/* Simulated page background */}
          <div
            className="relative mx-auto rounded-2xl overflow-hidden border-2 border-gray-200 shadow-xl bg-[#f0fdfa]"
            style={{ minHeight: 480 }}
          >
            {/* Fake page header */}
            <div className="bg-gradient-to-r from-[#085C52] to-[#0c7b93] px-4 py-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/30" />
              <div className="h-3 w-28 bg-white/40 rounded-full" />
            </div>
            <div className="p-4 space-y-2">
              <div className="h-3 w-3/4 bg-teal-100 rounded-full" />
              <div className="h-3 w-1/2 bg-teal-100 rounded-full" />
              <div className="h-16 bg-teal-50 rounded-xl mt-3" />
            </div>

            {/* Popup overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-4 rounded-2xl"
              style={{
                backgroundColor: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(3px)",
              }}
            >
              {/* Popup card */}
              <div className="w-full max-w-[260px] rounded-2xl overflow-hidden shadow-2xl bg-white">

                {/* Image — object-contain, no cropping */}
                {hasImage && (
                  <div className="w-full bg-[#f0fdfa] p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.image_url}
                      alt="Preview"
                      className="w-full rounded-xl"
                      style={{
                        maxHeight: 200,
                        objectFit: "contain",
                        objectPosition: "center",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Text overlay */}
                {hasText && (
                  <div
                    className={`px-4 py-3 ${
                      hasImage
                        ? "bg-white border-t border-teal-50"
                        : "bg-gradient-to-br from-[#085C52] to-[#0c7b93]"
                    }`}
                  >
                    {form.headline && (
                      <p className={`font-bold text-sm leading-tight ${hasImage ? "text-[#134e4a]" : "text-white"}`}>
                        {form.headline}
                      </p>
                    )}
                    {form.subtext && (
                      <p className={`text-xs mt-0.5 ${hasImage ? "text-[#0f766e]" : "text-white/85"}`}>
                        {form.subtext}
                      </p>
                    )}
                  </div>
                )}

                {/* Button */}
                {hasButton ? (
                  <div className="bg-white px-3 pb-3 pt-2">
                    <div className="w-full bg-[#0c7b93] text-white text-center font-bold py-2 rounded-xl text-xs">
                      {form.button_label || "Book Now"}
                    </div>
                  </div>
                ) : !hasImage && !hasText ? (
                  <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-8 flex items-center justify-center">
                    <p className="text-white/50 text-xs text-center">
                      Add an image, headline, or button
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Close button preview */}
              <div className="mt-3 flex items-center justify-center bg-white/20 text-white rounded-full text-lg font-bold"
                style={{ width: 36, height: 36 }}>
                ×
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-3 text-center">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-block ${
              form.is_active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {form.is_active ? "🟢 Popup will be LIVE after saving" : "⚫ Popup is OFF"}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
