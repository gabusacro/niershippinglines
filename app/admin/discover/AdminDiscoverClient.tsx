"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, Image as ImageIcon, Sparkles, Plus, Check, Loader2,
  Trash2, Save, ArrowLeft, Eye, AlignLeft, Globe, Tag, Link,
  Instagram, Facebook, Video, MapPin, User, ExternalLink,
  ChevronRight, ToggleLeft, ToggleRight, Wand2, X, GripVertical,
  Star, EyeOff, Play,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ItemType  = "video" | "attraction" | "partner";
type Photo     = { id: string; url: string; storage_path: string; sort_order: number; alt_text?: string };

type DiscoverItem = {
  id:                string;
  type:              ItemType;
  title:             string;
  tag:               string;
  emoji:             string;
  description?:      string;
  meta_description?: string;
  seo_tags?:         string[];
  video_path?:       string | null;
  video_url?:        string | null;
  href?:             string | null;
  is_featured:       boolean;
  is_active:         boolean;
  sort_order:        number;
  created_at:        string;
  photos:            Photo[];
  partner_name?:     string;
  partner_website?:  string;
  partner_facebook?: string;
  partner_instagram?:string;
  partner_tiktok?:   string;
};

type SlotPhoto = {
  id:           string;
  url:          string;
  alt:          string;
  isNew:        boolean;   // not yet saved to DB
  file?:        File;
  storage_path?: string;
  dbId?:        string;    // existing DB id
};

const TYPE_OPTIONS: { value: ItemType; label: string; icon: string; color: string }[] = [
  { value: "attraction", label: "Attraction",  icon: "🗺️", color: "#0c7b93" },
  { value: "video",      label: "Video Tour",  icon: "📹", color: "#7C3AED" },
  { value: "partner",    label: "Partner / Ad",icon: "🤝", color: "#D97706" },
];

const MAX_PHOTOS = 5;
const BUCKET     = "discover-media";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugifyTitle(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 55);
}

function getAiErrorMessage(data: any): string {
  const msg = data?.error ?? data?.message ?? "";
  if (msg.includes("credit balance") || msg.includes("too low"))
    return "⚠️ No Anthropic credits — go to console.anthropic.com → Plans & Billing";
  if (msg.includes("API key"))
    return "⚠️ Invalid API key — check ANTHROPIC_API_KEY in Vercel";
  return "AI generation failed — try again.";
}

// ─── SEO preview ──────────────────────────────────────────────────────────────
function SeoPreview({ title, metaDescription }: { title: string; metaDescription: string }) {
  const metaTitle = title ? `${title} — Siargao Island | Travela Siargao` : "Title | Travela Siargao";
  const metaDesc  = metaDescription || "Discover the best of Siargao Island.";
  const titleOk   = metaTitle.length <= 65;
  const descOk    = metaDesc.length  <= 160;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Google preview</p>
      </div>
      <p className="text-[11px] text-green-700 mb-0.5 truncate">travelasiargao.com/discover/{slugifyTitle(title) || "item"}</p>
      <p className={`text-[15px] font-medium mb-1 truncate ${titleOk ? "text-blue-700" : "text-red-600"}`}>{metaTitle}</p>
      <p className={`text-[12px] leading-relaxed ${descOk ? "text-slate-600" : "text-red-500"}`}>{metaDesc.slice(0, 160)}{metaDesc.length > 160 ? "…" : ""}</p>
      <div className="flex gap-4 mt-1.5 text-[10px]">
        <span className={titleOk ? "text-green-600" : "text-red-500"}>Title: {metaTitle.length}/65</span>
        <span className={descOk  ? "text-green-600" : "text-red-500"}>Meta: {metaDesc.length}/160</span>
      </div>
    </div>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. siargao partner business"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]" />
        <button type="button" onClick={add}
          className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-medium hover:bg-slate-200">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              <Tag className="w-2.5 h-2.5" />{tag}
              <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-[#085041]/50 hover:text-[#085041] ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Slot-based photo upload ──────────────────────────────────────────────────
function SlotPhotoUpload({
  photos, title, category, onChange, maxPhotos = MAX_PHOTOS,
}: {
  photos:    SlotPhoto[];
  title:     string;
  category:  string;
  onChange:  (photos: SlotPhoto[]) => void;
  maxPhotos?: number;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [errors,    setErrors]    = useState<Record<number, string>>({});
  const inputRefs = Array.from({ length: maxPhotos }, () => useRef<HTMLInputElement>(null));

  async function handleUpload(slotIndex: number, file: File) {
    setUploading(slotIndex);
    setErrors((e) => ({ ...e, [slotIndex]: "" }));
    try {
      const fd = new FormData();
      fd.append("file",     file);
      fd.append("title",    title || "siargao discover");
      fd.append("category", category || "discover");
      const res  = await fetch("/api/admin/upload-attraction", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrors((e) => ({ ...e, [slotIndex]: data.error ?? "Upload failed" }));
        return;
      }
      const next = [...photos];
      next[slotIndex] = { id: `new-${Date.now()}`, url: data.url, alt: data.alt ?? "", isNew: true, file };
      onChange(next.filter(Boolean));
    } catch {
      setErrors((e) => ({ ...e, [slotIndex]: "Network error" }));
    } finally { setUploading(null); }
  }

  function removePhoto(i: number) {
    const next = [...photos];
    next.splice(i, 1);
    onChange(next);
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Photos (up to {maxPhotos}) · Auto WebP compression · AI alt text
        </p>
        <p className="text-[11px] text-slate-400">{photos.length}/{maxPhotos} · First = hero</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {slots.map((photo, i) => (
          <div key={i}>
            <input ref={inputRefs[i]} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(i, e.target.files[0])} />
            {photo ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 group" style={{ aspectRatio: "1" }}>
                <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                  <button type="button" onClick={() => inputRefs[i].current?.click()}
                    className="flex items-center gap-1 px-2 py-1 bg-white/20 text-white text-[10px] font-semibold rounded-lg hover:bg-white/30">
                    <Upload className="w-2.5 h-2.5" /> Replace
                  </button>
                  <button type="button" onClick={() => removePhoto(i)}
                    className="flex items-center gap-1 px-2 py-1 bg-red-500/80 text-white text-[10px] font-semibold rounded-lg hover:bg-red-500">
                    <X className="w-2.5 h-2.5" /> Remove
                  </button>
                </div>
                <div className="absolute top-1 left-1">
                  <span style={{
                    background: i === 0 ? "#085C52" : "rgba(0,0,0,0.5)", color: "white",
                    fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 999, textTransform: "uppercase",
                  }}>{i === 0 ? "Hero" : `#${i + 1}`}</span>
                </div>
                {photos.length > 1 && (
                  <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {i > 0 && <button type="button" onClick={() => movePhoto(i, i - 1)} className="w-5 h-5 bg-white/30 text-white rounded text-[9px] flex items-center justify-center hover:bg-white/50">←</button>}
                    {i < photos.length - 1 && <button type="button" onClick={() => movePhoto(i, i + 1)} className="w-5 h-5 bg-white/30 text-white rounded text-[9px] flex items-center justify-center hover:bg-white/50">→</button>}
                  </div>
                )}
              </div>
            ) : (
              <button type="button"
                onClick={() => i <= photos.length && inputRefs[i].current?.click()}
                disabled={uploading !== null || i > photos.length}
                className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all hover:border-[#0c7b93] hover:bg-slate-50"
                style={{ aspectRatio: "1", borderColor: i > photos.length ? "#F1F5F9" : "#E2E8F0", background: "#FAFAFA", cursor: i > photos.length ? "not-allowed" : "pointer", opacity: i > photos.length ? 0.4 : 1 }}>
                {uploading === i ? (
                  <Loader2 className="w-4 h-4 text-[#0c7b93] animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 text-slate-300 mb-0.5" />
                    <span style={{ fontSize: 9, color: i > photos.length ? "#CBD5E1" : "#94A3B8", fontWeight: 500 }}>
                      {i === 0 ? "Hero photo" : i > photos.length ? `Add ${i} first` : `Photo ${i + 1}`}
                    </span>
                  </>
                )}
              </button>
            )}
            {errors[i] && <p style={{ fontSize: 9, color: "#EF4444", marginTop: 2 }}>{errors[i]}</p>}
          </div>
        ))}
      </div>

      {/* Alt text editing */}
      {photos.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Alt text (AI-generated, editable)</p>
          {photos.map((photo, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, minWidth: 36, textTransform: "uppercase" }}>
                {i === 0 ? "Hero" : `#${i + 1}`}
              </span>
              <input value={photo.alt}
                onChange={(e) => { const next = [...photos]; next[i] = { ...next[i], alt: e.target.value }; onChange(next); }}
                placeholder="Describe for Google…"
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] bg-white focus:outline-none focus:border-[#0c7b93]" />
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 10, color: "#9CA3AF" }}>💡 All photos auto-compressed to WebP · AI writes alt text on upload</p>
    </div>
  );
}

// ─── AI buttons ───────────────────────────────────────────────────────────────
function AiRewriteButton({ title, description, category, onDone }: {
  title: string; description: string; category: string; onDone: (v: string) => void;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function run() {
    if (!title.trim()) { alert("Add a title first!"); return; }
    setState("loading"); setErrMsg("");
    try {
      const res  = await fetch("/api/admin/attractions/generate-seo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, mode: "enhance" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setErrMsg(getAiErrorMessage(data)); setState("error"); setTimeout(() => setState("idle"), 8000); return; }
      if (data.description) { onDone(data.description); setState("done"); setTimeout(() => setState("idle"), 3000); }
    } catch { setErrMsg("Network error."); setState("error"); setTimeout(() => setState("idle"), 5000); }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={state === "loading"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state === "done"  ? "bg-green-50 text-green-700 border-green-200" :
          state === "error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        } disabled:opacity-50`}>
        {state === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : state === "done" ? <Check className="w-3 h-3" /> : state === "error" ? <span>✕</span> : <Wand2 className="w-3 h-3" />}
        {state === "done" ? "Rewritten!" : state === "loading" ? "Rewriting…" : state === "error" ? "Failed" : "✨ Rewrite"}
      </button>
      {state === "error" && errMsg && <p className="text-[10px] text-red-500 max-w-xs text-right">{errMsg}</p>}
    </div>
  );
}

function AiSeoButton({ title, description, category, onDone }: {
  title: string; description: string; category: string;
  onDone: (tags: string[], metaDesc: string) => void;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function run() {
    if (!title.trim()) { alert("Add a title first!"); return; }
    setState("loading"); setErrMsg("");
    try {
      const res  = await fetch("/api/admin/attractions/generate-seo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, mode: "seo" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setErrMsg(getAiErrorMessage(data)); setState("error"); setTimeout(() => setState("idle"), 8000); return; }
      if (data.tags) { onDone(data.tags, data.description ?? ""); setState("done"); setTimeout(() => setState("idle"), 3000); }
    } catch { setErrMsg("Network error."); setState("error"); setTimeout(() => setState("idle"), 5000); }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={state === "loading"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state === "done"  ? "bg-green-50 text-green-700 border-green-200" :
          state === "error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
        } disabled:opacity-50`}>
        {state === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : state === "done" ? <Check className="w-3 h-3" /> : state === "error" ? <span>✕</span> : <Sparkles className="w-3 h-3" />}
        {state === "done" ? "Generated!" : state === "loading" ? "Generating…" : state === "error" ? "Failed" : "Auto-generate SEO"}
      </button>
      {state === "error" && errMsg && <p className="text-[10px] text-red-500 max-w-xs text-right">{errMsg}</p>}
    </div>
  );
}


function AiTitleButton({ title, description, category, onDone }: {
  title: string; description: string; category: string; onDone: (v: string) => void;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function run() {
    setState("loading"); setErrMsg("");
    try {
      const res = await fetch("/api/admin/attractions/generate-seo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category,
          mode: "title",   // we'll add this mode below
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setErrMsg(getAiErrorMessage(data)); setState("error"); setTimeout(() => setState("idle"), 8000); return; }
      if (data.title) { onDone(data.title); setState("done"); setTimeout(() => setState("idle"), 3000); }
    } catch { setErrMsg("Network error."); setState("error"); setTimeout(() => setState("idle"), 5000); }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={state === "loading"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state === "done"  ? "bg-green-50 text-green-700 border-green-200" :
          state === "error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        } disabled:opacity-50`}>
        {state === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : state === "done" ? <Check className="w-3 h-3" /> : state === "error" ? <span>✕</span> : <Sparkles className="w-3 h-3" />}
        {state === "done" ? "Generated!" : state === "loading" ? "Generating…" : state === "error" ? "Failed" : "AI title"}
      </button>
      {state === "error" && errMsg && <p className="text-[10px] text-red-500 max-w-xs text-right">{errMsg}</p>}
    </div>
  );
}







// ─── Item form panel ──────────────────────────────────────────────────────────
function ItemFormPanel({
  item, onSave, onDelete, onCancel,
}: {
  item?:     DiscoverItem | null;
  onSave:    (data: Partial<DiscoverItem> & { newPhotos: SlotPhoto[]; removedPhotoIds: string[] }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel:  () => void;
}) {
  const [type,             setType]             = useState<ItemType>(item?.type ?? "attraction");
  const [title,            setTitle]            = useState(item?.title ?? "");
  const [tag,              setTag]              = useState(item?.tag ?? "🗺️ Attraction");
  const [description,      setDescription]      = useState(item?.description ?? "");
  const [metaDescription,  setMetaDescription]  = useState(item?.meta_description ?? "");
  const [seoTags,          setSeoTags]          = useState<string[]>(item?.seo_tags ?? []);
  const [videoUrl,         setVideoUrl]         = useState(item?.video_url ?? "");
  const [href,             setHref]             = useState(item?.href ?? "");
  const [isFeatured,       setIsFeatured]       = useState(item?.is_featured ?? false);
  const [isActive,         setIsActive]         = useState(item?.is_active ?? true);
  const [sortOrder,        setSortOrder]        = useState(item?.sort_order ?? 0);
  const [partnerName,      setPartnerName]      = useState(item?.partner_name ?? "");
  const [partnerWebsite,   setPartnerWebsite]   = useState(item?.partner_website ?? "");
  const [partnerFacebook,  setPartnerFacebook]  = useState(item?.partner_facebook ?? "");
  const [partnerInstagram, setPartnerInstagram] = useState(item?.partner_instagram ?? "");
  const [partnerTiktok,    setPartnerTiktok]    = useState(item?.partner_tiktok ?? "");
  const [wordCount,        setWordCount]        = useState(description.split(/\s+/).filter(Boolean).length);
  const [saving,           setSaving]           = useState(false);
  const [deleting,         setDeleting]         = useState(false);

  // Slot photos — pre-populate from existing
  const [photos, setPhotos] = useState<SlotPhoto[]>(
    (item?.photos ?? []).map((p) => ({
      id: p.id, url: p.url, alt: p.alt_text ?? "", isNew: false,
      storage_path: p.storage_path, dbId: p.id,
    }))
  );
  const [originalPhotoIds] = useState<string[]>((item?.photos ?? []).map((p) => p.id));

  function handleTypeChange(t: ItemType) {
    setType(t);
    const opt = TYPE_OPTIONS.find((o) => o.value === t)!;
    setTag(opt.value === "attraction" ? "🗺️ Attraction" : opt.value === "video" ? "📹 Video Tour" : "🤝 Partner");
  }

  function handleDescChange(v: string) {
    setDescription(v);
    setWordCount(v.split(/\s+/).filter(Boolean).length);
  }

  async function handleSave() {
    if (!title.trim()) { alert("Title is required"); return; }
    setSaving(true);
    try {
      const newPhotos     = photos.filter((p) => p.isNew);
      const currentIds    = photos.filter((p) => !p.isNew).map((p) => p.dbId!);
      const removedPhotoIds = originalPhotoIds.filter((id) => !currentIds.includes(id));
      await onSave({
        type, title, tag, description, meta_description: metaDescription, seo_tags: seoTags,
        video_url: videoUrl || null, href: href || null, is_featured: isFeatured,
        is_active: isActive, sort_order: sortOrder,
        partner_name: partnerName || null, partner_website: partnerWebsite || null,
        partner_facebook: partnerFacebook || null, partner_instagram: partnerInstagram || null,
        partner_tiktok: partnerTiktok || null,
        newPhotos, removedPhotoIds,
      } as any);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this item? Cannot be undone.")) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors";
  const lbl   = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const card  = "rounded-2xl border border-slate-100 bg-white p-5 space-y-4";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">{item ? "Edit item" : "Add item"}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Shown in the Discover Siargao section.</p>
        </div>
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Type selector */}
      <div className={card}>
        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Item type</h2></div>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((o) => (
            <button key={o.value} type="button" onClick={() => handleTypeChange(o.value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                type === o.value ? "border-[#0c7b93] bg-[#E0F7F4] text-[#085C52]" : "border-slate-200 bg-white text-slate-500 hover:border-[#0c7b93]"
              }`}>
              <span style={{ fontSize: 22 }}>{o.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={card}>
        <div className="flex items-center gap-2"><AlignLeft className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Content</h2></div>



<div>
  <div className="flex items-center justify-between mb-1.5">
    <label className={lbl} style={{ marginBottom: 0 }}>Title *</label>
    <AiTitleButton
      title={title}
      description={description}
      category={type}
      onDone={setTitle}
    />
  </div>
  <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cloud 9 Surfing Beach" />
</div>








        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tag label (shown on card)</label>
            <input className={input} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="🗺️ Attraction" />
          </div>
          <div>
            <label className={lbl}>Sort order</label>
            <input type="number" className={input} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>Description (shown in modal)</label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{wordCount} words</span>
              <AiRewriteButton title={title} description={description} category={type} onDone={handleDescChange} />
            </div>
          </div>
          <textarea className={input + " resize-y"} rows={5} value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="Write anything — AI can rewrite it into engaging travel content." />
          <p className="text-[10px] text-slate-400 mt-1">💡 Rough notes or full paragraphs — AI rewrites into 2–3 engaging paragraphs.</p>
        </div>

        <div>
          <label className={lbl}>Link URL (optional)</label>
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-slate-300 shrink-0" />
            <input className={input} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/attractions/cloud-9 or https://facebook.com/..." />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-6 pt-1">
          {[
            { key: "is_featured", label: "Featured", value: isFeatured, set: setIsFeatured },
            { key: "is_active",   label: "Active",   value: isActive,   set: setIsActive   },
          ].map(({ key, label, value, set }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-9 h-5 rounded-full transition-colors relative ${value ? "bg-[#085C52]" : "bg-slate-200"}`}
                onClick={() => set(!value)}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-[13px] text-slate-600">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Photos */}
      <div className={card}>
        <div className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Photos</h2></div>
        <SlotPhotoUpload photos={photos} title={title} category={type} onChange={setPhotos} maxPhotos={MAX_PHOTOS} />
      </div>

      {/* Video */}
      <div className={card}>
        <div className="flex items-center gap-2"><Play className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Video (optional)</h2></div>
        <div>
          <label className={lbl}>Video URL (YouTube, Facebook, TikTok, or direct upload link)</label>
          <input className={input} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://fb.watch/..." />
          <p className="text-[10px] text-slate-400 mt-1">Paste a link — plays in the modal when visitors tap the item.</p>
        </div>
      </div>

      {/* Partner info — shown only for partner type */}
      {type === "partner" && (
        <div className={card}>
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Partner info</h2></div>
          <div>
            <label className={lbl}>Business / person name</label>
            <input className={input} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="e.g. Juan dela Cruz" />
          </div>
          <div>
            <label className={lbl}>Website</label>
            <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-slate-300 shrink-0" />
              <input className={input} value={partnerWebsite} onChange={(e) => setPartnerWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={lbl}>Facebook</label>
              <div className="flex items-center gap-2"><Facebook className="w-4 h-4 text-blue-400 shrink-0" />
                <input className={input} value={partnerFacebook} onChange={(e) => setPartnerFacebook(e.target.value)} placeholder="https://facebook.com/..." />
              </div>
            </div>
            <div>
              <label className={lbl}>Instagram</label>
              <div className="flex items-center gap-2"><Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                <input className={input} value={partnerInstagram} onChange={(e) => setPartnerInstagram(e.target.value)} placeholder="https://instagram.com/..." />
              </div>
            </div>
            <div>
              <label className={lbl}>TikTok</label>
              <div className="flex items-center gap-2"><Video className="w-4 h-4 text-slate-400 shrink-0" />
                <input className={input} value={partnerTiktok} onChange={(e) => setPartnerTiktok(e.target.value)} placeholder="https://tiktok.com/@..." />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEO */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">SEO</h2></div>
          <AiSeoButton title={title} description={description} category={type}
            onDone={(tags, metaDesc) => {
              setSeoTags((prev) => Array.from(new Set([...prev, ...tags])));
              if (metaDesc) setMetaDescription(metaDesc.slice(0, 160));
            }} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>Google meta description</label>
            <span className={`text-[10px] font-semibold ${metaDescription.length > 160 ? "text-red-500" : metaDescription.length > 0 ? "text-green-600" : "text-slate-400"}`}>
              {metaDescription.length}/160
            </span>
          </div>
          <textarea className={input + " resize-none"} rows={3} maxLength={160} value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Short summary for Google results. Max 160 chars. Hit Auto-generate SEO to fill." />
        </div>

        <div>
          <label className={lbl}><div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> SEO keyword tags</div></label>
          <TagInput tags={seoTags} onChange={setSeoTags} />
        </div>

        <SeoPreview title={title} metaDescription={metaDescription} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {item && onDelete && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" /> {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !title.trim()}
          className="ml-auto flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-semibold text-white bg-[#085C52] rounded-xl hover:bg-[#0c7b93] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : item ? "Save changes" : "Add item"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AdminDiscoverClient() {
  const supabase = createClient();
  const [items,   setItems]   = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DiscoverItem | null | "new">(null);
  const [search,  setSearch]  = useState("");
  const [flash,   setFlash]   = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showFlash(msg: string, type: "success" | "error" = "success") {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  }

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("discover_items")
      .select("*, photos:discover_item_photos(id, url, storage_path, sort_order, alt_text)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) showFlash(error.message, "error");
    else setItems((data ?? []).map((i: any) => ({
      ...i,
      photos: ((i.photos ?? []) as Photo[]).sort((a, b) => a.sort_order - b.sort_order),
    })));
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function handleSave(data: any) {
    const isNew = editing === "new";
    const id    = isNew ? null : (editing as DiscoverItem).id;

    const payload = {
      type: data.type, title: data.title, tag: data.tag,
      description: data.description || null,
      meta_description: data.meta_description || null,
      seo_tags: data.seo_tags ?? [],
      emoji: "📷", href: data.href, is_featured: data.is_featured,
      is_active: data.is_active, sort_order: data.sort_order,
      video_path: null, video_url: data.video_url,
      partner_name: data.partner_name, partner_website: data.partner_website,
      partner_facebook: data.partner_facebook, partner_instagram: data.partner_instagram,
      partner_tiktok: data.partner_tiktok,
    };

    let itemId = id;

    if (isNew) {
      const { data: inserted, error } = await supabase.from("discover_items").insert(payload).select("id").single();
      if (error || !inserted) { showFlash(error?.message ?? "Save failed", "error"); return; }
      itemId = inserted.id;
    } else {
      const { error } = await supabase.from("discover_items").update(payload).eq("id", itemId);
      if (error) { showFlash(error.message, "error"); return; }
    }

    // Remove deleted photos
    for (const photoId of (data.removedPhotoIds ?? [])) {
      const existing = (editing as DiscoverItem)?.photos?.find((p) => p.id === photoId);
      if (existing?.storage_path) await supabase.storage.from(BUCKET).remove([existing.storage_path]);
      await supabase.from("discover_item_photos").delete().eq("id", photoId);
    }

    // Save new photos
    const newPhotos = (data.newPhotos ?? []) as SlotPhoto[];
    if (newPhotos.length > 0) {
      const existingCount = (editing as DiscoverItem)?.photos?.filter((p) =>
        !(data.removedPhotoIds ?? []).includes(p.id)
      ).length ?? 0;

      const photoRows = newPhotos.map((p, i) => ({
        item_id:      itemId,
        url:          p.url,
        storage_path: p.url.split("/").pop() ?? "",
        alt_text:     p.alt,
        sort_order:   existingCount + i,
      }));

      const { error } = await supabase.from("discover_item_photos").insert(photoRows);
      if (error) showFlash(`Photos saved but DB insert failed: ${error.message}`, "error");
    }

    showFlash(isNew ? "Item added ✓" : "Item updated ✓");
    setEditing(null);
    await loadItems();
  }

  async function handleDelete() {
    if (!editing || editing === "new") return;
    const item = editing as DiscoverItem;
    for (const photo of item.photos) {
      if (photo.storage_path) await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    }
    if (item.video_path) await supabase.storage.from(BUCKET).remove([item.video_path]);
    await supabase.from("discover_items").delete().eq("id", item.id);
    showFlash("Item deleted");
    setEditing(null);
    await loadItems();
  }

  async function toggleActive(item: DiscoverItem) {
    await supabase.from("discover_items").update({ is_active: !item.is_active }).eq("id", item.id);
    showFlash(item.is_active ? "Hidden from visitors" : "Now visible ✓");
    await loadItems();
  }

  async function toggleFeatured(item: DiscoverItem) {
    if (!item.is_featured) await supabase.from("discover_items").update({ is_featured: false }).neq("id", "none");
    await supabase.from("discover_items").update({ is_featured: !item.is_featured }).eq("id", item.id);
    showFlash(item.is_featured ? "Removed from featured" : "Set as featured ✓");
    await loadItems();
  }

  const filtered = items.filter((i) =>
    !search.trim() || i.title.toLowerCase().includes(search.toLowerCase())
  );

  const good = items.filter((i) => i.is_active && i.photos.length > 0).length;

  if (editing !== null) {
    return (
      <ItemFormPanel
        item={editing === "new" ? null : editing}
        onSave={handleSave}
        onDelete={editing !== "new" ? handleDelete : undefined}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-[13px] font-semibold shadow-lg ${
          flash.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {flash.msg}
        </div>
      )}

      {/* Dashboard header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#085C52,#0c7b93)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>🌊</span>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Discover Siargao</h1>
            <p style={{ fontSize: 12, color: "#6B7280" }}>Attractions · Videos · Partner ads</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",    value: items.length,                                           color: "#0c7b93", bg: "#E0F7F4" },
            { label: "Active",   value: items.filter((i) => i.is_active).length,                color: "#085C52", bg: "#DCFCE7" },
            { label: "Partners", value: items.filter((i) => i.type === "partner").length,       color: "#D97706", bg: "#FEF9C3" },
            { label: "No photo", value: items.filter((i) => i.photos.length === 0).length,      color: "#991B1B", bg: "#FEE2E2" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.7, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0c7b93] bg-white" />
        </div>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#085C52] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0c7b93] transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add item
        </button>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#0c7b93] mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-[13px]">No items found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const typeCfg = TYPE_OPTIONS.find((t) => t.value === item.type)!;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] transition-colors group">

                {/* Thumbnail */}
                <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center relative">
                  {item.photos[0] ? (
                    <img src={item.photos[0].url} alt={item.photos[0].alt_text ?? item.title} className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ fontSize: 20 }}>{typeCfg.icon}</span>
                  )}
                  {item.video_url && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                        <Play className="w-3 h-3 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0" onClick={() => setEditing(item)} style={{ cursor: "pointer" }}>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title}</p>
                    {item.is_featured && <span className="shrink-0 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                    {!item.is_active   && <span className="shrink-0 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Hidden</span>}
                    {item.photos.length === 0 && <span className="shrink-0 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">No photo</span>}
                    {!(item as any).meta_description && <span className="shrink-0 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">No SEO</span>}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    <span style={{ color: typeCfg.color, fontWeight: 600 }}>{typeCfg.label}</span>
                    {" · "}{item.tag}{" · "}📸 {item.photos.length}
                    {item.partner_name && ` · 🤝 ${item.partner_name}`}
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => toggleFeatured(item)}
                    className={`p-1.5 rounded-lg transition-colors ${item.is_featured ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600"}`}
                    title={item.is_featured ? "Unfeature" : "Set as featured"}>
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleActive(item)}
                    className={`p-1.5 rounded-lg transition-colors ${item.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-600"}`}
                    title={item.is_active ? "Hide" : "Show"}>
                    {item.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => setEditing(item)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-[#E0F7F4] hover:text-[#085C52] transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 group-hover:text-[#0c7b93]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <a href="/admin" className="text-[12px] font-semibold text-[#0c7b93] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to admin dashboard
        </a>
      </div>
    </div>
  );
}
