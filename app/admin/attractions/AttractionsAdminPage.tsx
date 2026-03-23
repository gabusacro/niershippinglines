"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Image as ImageIcon, Sparkles, Search, Plus,
  ChevronRight, Tag, Clock, MapPin, FileText, Globe,
  Wand2, Check, Loader2, Trash2, Save, ArrowLeft, Eye, AlignLeft,
} from "lucide-react";

import type { Attraction, AttractionForm } from "@/lib/attractions/types";
import { MultiPhotoUpload } from "@/components/attractions/MultiPhotoUpload";
import { EMPTY_FORM, GRADIENTS, CATEGORIES } from "@/lib/attractions/types";
import { AdsAdminPage } from "./AdsAdminPage";

type Photo = { url: string; alt: string };

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
}

// ── SEO preview uses meta_description, not full description ──────────────────
function SeoPreview({ title, metaDescription, slug }: { title: string; metaDescription: string; slug: string }) {
  const url       = `travelasiargao.com/attractions/${slug || slugify(title) || "attraction-name"}`;
  const metaTitle = title ? `${title} — Siargao Island | Travela Siargao` : "Title | Travela Siargao";
  const metaDesc  = metaDescription || "Discover the best of Siargao Island.";
  const titleOk   = metaTitle.length <= 65;
  const descOk    = metaDesc.length  <= 160;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Google preview</p>
      </div>
      <p className="text-[11px] text-green-700 mb-0.5 font-medium truncate">{url}</p>
      <p className={`text-[16px] font-medium mb-1 truncate ${titleOk ? "text-blue-700" : "text-red-600"}`}>{metaTitle}</p>
      <p className={`text-[13px] leading-relaxed ${descOk ? "text-slate-600" : "text-red-500"}`}>
        {metaDesc.slice(0, 160)}{metaDesc.length > 160 ? "…" : ""}
      </p>
      <div className="flex gap-4 mt-2 text-[10px]">
        <span className={titleOk ? "text-green-600" : "text-red-500"}>Title: {metaTitle.length}/65</span>
        <span className={descOk  ? "text-green-600" : "text-red-500"}>Meta desc: {metaDesc.length}/160</span>
      </div>
    </div>
  );
}

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
          placeholder="e.g. siargao tourist spots 2026"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93]" />
        <button type="button" onClick={add}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-medium hover:bg-slate-200 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              <Tag className="w-2.5 h-2.5" />{tag}
              <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-[#085041]/50 hover:text-[#085041] ml-0.5 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroPositionPicker({ value, onChange, imageUrl }: {
  value: string; onChange: (v: string) => void; imageUrl?: string;
}) {
  const positions = [
    { label: "Top",    value: "center top",    hint: "Sky / treetops" },
    { label: "30%",    value: "center 30%",    hint: "Above center" },
    { label: "Center", value: "center center", hint: "Default" },
    { label: "50%",    value: "center 50%",    hint: "True middle" },
    { label: "60%",    value: "center 60%",    hint: "Below center" },
    { label: "Bottom", value: "center bottom", hint: "Foreground" },
  ];
  return (
    <div className="space-y-3">
      {imageUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-200 relative" style={{ height: 130 }}>
          <img src={imageUrl} alt="Hero crop preview" className="w-full h-full object-cover transition-all duration-300" style={{ objectPosition: value }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
            <p className="text-white text-[11px] font-semibold">Live preview</p>
            <span className="text-white/70 text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded-full">{value}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {positions.map((p) => (
          <button key={p.value} type="button" onClick={() => onChange(p.value)}
            className={`rounded-xl border p-2.5 text-left transition-all ${value === p.value ? "border-[#0c7b93] bg-[#E0F7F4] text-[#085C52]" : "border-slate-200 bg-white text-slate-600 hover:border-[#0c7b93]"}`}>
            <div className="text-[12px] font-bold">{p.label}</div>
            <div className="text-[10px] opacity-60 mt-0.5">{p.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getAiErrorMessage(data: any): string {
  const msg = data?.error ?? data?.message ?? "";
  if (msg.includes("credit balance") || msg.includes("too low"))
    return "⚠️ No Anthropic credits — go to console.anthropic.com → Plans & Billing → add $5.";
  if (msg.includes("API key"))
    return "⚠️ Invalid API key — check ANTHROPIC_API_KEY in Vercel environment variables.";
  return "AI generation failed — try again.";
}

function AiSeoButton({ title, description, category, onDone }: {
  title: string; description: string; category: string;
  onDone: (tags: string[], metaDesc: string) => void;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function generate() {
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
      <button type="button" onClick={generate} disabled={state === "loading"}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state === "done"  ? "bg-green-50 text-green-700 border-green-200" :
          state === "error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
        } disabled:opacity-50`}>
        {state === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === "done" ? <Check className="w-3.5 h-3.5" /> : state === "error" ? <span>✕</span> : <Sparkles className="w-3.5 h-3.5" />}
        {state === "done" ? "Generated!" : state === "loading" ? "Generating…" : state === "error" ? "Failed" : "Auto-generate SEO"}
      </button>
      {state === "error" && errMsg && <p className="text-[11px] text-red-500 max-w-xs text-right leading-relaxed">{errMsg}</p>}
    </div>
  );
}

function EnhanceDescriptionButton({ title, description, category, onDone }: {
  title: string; description: string; category: string; onDone: (enhanced: string) => void;
}) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function enhance() {
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
      <button type="button" onClick={enhance} disabled={state === "loading"}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state === "done"  ? "bg-green-50 text-green-700 border-green-200" :
          state === "error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        } disabled:opacity-50`}>
        {state === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === "done" ? <Check className="w-3.5 h-3.5" /> : state === "error" ? <span>✕</span> : <Wand2 className="w-3.5 h-3.5" />}
        {state === "done" ? "Rewritten!" : state === "loading" ? "Rewriting…" : state === "error" ? "Failed" : "✨ Rewrite description"}
      </button>
      {state === "error" && errMsg && <p className="text-[11px] text-red-500 max-w-xs text-right leading-relaxed">{errMsg}</p>}
    </div>
  );
}

function AttractionFormPanel({ item, onSave, onDelete, onCancel }: {
  item?: Attraction | null;
  onSave:    (f: AttractionForm & { hero_position: string; photos: Photo[]; meta_description: string; description_html: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel:  () => void;
}) {
  const [form, setForm] = useState<AttractionForm>(
    item ? {
      title:          item.title,
      slug:           item.slug,
      description:    item.description    ?? "",
      image_url:      item.image_url      ?? "",
      image_alt:      "",
      category:       (item.category      ?? "attractions") as AttractionForm["category"],
      cover_gradient: item.cover_gradient ?? GRADIENTS[0].value,
      cover_emoji:    item.cover_emoji    ?? "🌴",
      is_live:        item.is_live,
      is_featured:    item.is_featured,
      is_published:   item.is_published,
      read_minutes:   item.read_minutes   ?? 2,
      seo_tags:       item.seo_tags       ?? [],
      type:           item.type           ?? "attraction",
      sort_order:     item.sort_order     ?? 0,
    } : EMPTY_FORM
  );

  const [photos,          setPhotos]          = useState<Photo[]>(
    (item as any)?.photos?.length
      ? (item as any).photos
      : item?.image_url ? [{ url: item.image_url, alt: item.title }] : []
  );
  const [heroPosition,    setHeroPosition]    = useState<string>((item as any)?.hero_position ?? "center center");
  const [metaDescription, setMetaDescription] = useState<string>((item as any)?.meta_description ?? "");
  const [descriptionHtml, setDescriptionHtml] = useState<string>((item as any)?.description_html ?? "");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [wordCount, setWordCount] = useState(form.description.split(/\s+/).filter(Boolean).length);

  function set<K extends keyof AttractionForm>(k: K, v: AttractionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "description") setWordCount(String(v).split(/\s+/).filter(Boolean).length);
  }

  function handlePhotosChange(p: Photo[]) {
    setPhotos(p);
    set("image_url", p[0]?.url ?? "");
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave({ ...form, hero_position: heroPosition, photos, meta_description: metaDescription, description_html: descriptionHtml }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this attraction? This cannot be undone.")) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors";
  const lbl   = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const card  = "rounded-2xl border border-slate-100 bg-white p-5 space-y-4";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">{item ? "Edit attraction" : "Add attraction"}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Shows on the public Explore & Discover page.</p>
        </div>
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Content ── */}
      <div className={card}>
        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Content</h2></div>
        <div>
          <label className={lbl}>Title *</label>
          <input className={input} value={form.title}
            onChange={(e) => { set("title", e.target.value); if (!item) set("slug", slugify(e.target.value)); }}
            placeholder="e.g. Cloud 9 Surf Break" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              <div className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> Full description (shown on page)</div>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{wordCount} words</span>
              <EnhanceDescriptionButton title={form.title} description={form.description} category={form.category} onDone={(v) => set("description", v)} />
            </div>
          </div>
          <textarea className={input + " resize-y"} rows={6} value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Write anything — a few words or several paragraphs. Hit '✨ Rewrite description' and AI will turn it into polished travel content." />
          <p className="text-[10px] text-slate-400 mt-1">💡 This is the full text shown on the attraction page. Can be as long as you want.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Type</label>
            <select className={input} value={form.type} onChange={(e) => set("type", e.target.value as AttractionForm["type"])}>
              <option value="attraction">Attraction / place</option>
              <option value="news">News / story</option>
              <option value="video">Video</option>
              <option value="tip">Travel tip</option>
              <option value="partner">Partner / sponsored</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Category</label>
            <select className={input} value={form.category} onChange={(e) => set("category", e.target.value as AttractionForm["category"])}>
              {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}><div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Read time (minutes)</div></label>
            <input type="number" min={1} max={30} className={input} value={form.read_minutes} onChange={(e) => set("read_minutes", Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Emoji fallback</label>
            <input className={input} value={form.cover_emoji} onChange={(e) => set("cover_emoji", e.target.value)} placeholder="🌴" />
          </div>
        </div>
        <div>
          <label className={lbl}>Gradient (shown if no photo)</label>
          <div className="grid grid-cols-7 gap-2">
            {GRADIENTS.map((g) => (
              <button key={g.value} type="button" onClick={() => set("cover_gradient", g.value)}
                className={`h-9 rounded-lg bg-gradient-to-br ${g.value} transition-all ${form.cover_gradient === g.value ? "ring-2 ring-[#0c7b93] ring-offset-1" : "opacity-60 hover:opacity-100"}`}
                title={g.label} />
            ))}
          </div>
        </div>
        <div className="flex gap-6 pt-1">
          {(["is_featured", "is_live", "is_published"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form[key] ? "bg-[#085C52]" : "bg-slate-200"}`} onClick={() => set(key, !form[key])}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[key] ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-[13px] text-slate-600 capitalize">{key.replace("is_", "")}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Photos ── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-slate-400" />
          <h2 className="text-[14px] font-semibold text-slate-700">Photos</h2>
        </div>
        <MultiPhotoUpload photos={photos} title={form.title} category={form.category} onChange={handlePhotosChange} />
        {photos.length > 0 && (
          <div>
            <label className={lbl}><div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Hero crop position</div></label>
            <p className="text-[11px] text-slate-400 mb-2">Click a position — preview updates live.</p>
            <HeroPositionPicker value={heroPosition} onChange={setHeroPosition} imageUrl={photos[0]?.url} />
          </div>
        )}
      </div>

      {/* ── SEO ── */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">SEO</h2></div>
          <AiSeoButton title={form.title} description={form.description} category={form.category}
            onDone={(tags, metaDesc) => {
              set("seo_tags", Array.from(new Set([...form.seo_tags, ...tags])));
              if (metaDesc) setMetaDescription(metaDesc.slice(0, 160));
            }} />
        </div>

        <div>
          <label className={lbl}>URL slug</label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400 whitespace-nowrap shrink-0">travelasiargao.com/attractions/</span>
            <input className={input} value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="auto-generated from title" />
          </div>
        </div>

        {/* ── Meta description — separate from full description ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              Google meta description
            </label>
            <span className={`text-[10px] font-semibold ${metaDescription.length > 160 ? "text-red-500" : metaDescription.length > 140 ? "text-amber-500" : "text-green-600"}`}>
              {metaDescription.length}/160
            </span>
          </div>
          <textarea
            className={input + " resize-none"}
            rows={3}
            maxLength={160}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Short 1-2 sentence summary shown in Google search results. Max 160 characters. Hit 'Auto-generate SEO' to fill automatically."
          />
          <p className="text-[10px] text-slate-400 mt-1">
            This is what Google shows under your page title in search results. Keep it under 160 chars and make it enticing.
          </p>
        </div>

        <div>
          <label className={lbl}><div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> SEO keyword tags</div></label>
          <p className="text-[11px] text-slate-400 mb-2">3–6 phrases tourists search on Google. Hit "Auto-generate SEO" above to fill automatically.</p>
          <TagInput tags={form.seo_tags} onChange={(t) => set("seo_tags", t)} />
        </div>

        {/* Google preview uses meta_description now */}
        <SeoPreview title={form.title} metaDescription={metaDescription} slug={form.slug} />
      </div>

      {/* ── Actions ── */}
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
        <button type="button" onClick={handleSave} disabled={saving || !form.title}
          className="ml-auto flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-semibold text-white bg-[#085C52] rounded-xl hover:bg-[#0c7b93] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : item ? "Save changes" : "Add attraction"}
        </button>
      </div>
    </div>
  );
}

export function AttractionsAdminPage({ initialItems }: { initialItems: Attraction[] }) {
  const [tab,     setTab]     = useState<"attractions" | "ads">("attractions");
  const [items,   setItems]   = useState<Attraction[]>(initialItems);
  const [editing, setEditing] = useState<Attraction | null | "new">(null);
  const [search,  setSearch]  = useState("");

  const filtered = search.trim() ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase())) : items;

  async function handleSave(form: AttractionForm & { hero_position: string; photos: Photo[]; meta_description: string; description_html: string }) {
    const body = {
      ...(editing && editing !== "new" ? { id: (editing as Attraction).id } : {}),
      title:            form.title,
      slug:             form.slug,
      description:      form.description,
      description_html: form.description_html,
      meta_description: form.meta_description,
      image_url:        form.image_url      || null,
      sort_order:       form.sort_order,
      is_published:     form.is_published,
      category:         form.category,
      cover_gradient:   form.cover_gradient,
      cover_emoji:      form.cover_emoji,
      is_live:          form.is_live,
      is_featured:      form.is_featured,
      read_minutes:     form.read_minutes,
      seo_tags:         form.seo_tags,
      type:             form.type,
      hero_position:    form.hero_position,
      photos:           form.photos,
    };
    const res  = await fetch("/api/admin/attractions/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.id) {
      if (editing === "new") {
        setItems((prev) => [{ ...body, id: data.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Attraction, ...prev]);
      } else {
        setItems((prev) => prev.map((i) => i.id === data.id ? { ...i, ...body } as Attraction : i));
      }
      setEditing(null);
    } else { alert("Save failed — check the console."); }
  }

  async function handleDelete() {
    if (!editing || editing === "new") return;
    const res = await fetch("/api/admin/attractions/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: (editing as Attraction).id }) });
    if (res.ok) { setItems((prev) => prev.filter((i) => i.id !== (editing as Attraction).id)); setEditing(null); }
  }

  if (editing !== null) {
    return <AttractionFormPanel item={editing === "new" ? null : editing} onSave={handleSave} onDelete={editing !== "new" ? handleDelete : undefined} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Attractions & Ads</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{items.length} attractions · Explore & Discover page</p>
        </div>
        {tab === "attractions" && (
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#085C52] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0c7b93] transition-colors">
            <Plus className="w-4 h-4" /> Add attraction
          </button>
        )}
      </div>
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
        <button onClick={() => setTab("attractions")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab === "attractions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <MapPin className="w-4 h-4" /> Attractions
        </button>
        <button onClick={() => setTab("ads")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab === "ads" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Sparkles className="w-4 h-4" /> Ad slots
        </button>
      </div>
      {tab === "attractions" && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search attractions…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0c7b93] bg-white" />
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="py-12 text-center text-slate-400 text-[13px]">No attractions found.</div>}
            {filtered.map((item) => (
              <div key={item.id} onClick={() => setEditing(item)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] cursor-pointer transition-colors group">
                <div className={`w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#0c7b93]"} flex items-center justify-center text-lg`}>
                  {item.image_url ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /> : item.cover_emoji ?? "🌴"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title}</p>
                    {item.is_featured   && <span className="shrink-0 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                    {item.is_live       && <span className="shrink-0 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>}
                    {!item.is_published && <span className="shrink-0 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Draft</span>}
                  </div>
                  <p suppressHydrationWarning className="text-[11px] text-slate-400 capitalize">
                    {item.type} · {item.category ?? "–"} · {new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0c7b93] shrink-0" />
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "ads" && <AdsAdminPage initialAds={[]} />}
    </div>
  );
}
