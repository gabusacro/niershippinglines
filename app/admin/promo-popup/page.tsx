"use client";

/**
 * /admin/promo-popup
 * - Edit and save → popup goes live immediately
 * - Toggle on/off with instant feedback
 * - "Preview as Visitor" button clears localStorage so you can test it yourself
 * - All fields connected end-to-end
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
  is_active:    boolean;
  image_url:    string;
  headline:     string;
  subtext:      string;
  button_label: string;
  button_url:   string;
  show_on:      string[];
  expires_days: number;
};

const DEFAULT: PopupForm = {
  is_active:    false,
  image_url:    "",
  headline:     "",
  subtext:      "",
  button_label: "Book Now",
  button_url:   "",
  show_on:      ["all"],
  expires_days: 7,
};

export default function PromoPopupPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm]           = useState<PopupForm>(DEFAULT);
  const [saved, setSaved]         = useState<PopupForm>(DEFAULT);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");

  // ── Load from DB ──────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promo-popup", { cache: "no-store" });
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

  // ── Image upload ──────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.showError("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.showError("Image must be under 5MB."); return; }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext  = file.name.split(".").pop() ?? "png";
      const path = `promo-popup/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("promo-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from("promo-media").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: publicUrl }));
      toast.showSuccess("Image uploaded! Save to apply.");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Page toggle ───────────────────────────────────────────────
  function togglePage(val: string) {
    setForm((f) => {
      if (val === "all") return { ...f, show_on: ["all"] };
      const without = f.show_on.filter((v) => v !== "all");
      if (without.includes(val)) {
        const next = without.filter((v) => v !== val);
        return { ...f, show_on: next.length > 0 ? next : ["all"] };
      }
      return { ...f, show_on: [...without, val] };
    });
  }

  function isPageChecked(val: string): boolean {
    if (val === "all") return form.show_on.includes("all");
    return !form.show_on.includes("all") && form.show_on.includes(val);
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          image_url:    form.image_url.trim()    || null,
          headline:     form.headline.trim()     || null,
          subtext:      form.subtext.trim()      || null,
          button_label: form.button_label.trim() || "Book Now",
          button_url:   form.button_url.trim()   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSaved({ ...form });
      toast.showSuccess(
        form.is_active
          ? "✅ Popup is now LIVE for visitors!"
          : "💾 Saved. Popup is currently OFF."
      );
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Quick toggle active (saves immediately) ───────────────────
  async function quickToggleActive() {
    const newActive = !form.is_active;
    setForm((f) => ({ ...f, is_active: newActive }));
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          is_active:    newActive,
          image_url:    form.image_url.trim()    || null,
          headline:     form.headline.trim()     || null,
          subtext:      form.subtext.trim()      || null,
          button_label: form.button_label.trim() || "Book Now",
          button_url:   form.button_url.trim()   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toggle failed.");
      setSaved((s) => ({ ...s, is_active: newActive }));
      toast.showSuccess(newActive ? "🟢 Popup is now LIVE!" : "⚫ Popup turned OFF.");
    } catch (err) {
      // Revert on failure
      setForm((f) => ({ ...f, is_active: !newActive }));
      toast.showError(err instanceof Error ? err.message : "Toggle failed.");
    }
  }

  // ── Preview as visitor (clears localStorage) ─────────────────
  function previewAsVisitor() {
    try {
      localStorage.removeItem("travela_promo_seen_at");
      localStorage.removeItem("travela_promo_ver");
    } catch {}
    window.open("/", "_blank");
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#0c7b93] text-sm font-medium animate-pulse">Loading popup settings…</div>
      </div>
    );
  }

  const hasImage  = Boolean(form.image_url.trim());
  const hasText   = Boolean(form.headline.trim() || form.subtext.trim());
  const hasButton = Boolean(form.button_label.trim() && form.button_url.trim());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/admin" className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">📢 Promo Popup Banner</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Edit and save — changes go live immediately for all visitors.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
              ⚠️ Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={previewAsVisitor}
            className="text-xs font-semibold bg-white border border-teal-200 text-[#0c7b93] px-3 py-1.5 rounded-full hover:bg-teal-50 transition-colors"
          >
            👁️ Preview as Visitor
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Form ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Active toggle — saves immediately on click */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#134e4a]">Popup Active</p>
                <p className="text-xs text-[#0f766e] mt-0.5">
                  Toggle saves instantly — no need to press Save
                </p>
              </div>
              <button
                type="button"
                onClick={quickToggleActive}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/40 ${
                  form.is_active ? "bg-[#0c7b93]" : "bg-gray-300"
                }`}
                aria-pressed={form.is_active}
                aria-label="Toggle popup active"
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                  form.is_active ? "left-7" : "left-1"
                }`} />
              </button>
            </div>
            <div className={`mt-3 text-xs font-medium rounded-lg px-3 py-2 ${
              form.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"
            }`}>
              {form.is_active
                ? "🟢 Popup is LIVE — visitors can see it right now"
                : "⚫ Popup is OFF — visitors won't see it"}
            </div>
          </div>

          {/* Image */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Promo Image</p>
            <p className="text-xs text-[#0f766e]">PNG with transparent background works great — never cropped.</p>
            <div className="flex gap-2">
              {(["upload", "url"] as const).map((mode) => (
                <button
                  key={mode} type="button" onClick={() => setImageMode(mode)}
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
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                <button
                  type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full border-2 border-dashed border-teal-200 rounded-xl py-8 text-sm text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                >
                  <span className="text-2xl">{uploading ? "⏳" : "🖼️"}</span>
                  <span>{uploading ? "Uploading…" : "Click to choose image"}</span>
                  <span className="text-xs text-gray-400">PNG, JPG, WebP — max 5MB</span>
                </button>
              </>
            ) : (
              <input
                type="url" placeholder="https://example.com/promo.png"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
              />
            )}

            {hasImage && (
              <div className="relative rounded-xl overflow-hidden border border-teal-100 bg-[#f0fdfa] p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="max-h-48 w-full rounded-lg"
                  style={{ objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 text-sm flex items-center justify-center">
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Text Overlay <span className="text-xs font-normal text-gray-400">(optional)</span></p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Headline</label>
              <input type="text" placeholder="e.g. 🏝️ Summer Sale! 20% Off Tours"
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Subtext</label>
              <input type="text" placeholder="e.g. Book now and save on island tours"
                value={form.subtext}
                onChange={(e) => setForm((f) => ({ ...f, subtext: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
          </div>

          {/* Button */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">CTA Button <span className="text-xs font-normal text-gray-400">(optional)</span></p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Button Label</label>
              <input type="text" placeholder="e.g. Book Now"
                value={form.button_label}
                onChange={(e) => setForm((f) => ({ ...f, button_label: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Button URL</label>
              <input type="text" placeholder="e.g. /book"
                value={form.button_url}
                onChange={(e) => setForm((f) => ({ ...f, button_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
          </div>

          {/* Pages */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <div>
              <p className="font-semibold text-[#134e4a]">Show On Pages</p>
              <p className="text-xs text-[#0f766e] mt-0.5">Pick &quot;All Pages&quot; or choose specific ones.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PAGES.map((p) => (
                <label key={p.value}
                  className="flex items-center gap-2.5 text-sm cursor-pointer text-[#134e4a] rounded-lg hover:bg-teal-50 px-2 py-1.5 transition-colors">
                  <input type="checkbox" checked={isPageChecked(p.value)}
                    onChange={() => togglePage(p.value)}
                    className="accent-[#0c7b93] w-4 h-4 rounded cursor-pointer" />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-[#9ca3af]">
              Showing on: <strong className="text-[#0c7b93]">
                {form.show_on.includes("all") ? "All Pages" : form.show_on.join(", ")}
              </strong>
            </p>
          </div>

          {/* Expiry */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-2">
            <p className="font-semibold text-[#134e4a]">Re-show After</p>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={30} value={form.expires_days}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  expires_days: Math.max(1, Math.min(30, parseInt(e.target.value) || 7)),
                }))}
                className="w-24 rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none" />
              <span className="text-sm text-[#0f766e]">days per visitor</span>
            </div>
            <p className="text-xs text-[#9ca3af]">Popup reappears after this many days. Changing content resets this for all visitors automatically.</p>
          </div>

          {/* Save */}
          <button
            type="submit" disabled={submitting || !isDirty}
            className={`w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white transition-all ${
              isDirty && !submitting
                ? "bg-[#0c7b93] hover:bg-[#0f766e] shadow-md hover:shadow-lg cursor-pointer"
                : "bg-gray-300 cursor-default"
            } disabled:opacity-60`}
          >
            {submitting ? "Saving…" : isDirty ? "💾 Save Popup Settings" : "✅ All changes saved"}
          </button>
        </form>

        {/* ── Preview ───────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-[#134e4a] mb-1">👁️ Live Preview</p>
          <p className="text-xs text-[#0f766e] mb-4">Matches exactly what visitors see.</p>

          <div className="relative mx-auto rounded-2xl overflow-hidden border-2 border-gray-200 shadow-xl bg-[#f0fdfa]" style={{ minHeight: 480 }}>
            {/* Fake page */}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 rounded-2xl"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}>

              <div className="w-full max-w-[260px] rounded-2xl overflow-hidden shadow-2xl bg-white">
                {hasImage && (
                  <div className="w-full bg-[#f0fdfa] p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="Preview" className="w-full rounded-xl"
                      style={{ maxHeight: 200, objectFit: "contain" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
                {hasText && (
                  <div className={`px-4 py-3 ${hasImage ? "bg-white border-t border-teal-50" : "bg-gradient-to-br from-[#085C52] to-[#0c7b93]"}`}>
                    {form.headline && (
                      <p className={`font-bold text-sm leading-tight ${hasImage ? "text-[#134e4a]" : "text-white"}`}>{form.headline}</p>
                    )}
                    {form.subtext && (
                      <p className={`text-xs mt-0.5 ${hasImage ? "text-[#0f766e]" : "text-white/85"}`}>{form.subtext}</p>
                    )}
                  </div>
                )}
                {hasButton ? (
                  <div className="bg-white px-3 pb-3 pt-2">
                    <div className="w-full bg-[#0c7b93] text-white text-center font-bold py-2 rounded-xl text-xs">
                      {form.button_label || "Book Now"}
                    </div>
                  </div>
                ) : !hasImage && !hasText ? (
                  <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-8 flex items-center justify-center">
                    <p className="text-white/50 text-xs text-center">Add an image, headline, or button to preview</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-center bg-white/20 text-white rounded-full text-lg font-bold"
                style={{ width: 36, height: 36 }}>×</div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-3 text-center">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-block ${
              saved.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}>
              {saved.is_active ? "🟢 Currently LIVE" : "⚫ Currently OFF"}
            </span>
          </div>

          {/* Preview helper */}
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
            <p className="font-semibold mb-1">🧪 Testing tip</p>
            <p>Click <strong>&quot;Preview as Visitor&quot;</strong> above to open the homepage with your localStorage reset — you&apos;ll see the popup appear as if for the first time.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
