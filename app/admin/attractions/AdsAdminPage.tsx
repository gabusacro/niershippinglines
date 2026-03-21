"use client";

import { useState } from "react";
import type { Ad } from "@/lib/attractions/get-ads";

// ─── Hero position picker ─────────────────────────────────────────────────────
export function HeroPositionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const positions = [
    { label: "Top",    value: "center top",    hint: "Shows top of photo" },
    { label: "Center", value: "center center", hint: "Default — shows middle" },
    { label: "Bottom", value: "center bottom", hint: "Shows bottom of photo" },
    { label: "30%",    value: "center 30%",    hint: "Slightly above center" },
    { label: "40%",    value: "center 40%",    hint: "Just above center" },
    { label: "60%",    value: "center 60%",    hint: "Just below center" },
  ];

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
        Hero photo position
      </label>
      <p className="text-[11px] text-slate-400 mb-3">
        Controls which part of the photo shows in the hero. Adjust if the subject is cut off.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {positions.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`rounded-xl border p-3 text-left transition-all ${
              value === p.value
                ? "border-[#0c7b93] bg-[#E0F7F4] text-[#085C52]"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#0c7b93]"
            }`}
          >
            <div className="text-[12px] font-bold">{p.label}</div>
            <div className="text-[10px] opacity-60 mt-0.5">{p.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Ad manager ───────────────────────────────────────────────────────────────
type AdForm = {
  name: string;
  type: "custom" | "adsense";
  is_active: boolean;
  placement: string;
  image_url: string;
  image_alt: string;
  link_url: string;
  title: string;
  description: string;
  adsense_client: string;
  adsense_slot: string;
};

const EMPTY_AD: AdForm = {
  name: "",
  type: "custom",
  is_active: false,
  placement: "attraction_detail",
  image_url: "",
  image_alt: "",
  link_url: "",
  title: "",
  description: "",
  adsense_client: "",
  adsense_slot: "",
};

function AdWarnings({ form }: { form: AdForm }) {
  const warnings: string[] = [];

  if (form.type === "custom") {
    if (!form.title && !form.image_url)
      warnings.push("Custom ad needs at least a title or an image.");
    if (form.image_url && !form.image_alt)
      warnings.push("Image is missing alt text — bad for SEO and accessibility.");
    if (!form.link_url)
      warnings.push("No link URL set — ad won't be clickable.");
  }

  if (form.type === "adsense") {
    if (!form.adsense_client)
      warnings.push("AdSense publisher ID is empty (ca-pub-XXXXXXXX).");
    if (!form.adsense_slot)
      warnings.push("AdSense slot ID is empty.");
  }

  if (!warnings.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">
        ⚠ Missing before going live
      </p>
      {warnings.map((w, i) => (
        <p key={i} className="text-[12px] text-amber-700">• {w}</p>
      ))}
    </div>
  );
}

function AdFormPanel({
  ad,
  onSave,
  onDelete,
  onCancel,
}: {
  ad?: Ad | null;
  onSave: (f: AdForm) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AdForm>(
    ad
      ? {
          name:           ad.name,
          type:           ad.type as "custom" | "adsense",
          is_active:      ad.is_active,
          placement:      ad.placement,
          image_url:      ad.image_url ?? "",
          image_alt:      ad.image_alt ?? "",
          link_url:       ad.link_url ?? "",
          title:          ad.title ?? "",
          description:    ad.description ?? "",
          adsense_client: ad.adsense_client ?? "",
          adsense_slot:   ad.adsense_slot ?? "",
        }
      : EMPTY_AD
  );
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof AdForm>(k: K, v: AdForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title || form.name || "ad");
      fd.append("category", "ad");
      const res  = await fetch("/api/admin/upload-attraction", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        set("image_url",  data.url);
        set("image_alt",  data.alt ?? "");
      }
    } finally { setUploading(false); }
  }

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors";
  const label = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const card  = "rounded-2xl border border-slate-100 bg-white p-5 space-y-4";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">{ad ? "Edit ad" : "Create ad"}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Controls what shows in the ad slot on attraction pages.</p>
        </div>
        <button onClick={onCancel} className="text-[13px] text-slate-400 hover:text-slate-600">← Back</button>
      </div>

      {/* Warnings */}
      {form.is_active && <AdWarnings form={form} />}

      {/* Basic */}
      <div className={card}>
        <h2 className="text-[14px] font-semibold text-slate-700">Basic settings</h2>

        <div>
          <label className={label}>Ad name (internal label)</label>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Island tour promo" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Ad type</label>
            <select className={input} value={form.type} onChange={(e) => set("type", e.target.value as "custom" | "adsense")}>
              <option value="custom">Custom ad (your own)</option>
              <option value="adsense">Google AdSense</option>
            </select>
          </div>
          <div>
            <label className={label}>Placement</label>
            <select className={input} value={form.placement} onChange={(e) => set("placement", e.target.value)}>
              <option value="attraction_detail">Attraction detail page</option>
            </select>
          </div>
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? "bg-[#085C52]" : "bg-slate-200"}`}
            onClick={() => set("is_active", !form.is_active)}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-5" : "translate-x-1"}`} />
          </div>
          <span className="text-[13px] text-slate-700 font-semibold">
            {form.is_active ? "🟢 Live — showing to visitors" : "⚫ Draft — not showing"}
          </span>
        </label>
      </div>

      {/* Custom ad fields */}
      {form.type === "custom" && (
        <div className={card}>
          <h2 className="text-[14px] font-semibold text-slate-700">Custom ad content</h2>

          <div>
            <label className={label}>Headline</label>
            <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Book a Siargao Island Tour" />
          </div>
          <div>
            <label className={label}>Sub-text</label>
            <input className={input} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Local guides, best prices." />
          </div>
          <div>
            <label className={label}>Click URL</label>
            <input className={input} value={form.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="https://... or /tours" />
          </div>

          {/* Image upload */}
          <div>
            <label className={label}>Ad image (optional)</label>
            {form.image_url ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-2">
                <img src={form.image_url} alt={form.image_alt || "Ad"} className="w-full h-36 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">WebP ✓</span>
                  <button
                    type="button"
                    onClick={() => { set("image_url", ""); set("image_alt", ""); }}
                    className="bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full hover:bg-black/70"
                  >
                    Remove
                  </button>
                </div>
                {form.image_alt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                    <p className="text-[10px] text-white/70">Alt: {form.image_alt}</p>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-[#0c7b93] transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                {uploading ? (
                  <span className="text-[13px] text-[#0c7b93] font-medium">Uploading + generating alt text…</span>
                ) : (
                  <>
                    <span className="text-2xl text-slate-300">📸</span>
                    <span className="text-[13px] text-slate-500 font-medium">Upload ad image</span>
                    <span className="text-[11px] text-slate-400">Auto-converted to WebP · AI alt text generated</span>
                  </>
                )}
              </label>
            )}
            {form.image_url && (
              <div className="mt-2">
                <label className={label}>Alt text (editable)</label>
                <input className={input} value={form.image_alt} onChange={(e) => set("image_alt", e.target.value)} placeholder="Describe the image for SEO" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* AdSense fields */}
      {form.type === "adsense" && (
        <div className={card}>
          <h2 className="text-[14px] font-semibold text-slate-700">Google AdSense settings</h2>
          <p className="text-[12px] text-slate-400">
            Find these in your AdSense dashboard under Ads → By ad unit.
          </p>
          <div>
            <label className={label}>Publisher ID</label>
            <input className={input} value={form.adsense_client} onChange={(e) => set("adsense_client", e.target.value)} placeholder="ca-pub-XXXXXXXXXXXXXXXX" />
          </div>
          <div>
            <label className={label}>Ad slot ID</label>
            <input className={input} value={form.adsense_slot} onChange={(e) => set("adsense_slot", e.target.value)} placeholder="XXXXXXXXXX" />
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-[12px] text-blue-700 font-medium">
              💡 Also add your AdSense script to <code className="bg-blue-100 px-1 rounded">app/layout.tsx</code>:
            </p>
            <code className="block text-[11px] text-blue-600 mt-2 bg-blue-100 rounded p-2 whitespace-pre">
              {`<Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" async />`}
            </code>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {ad && onDelete && (
          <button type="button" onClick={async () => { if (!confirm("Delete this ad?")) return; setDeleting(true); await onDelete(); setDeleting(false); }}
            disabled={deleting}
            className="px-4 py-2.5 text-[13px] font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-[13px] font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
          Cancel
        </button>
        <button type="button" onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}
          disabled={saving || !form.name}
          className="ml-auto px-6 py-2.5 text-[13px] font-semibold text-white bg-[#085C52] rounded-xl hover:bg-[#0c7b93] disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : ad ? "Save changes" : "Create ad"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ads admin page ──────────────────────────────────────────────────────
export function AdsAdminPage({ initialAds }: { initialAds: Ad[] }) {
  const [ads,     setAds]     = useState<Ad[]>(initialAds);
  const [editing, setEditing] = useState<Ad | null | "new">(null);

  async function handleSave(form: AdForm) {
    const body = { ...(editing && editing !== "new" ? { id: (editing as Ad).id } : {}), ...form };
    const res  = await fetch("/api/admin/ads/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.id) {
      if (editing === "new") {
        setAds((p) => [{ ...body, id: data.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Ad, ...p]);
      } else {
        setAds((p) => p.map((a) => a.id === data.id ? { ...a, ...body } as Ad : a));
      }
      setEditing(null);
    }
  }

  async function handleDelete() {
    if (!editing || editing === "new") return;
    const res = await fetch("/api/admin/ads/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: (editing as Ad).id }) });
    if (res.ok) { setAds((p) => p.filter((a) => a.id !== (editing as Ad).id)); setEditing(null); }
  }

  if (editing !== null) {
    return <AdFormPanel ad={editing === "new" ? null : editing} onSave={handleSave} onDelete={editing !== "new" ? handleDelete : undefined} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Ad slots</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{ads.filter((a) => a.is_active).length} active · {ads.length} total</p>
        </div>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#085C52] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0c7b93] transition-colors">
          + New ad
        </button>
      </div>

      {ads.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-[13px]">No ads yet. Create your first one above.</div>
      )}

      <div className="space-y-2">
        {ads.map((ad) => (
          <div key={ad.id} onClick={() => setEditing(ad)}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] cursor-pointer transition-colors group">
            <div className={`w-2 h-2 rounded-full shrink-0 ${ad.is_active ? "bg-green-500" : "bg-slate-300"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-800 truncate">{ad.name}</p>
              <p className="text-[11px] text-slate-400">
                {ad.type === "adsense" ? "Google AdSense" : "Custom"} · {ad.placement} · {ad.is_active ? "🟢 Live" : "⚫ Draft"}
              </p>
            </div>
            <svg className="w-4 h-4 text-slate-300 group-hover:text-[#0c7b93] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
