"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// ─── Pages config ────────────────────────────────────────────────────────────
const PAGES = [
  { value: "all",       label: "All Pages",   icon: "🌐" },
  { value: "/",         label: "Homepage",     icon: "🏠" },
  { value: "/tours",    label: "Tours",        icon: "🏝️" },
  { value: "/schedule", label: "Schedule",     icon: "🗓️" },
  { value: "/book",     label: "Booking Page", icon: "🎫" },
  { value: "/parking",  label: "Pay Parking",  icon: "🅿️" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
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

const EMPTY: PopupForm = {
  is_active: false, image_url: "", headline: "", subtext: "",
  button_label: "Book Now", button_url: "/book", show_on: ["all"], expires_days: 1,
};

type Toast = { id: number; msg: string; type: "ok" | "err" };

// ─── Main component ───────────────────────────────────────────────────────────
export default function PromoPopupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm]           = useState<PopupForm>(EMPTY);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [toasts, setToasts]       = useState<Toast[]>([]);
  const toastId = useRef(0);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const addToast = useCallback((msg: string, type: "ok" | "err") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/promo-popup", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (!d) return;
        setForm({
          is_active:    Boolean(d.is_active),
          image_url:    d.image_url    ?? "",
          headline:     d.headline     ?? "",
          subtext:      d.subtext      ?? "",
          button_label: d.button_label ?? "Book Now",
          button_url:   d.button_url   ?? "/book",
          show_on:      Array.isArray(d.show_on) && d.show_on.length ? d.show_on : ["all"],
          expires_days: d.expires_days ?? 1,
        });
      })
      .catch(() => addToast("Failed to load settings.", "err"))
      .finally(() => setLoading(false));
  }, [addToast]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save(overrides: Partial<PopupForm> = {}) {
    const payload = { ...form, ...overrides };
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active:    payload.is_active,
          image_url:    payload.image_url.trim()    || null,
          headline:     payload.headline.trim()     || null,
          subtext:      payload.subtext.trim()      || null,
          button_label: payload.button_label.trim() || "Book Now",
          button_url:   payload.button_url.trim()   || null,
          show_on:      payload.show_on,
          expires_days: payload.expires_days,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setForm(payload);
      addToast(payload.is_active ? "🟢 Popup is LIVE!" : "✅ Changes saved.", "ok");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Save failed.", "err");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  async function toggle() {
    const newVal = !form.is_active;
    setForm(f => ({ ...f, is_active: newVal }));
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo-popup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active:    newVal,
          image_url:    form.image_url.trim()    || null,
          headline:     form.headline.trim()     || null,
          subtext:      form.subtext.trim()      || null,
          button_label: form.button_label.trim() || "Book Now",
          button_url:   form.button_url.trim()   || null,
          show_on:      form.show_on,
          expires_days: form.expires_days,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Toggle failed");
      addToast(newVal ? "🟢 Popup is now LIVE!" : "⚫ Popup turned OFF.", "ok");
    } catch (err) {
      setForm(f => ({ ...f, is_active: !newVal }));
      addToast(err instanceof Error ? err.message : "Toggle failed.", "err");
    } finally {
      setSaving(false);
    }
  }

  // ── Upload with progress ──────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { addToast("Images only (PNG, JPG, WebP).", "err"); return; }
    if (file.size > 5 * 1024 * 1024) { addToast("Max file size is 5MB.", "err"); return; }

    setUploadPct(0);

    try {
      const supabase = createClient();
      const ext  = file.name.split(".").pop() ?? "png";
      // Use fixed filename so it auto-replaces the old one
      const path = `promo-popup/banner.${ext}`;

      // Delete old file from storage if exists
      if (form.image_url) {
        const rawPath = form.image_url.split("/promo-media/")[1]?.split("?")[0];
        if (rawPath) {
          await supabase.storage.from("promo-media").remove([rawPath]);
        }
      }

      // Fake progress ticks while Supabase uploads
      let pct = 0;
      const ticker = setInterval(() => {
        pct = Math.min(pct + Math.random() * 18, 88);
        setUploadPct(Math.round(pct));
      }, 180);

      const { error } = await supabase.storage
        .from("promo-media")
        .upload(path, file, { upsert: true, contentType: file.type });

      clearInterval(ticker);
      if (error) throw new Error(error.message);

      setUploadPct(100);

      const { data: { publicUrl } } = supabase.storage
        .from("promo-media")
        .getPublicUrl(path);

      // Cache-bust so browser shows the new image immediately
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, image_url: bustedUrl }));
      addToast("✅ Image uploaded! Press Save to push live.", "ok");
      setTimeout(() => setUploadPct(null), 800);

    } catch (err) {
      setUploadPct(null);
      addToast(err instanceof Error ? err.message : "Upload failed.", "err");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Remove image (also deletes from storage) ─────────────────────────────
  async function removeImage() {
    if (!form.image_url) return;
    try {
      const supabase = createClient();
      const rawPath = form.image_url.split("/promo-media/")[1]?.split("?")[0];
      if (rawPath) await supabase.storage.from("promo-media").remove([rawPath]);
    } catch {
      // non-fatal
    }
    setForm(f => ({ ...f, image_url: "" }));
    addToast("Image removed from storage.", "ok");
  }

  // ── Page toggle ───────────────────────────────────────────────────────────
  function togglePage(val: string) {
    setForm(f => {
      if (val === "all") return { ...f, show_on: ["all"] };
      const without = f.show_on.filter(v => v !== "all");
      if (without.includes(val)) {
        const next = without.filter(v => v !== val);
        return { ...f, show_on: next.length ? next : ["all"] };
      }
      return { ...f, show_on: [...without, val] };
    });
  }

  // ── Preview as visitor ────────────────────────────────────────────────────
  function previewAsVisitor() {
    try {
      localStorage.removeItem("travela_promo_seen_at");
      localStorage.removeItem("travela_promo_ver");
    } catch {}
    window.open("/", "_blank");
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const hasImage   = Boolean(form.image_url.trim());
  const hasText    = Boolean(form.headline.trim() || form.subtext.trim());
  const hasButton  = Boolean(form.button_label.trim() && form.button_url.trim());
  const hasContent = hasImage || hasText || hasButton;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#0c7b93] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#0c7b93] font-medium">Loading popup settings…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f0]">

      {/* ── Toast stack ──────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 pointer-events-auto
              ${t.type === "ok" ? "bg-[#085C52] text-white" : "bg-red-600 text-white"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Page header (matches account settings style) ──────────────────── */}
      <div className="bg-gradient-to-r from-[#085C52] to-[#0c7b93] px-4 py-8 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/admin"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-5 transition-colors">
            ← Admin Dashboard
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">📢 Promo Popup Banner</h1>
              <p className="text-white/65 text-sm mt-1">
                Configure what visitors see when they arrive on your site.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={previewAsVisitor}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 transition-all">
                👁️ Preview as Visitor
              </button>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${
                form.is_active
                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                  : "bg-white/10 border-white/20 text-white/40"
              }`}>
                <span className={`w-2 h-2 rounded-full ${form.is_active ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                {form.is_active ? "LIVE" : "OFF"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ═══ LEFT: Controls ═════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* 1 ─ Active Toggle */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-[#134e4a]">Popup Active</p>
                  <p className="text-xs text-[#0f766e] mt-0.5">Turn on/off for all visitors instantly</p>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={saving}
                  aria-label="Toggle popup"
                  className={`relative flex-shrink-0 w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0c7b93] disabled:opacity-60 ${
                    form.is_active ? "bg-[#0c7b93]" : "bg-gray-300"
                  }`}>
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                    form.is_active ? "left-8" : "left-1"
                  }`} />
                </button>
              </div>
              <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold border ${
                form.is_active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                {form.is_active ? "🟢 Popup is LIVE — visitors see it right now" : "⚫ Popup is OFF — not shown to anyone"}
              </div>
            </div>

            {/* 2 ─ Promo Image */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <p className="font-bold text-[#134e4a]">Promo Image</p>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Drop zone — only when no image */}
              {!hasImage && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadPct !== null}
                  className="w-full border-2 border-dashed border-teal-200 rounded-xl py-10 hover:border-[#0c7b93] hover:bg-teal-50 disabled:opacity-60 disabled:cursor-wait transition-all flex flex-col items-center gap-2 group">
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    {uploadPct !== null ? "⏳" : "🖼️"}
                  </span>
                  <span className="text-sm font-semibold text-[#0c7b93]">
                    {uploadPct !== null ? "Uploading…" : "Click to upload image"}
                  </span>
                  <span className="text-xs text-gray-400">PNG, JPG, WebP — max 5MB</span>
                </button>
              )}

              {/* Progress bar */}
              {uploadPct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#0c7b93]">
                    <span>{uploadPct < 100 ? "Uploading to storage…" : "✅ Upload complete!"}</span>
                    <span>{uploadPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-teal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0c7b93] rounded-full transition-all duration-200"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Image preview */}
              {hasImage && (
                <div className="rounded-xl overflow-hidden border-2 border-teal-200 bg-[#f0fdfa]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt="Promo banner"
                    className="w-full max-h-52 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex items-center justify-between bg-white px-3 py-2.5 border-t border-teal-100">
                    <span className="text-xs text-emerald-700 font-semibold">✅ Image set</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="text-xs text-[#0c7b93] font-semibold hover:underline">
                        Replace
                      </button>
                      <span className="text-gray-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-xs text-red-500 font-semibold hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3 ─ Text */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#134e4a]">Text</p>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">optional</span>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#134e4a]">Headline</label>
                <input
                  type="text"
                  placeholder="e.g. 🏝️ Summer Sale!"
                  value={form.headline}
                  onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#134e4a]">Subtext</label>
                <input
                  type="text"
                  placeholder="e.g. Book now and save 20%"
                  value={form.subtext}
                  onChange={e => setForm(f => ({ ...f, subtext: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* 4 ─ CTA Button */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#134e4a]">CTA Button</p>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">optional</span>
              </div>
              <p className="text-xs text-[#0f766e]">Button only shows if both Label and URL are filled in.</p>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#134e4a]">Label</label>
                <input
                  type="text"
                  placeholder="Book Now"
                  value={form.button_label}
                  onChange={e => setForm(f => ({ ...f, button_label: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#134e4a]">URL</label>
                <input
                  type="text"
                  placeholder="/book"
                  value={form.button_url}
                  onChange={e => setForm(f => ({ ...f, button_url: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* 5 ─ Show On Pages */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <p className="font-bold text-[#134e4a]">Show On Pages</p>
              <div className="grid grid-cols-2 gap-2">
                {PAGES.map(p => {
                  const checked = p.value === "all"
                    ? form.show_on.includes("all")
                    : !form.show_on.includes("all") && form.show_on.includes(p.value);
                  return (
                    <label key={p.value}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer border text-sm transition-all ${
                        checked
                          ? "border-[#0c7b93] bg-teal-50 text-[#085C52] font-semibold"
                          : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-teal-50/50"
                      }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePage(p.value)}
                        className="w-4 h-4 accent-[#0c7b93] flex-shrink-0"
                      />
                      <span className="text-base leading-none">{p.icon}</span>
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 6 ─ Re-show After */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
              <p className="font-bold text-[#134e4a]">Re-show After</p>
              <p className="text-xs text-[#0f766e]">How many days before the popup shows again to the same visitor.</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.expires_days}
                  onChange={e => setForm(f => ({
                    ...f,
                    expires_days: Math.max(1, Math.min(90, parseInt(e.target.value) || 1))
                  }))}
                  className="w-24 rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] font-bold focus:outline-none focus:border-[#0c7b93]"
                />
                <span className="text-sm text-[#0f766e] font-medium">days per visitor</span>
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="w-full rounded-2xl px-6 py-4 text-base font-bold text-white bg-[#085C52] hover:bg-[#0c7b93] shadow-md disabled:opacity-60 transition-all flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : "💾 Save All Changes"}
            </button>

          </div>

          {/* ═══ RIGHT: Sticky preview ═════════════════════════════════════ */}
          <div className="lg:sticky lg:top-6 space-y-4">

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
              <p className="font-bold text-[#134e4a] mb-1">👁️ Live Preview</p>
              <p className="text-xs text-[#0f766e] mb-4">
                Updates instantly as you edit. Press Save to push changes live.
              </p>

              {/* Browser chrome mockup */}
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md" style={{ minHeight: 380 }}>
                <div className="bg-gradient-to-r from-[#085C52] to-[#0c7b93] px-3 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/25" />
                  </div>
                  <div className="flex-1 h-3.5 bg-white/15 rounded-full mx-2" />
                </div>

                {/* Fake page skeleton */}
                <div className="bg-[#f0fdfa] p-3 space-y-2 pb-0">
                  <div className="h-2.5 w-3/4 bg-teal-100 rounded-full" />
                  <div className="h-2.5 w-1/2 bg-teal-100 rounded-full" />
                  <div className="h-12 bg-teal-50 rounded-lg mt-2" />
                </div>

                {/* Popup overlay */}
                <div
                  className="bg-[#f0fdfa] px-4 pb-4 pt-2"
                  style={{ background: "linear-gradient(rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.45) 100%), #f0fdfa" }}>
                  <div className="max-w-[220px] mx-auto">
                    {hasContent ? (
                      <>
                        {/* Image — no background, transparent just like real popup */}
                        {hasImage && (
                          <div className="flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={form.image_url}
                              alt="Preview"
                              className="w-full rounded-2xl"
                              style={{ maxHeight: 150, objectFit: "contain", display: "block" }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                        {/* Card only when there's text or CTA */}
                        {(hasText || hasButton) && (
                          <div className={`bg-white rounded-2xl overflow-hidden${hasImage ? " mt-1.5" : ""}`}>
                            {hasText && (
                              <div className={`px-3 pt-2.5 pb-1 text-center ${!hasImage ? "bg-gradient-to-br from-[#085C52] to-[#0c7b93]" : "bg-white"}`}>
                                {form.headline && (
                                  <p className={`font-bold text-xs leading-tight ${!hasImage ? "text-white" : "text-[#134e4a]"}`}>
                                    {form.headline}
                                  </p>
                                )}
                                {form.subtext && (
                                  <p className={`text-[11px] mt-0.5 ${!hasImage ? "text-white/80" : "text-[#0f766e]"}`}>
                                    {form.subtext}
                                  </p>
                                )}
                              </div>
                            )}
                            {hasButton && (
                              <div className="px-2.5 pb-2.5 pt-2 bg-white">
                                <div className="w-full bg-[#0c7b93] text-white text-center font-bold py-1.5 rounded-xl text-[11px]">
                                  {form.button_label}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-6 flex items-center justify-center">
                        <p className="text-white/50 text-[11px] text-center leading-relaxed">
                          Add image, text, or button to preview
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Close dot */}
                  <div className="mt-2.5 flex justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/25 text-white flex items-center justify-center text-sm font-bold">
                      ×
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mt-3 flex justify-center">
                <span className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full ${
                  form.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${form.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                  {form.is_active ? "Currently LIVE" : "Currently OFF"}
                </span>
              </div>
            </div>

            {/* Tip card */}
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3.5 text-xs text-amber-800">
              <p className="font-bold mb-1">💡 How it works</p>
              <ul className="space-y-1 text-amber-700">
                <li>• <strong>Toggle</strong> — turns popup on/off immediately, saves instantly</li>
                <li>• <strong>Save</strong> — pushes all content changes live</li>
                <li>• <strong>Preview as Visitor</strong> — opens homepage as a first-time visitor</li>
                <li>• Image removes itself from storage when you click Remove</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] bg-white focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30 focus:border-[#0c7b93] transition-all placeholder:text-gray-300";
