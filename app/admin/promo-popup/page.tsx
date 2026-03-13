"use client";

import { useState, useEffect, useRef } from "react";
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

const EMPTY: PopupForm = {
  is_active: false, image_url: "", headline: "", subtext: "",
  button_label: "Book Now", button_url: "", show_on: ["all"], expires_days: 7,
};

export default function PromoPopupPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm]         = useState<PopupForm>(EMPTY);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<"upload"|"url">("upload");
  const [liveStatus, setLiveStatus] = useState(false);

  // ── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/promo-popup", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (!d) return;
        const f: PopupForm = {
          is_active:    Boolean(d.is_active),
          image_url:    d.image_url    ?? "",
          headline:     d.headline     ?? "",
          subtext:      d.subtext      ?? "",
          button_label: d.button_label ?? "Book Now",
          button_url:   d.button_url   ?? "",
          show_on:      Array.isArray(d.show_on) && d.show_on.length ? d.show_on : ["all"],
          expires_days: d.expires_days ?? 7,
        };
        setForm(f);
        setLiveStatus(Boolean(d.is_active));
      })
      .catch(() => toast.showError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, [toast]);

  // ── Save all fields ─────────────────────────────────────────────
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
      setLiveStatus(payload.is_active);
      toast.showSuccess(payload.is_active ? "🟢 Popup is LIVE!" : "⚫ Popup is OFF.");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle — saves immediately ──────────────────────────────────
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
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setLiveStatus(newVal);
      toast.showSuccess(newVal ? "🟢 Popup is now LIVE!" : "⚫ Popup turned OFF.");
    } catch (err) {
      setForm(f => ({ ...f, is_active: !newVal })); // revert
      toast.showError(err instanceof Error ? err.message : "Toggle failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.showError("Images only."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.showError("Max 5MB."); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext  = file.name.split(".").pop() ?? "png";
      const path = `promo-popup/banner-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("promo-media").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data: { publicUrl } } = supabase.storage.from("promo-media").getPublicUrl(path);
      setForm(f => ({ ...f, image_url: publicUrl }));
      toast.showSuccess("Image ready — press Save to apply.");
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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

  function clearPreviewCache() {
    try {
      localStorage.removeItem("travela_promo_seen_at");
      localStorage.removeItem("travela_promo_ver");
    } catch {}
    window.open("/", "_blank");
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-[#0c7b93] text-sm animate-pulse">Loading…</p>
    </div>
  );

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
          <p className="mt-1 text-sm text-[#0f766e]">Edit fields then press Save. Toggle turns popup on/off instantly.</p>
        </div>
        <button type="button" onClick={clearPreviewCache}
          className="text-xs font-semibold bg-white border border-teal-200 text-[#0c7b93] px-3 py-1.5 rounded-full hover:bg-teal-50">
          👁️ Preview as Visitor
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── LEFT: Form ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Toggle */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#134e4a]">Popup Active</p>
                <p className="text-xs text-[#0f766e] mt-0.5">Saves instantly when toggled</p>
              </div>
              <button type="button" onClick={toggle} disabled={saving}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-60 ${form.is_active ? "bg-[#0c7b93]" : "bg-gray-300"}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${form.is_active ? "left-7" : "left-1"}`} />
              </button>
            </div>
            <div className={`mt-3 text-xs font-medium rounded-lg px-3 py-2 ${liveStatus ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"}`}>
              {liveStatus ? "🟢 Popup is LIVE — visitors see it now" : "⚫ Popup is OFF"}
            </div>
          </div>

          {/* Image */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Promo Image</p>
            <div className="flex gap-2">
              {(["upload","url"] as const).map(m => (
                <button key={m} type="button" onClick={() => setImageMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${imageMode===m ? "bg-[#0c7b93] text-white border-[#0c7b93]" : "text-[#134e4a] border-teal-200"}`}>
                  {m === "upload" ? "📁 Upload" : "🔗 Paste URL"}
                </button>
              ))}
            </div>

            {imageMode === "upload" ? (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full border-2 border-dashed border-teal-200 rounded-xl py-8 text-sm text-[#0f766e] hover:border-[#0c7b93] hover:bg-teal-50 disabled:opacity-50 flex flex-col items-center gap-2">
                  <span className="text-2xl">{uploading ? "⏳" : "🖼️"}</span>
                  <span>{uploading ? "Uploading…" : "Click to choose image"}</span>
                  <span className="text-xs text-gray-400">PNG, JPG, WebP — max 5MB</span>
                </button>
              </>
            ) : (
              <input type="url" placeholder="https://..." value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            )}

            {/* Preview always visible when URL is set */}
            {hasImage && (
              <div className="relative rounded-xl border-2 border-teal-300 bg-[#f0fdfa] p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="max-h-48 w-full rounded-lg"
                  style={{ objectFit: "contain" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 text-sm flex items-center justify-center">×</button>
                <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">✓ Image set</span>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Text <span className="text-xs font-normal text-gray-400">(optional)</span></p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Headline</label>
              <input type="text" placeholder="e.g. 🏝️ Summer Sale!" value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Subtext</label>
              <input type="text" placeholder="e.g. Book now and save" value={form.subtext}
                onChange={e => setForm(f => ({ ...f, subtext: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
          </div>

          {/* Button */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">CTA Button <span className="text-xs font-normal text-gray-400">(optional)</span></p>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">Label</label>
              <input type="text" placeholder="Book Now" value={form.button_label}
                onChange={e => setForm(f => ({ ...f, button_label: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#134e4a] mb-1">URL</label>
              <input type="text" placeholder="/book" value={form.button_url}
                onChange={e => setForm(f => ({ ...f, button_url: e.target.value }))}
                className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30" />
            </div>
          </div>

          {/* Pages */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold text-[#134e4a]">Show On Pages</p>
            <div className="grid grid-cols-2 gap-2">
              {PAGES.map(p => (
                <label key={p.value} className="flex items-center gap-2.5 text-sm cursor-pointer text-[#134e4a] rounded-lg hover:bg-teal-50 px-2 py-1.5">
                  <input type="checkbox"
                    checked={p.value === "all" ? form.show_on.includes("all") : !form.show_on.includes("all") && form.show_on.includes(p.value)}
                    onChange={() => togglePage(p.value)}
                    className="accent-[#0c7b93] w-4 h-4 cursor-pointer" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm space-y-2">
            <p className="font-semibold text-[#134e4a]">Re-show After</p>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={30} value={form.expires_days}
                onChange={e => setForm(f => ({ ...f, expires_days: Math.max(1, Math.min(30, parseInt(e.target.value)||7)) }))}
                className="w-24 rounded-lg border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none" />
              <span className="text-sm text-[#0f766e]">days per visitor</span>
            </div>
          </div>

          {/* Save button */}
          <button type="button" onClick={() => save()} disabled={saving}
            className="w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white bg-[#0c7b93] hover:bg-[#0f766e] shadow-md disabled:opacity-60 transition-all">
            {saving ? "Saving…" : "💾 Save All Changes"}
          </button>
        </div>

        {/* ── RIGHT: Preview ──────────────────────────────────── */}
        <div className="lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-[#134e4a] mb-1">👁️ Preview</p>
          <p className="text-xs text-[#0f766e] mb-4">Updates as you type. Press Save to push live.</p>

          <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 shadow-xl bg-[#f0fdfa]" style={{ minHeight: 480 }}>
            <div className="bg-gradient-to-r from-[#085C52] to-[#0c7b93] px-4 py-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/30" />
              <div className="h-3 w-28 bg-white/40 rounded-full" />
            </div>
            <div className="p-4 space-y-2">
              <div className="h-3 w-3/4 bg-teal-100 rounded-full" />
              <div className="h-3 w-1/2 bg-teal-100 rounded-full" />
              <div className="h-16 bg-teal-50 rounded-xl mt-3" />
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center p-4"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}>
              <div className="w-full max-w-[260px] rounded-2xl overflow-hidden shadow-2xl bg-white">
                {hasImage && (
                  <div className="w-full bg-[#f0fdfa] p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="Preview" className="w-full rounded-xl"
                      style={{ maxHeight: 200, objectFit: "contain" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
                {hasText && (
                  <div className={`px-4 py-3 ${hasImage ? "bg-white border-t border-teal-50" : "bg-gradient-to-br from-[#085C52] to-[#0c7b93]"}`}>
                    {form.headline && <p className={`font-bold text-sm leading-tight ${hasImage ? "text-[#134e4a]" : "text-white"}`}>{form.headline}</p>}
                    {form.subtext  && <p className={`text-xs mt-0.5 ${hasImage ? "text-[#0f766e]" : "text-white/85"}`}>{form.subtext}</p>}
                  </div>
                )}
                {hasButton ? (
                  <div className="bg-white px-3 pb-3 pt-2">
                    <div className="w-full bg-[#0c7b93] text-white text-center font-bold py-2 rounded-xl text-xs">{form.button_label}</div>
                  </div>
                ) : (!hasImage && !hasText) ? (
                  <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-8 flex items-center justify-center">
                    <p className="text-white/50 text-xs text-center">Add image, text, or button to preview</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-center bg-white/20 text-white rounded-full text-lg font-bold" style={{ width: 36, height: 36 }}>×</div>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-block ${liveStatus ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {liveStatus ? "🟢 Currently LIVE" : "⚫ Currently OFF"}
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
            <p className="font-semibold mb-1">🧪 Testing tip</p>
            <p>Use <strong>&quot;Preview as Visitor&quot;</strong> to see it as a first-time visitor. The Save button always saves everything — toggle saves only the on/off state.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
