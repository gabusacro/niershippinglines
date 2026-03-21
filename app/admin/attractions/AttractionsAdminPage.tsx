"use client";

import { useState, useRef, useCallback } from "react";
import type { Attraction, AttractionForm } from "@/lib/attractions/types";
import { EMPTY_FORM, GRADIENTS, CATEGORIES } from "@/lib/attractions/types";

// ─── Slug helper ──────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
}

// ─── SEO live preview ─────────────────────────────────────────────────────────
function SeoPreview({ title, description, slug }: { title: string; description: string; slug: string }) {
  const url     = `travelasiargao.com/attractions/${slug || slugify(title) || "attraction-name"}`;
  const metaTitle = title ? `${title} — Siargao Island | Travela Siargao` : "Title | Travela Siargao";
  const metaDesc  = description || "Discover the best of Siargao Island.";
  const titleOk   = metaTitle.length <= 65;
  const descOk    = metaDesc.length <= 160;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Google preview</p>
      <p className="text-[11px] text-green-700 mb-0.5 font-medium truncate">{url}</p>
      <p className={`text-[16px] font-medium mb-1 truncate ${titleOk ? "text-blue-700" : "text-red-600"}`}>{metaTitle}</p>
      <p className={`text-[13px] leading-relaxed ${descOk ? "text-slate-600" : "text-red-500"}`}>{metaDesc.slice(0, 160)}{metaDesc.length > 160 ? "…" : ""}</p>
      <div className="flex gap-4 mt-2 text-[10px]">
        <span className={titleOk ? "text-green-600" : "text-red-500"}>Title: {metaTitle.length}/65</span>
        <span className={descOk  ? "text-green-600" : "text-red-500"}>Desc: {metaDesc.length}/160</span>
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
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. siargao tourist spots 2026"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93]"
        />
        <button type="button" onClick={add} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-medium hover:bg-slate-200 transition-colors">Add</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              {tag}
              <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-[#085041]/50 hover:text-[#085041] ml-0.5 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Photo upload ─────────────────────────────────────────────────────────────
function PhotoUpload({
  imageUrl, imageAlt, title, category,
  onDone,
}: {
  imageUrl: string; imageAlt: string; title: string; category: string;
  onDone: (url: string, alt: string, tags: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state,  setState]  = useState<"idle" | "uploading" | "ai" | "done" | "error">("idle");
  const [info,   setInfo]   = useState<{ kb_before: number; kb_after: number; saved: number } | null>(null);
  const [aiAlt,  setAiAlt]  = useState(imageAlt);

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setState("uploading");
    try {
      const fd = new FormData();
      fd.append("file",     file);
      fd.append("title",    title || "siargao attraction");
      fd.append("category", category || "attraction");
      setState("ai");
      const res  = await fetch("/api/admin/upload-attraction", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) { setState("error"); return; }
      setInfo({ kb_before: data.compression.original_kb, kb_after: data.compression.compressed_kb, saved: data.compression.saved_percent });
      setAiAlt(data.alt);
      setState("done");
      onDone(data.url, data.alt, data.tags ?? []);
    } catch { setState("error"); }
  }, [title, category, onDone]);

  const stateLabel: Record<string, string> = {
    uploading: "Compressing to WebP…",
    ai:        "AI generating alt text…",
    done:      "Done!",
    error:     "Failed — try again",
  };
  const stateColor: Record<string, string> = {
    uploading: "text-blue-600", ai: "text-purple-600", done: "text-green-700", error: "text-red-600",
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />

      {imageUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-3">
          <img src={imageUrl} alt={aiAlt} className="w-full h-48 object-cover" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 text-white text-[11px] font-medium rounded-lg hover:bg-black/80 transition-colors"
          >
            Replace photo
          </button>
          {info && (
            <div className="absolute top-2 left-2 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              WebP · {info.saved}% smaller
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#0c7b93] hover:bg-slate-50 transition-all mb-3"
        >
          <svg className="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-[13px] font-medium text-slate-600">Drop photo or click to upload</p>
          <p className="text-[11px] text-slate-400 mt-1">Auto-converted to WebP · AI alt text generated</p>
        </div>
      )}

      {state !== "idle" && (
        <div className={`flex items-center gap-2 text-[12px] font-medium ${stateColor[state] ?? "text-slate-500"}`}>
          {state !== "done" && state !== "error" && (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {state === "done"  && <span>✓</span>}
          {state === "error" && <span>✕</span>}
          {stateLabel[state]}
          {state === "done" && info && (
            <span className="text-slate-400 font-normal ml-1">({info.kb_before}KB → {info.kb_after}KB)</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit / Add form ──────────────────────────────────────────────────────────
function AttractionForm({
  item, onSave, onDelete, onCancel,
}: {
  item?: Attraction | null;
  onSave: (f: AttractionForm) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form,    setForm]    = useState<AttractionForm>(
    item ? {
      title:          item.title,
      slug:           item.slug,
      description:    item.description  ?? "",
      image_url:      item.image_url    ?? "",
      image_alt:      "",
      category:       (item.category    ?? "attractions") as AttractionForm["category"],
      cover_gradient: item.cover_gradient ?? GRADIENTS[0].value,
      cover_emoji:    item.cover_emoji  ?? "🌴",
      is_live:        item.is_live,
      is_featured:    item.is_featured,
      is_published:   item.is_published,
      read_minutes:   item.read_minutes ?? 2,
      seo_tags:       item.seo_tags     ?? [],
      type:           item.type         ?? "attraction",
      sort_order:     item.sort_order   ?? 0,
    } : EMPTY_FORM
  );
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof AttractionForm>(k: K, v: AttractionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleUploadDone(url: string, alt: string, tags: string[]) {
    set("image_url",  url);
    set("image_alt",  alt);
    const merged = Array.from(new Set([...form.seo_tags, ...tags]));
    set("seo_tags", merged);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this attraction? This cannot be undone.")) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const input  = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors";
  const label  = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const card   = "rounded-2xl border border-slate-100 bg-white p-5 space-y-4";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">{item ? "Edit attraction" : "Add attraction"}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Shows on the public Explore & Discover page.</p>
        </div>
        <button onClick={onCancel} className="text-[13px] text-slate-400 hover:text-slate-600">← Back</button>
      </div>

      {/* Content */}
      <div className={card}>
        <h2 className="text-[14px] font-semibold text-slate-700">Content</h2>
        <div>
          <label className={label}>Title *</label>
          <input className={input} value={form.title}
            onChange={(e) => { set("title", e.target.value); if (!item) set("slug", slugify(e.target.value)); }}
            placeholder="e.g. Cloud 9 Surf Break" />
        </div>
        <div>
          <label className={label}>Description (shown on card + Google)</label>
          <textarea className={input + " resize-none"} rows={4} value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="2–3 sentences describing this attraction for visitors and Google." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Type</label>
            <select className={input} value={form.type} onChange={(e) => set("type", e.target.value as AttractionForm["type"])}>
              <option value="attraction">Attraction / place</option>
              <option value="news">News / story</option>
              <option value="video">Video</option>
              <option value="tip">Travel tip</option>
              <option value="partner">Partner / sponsored</option>
            </select>
          </div>
          <div>
            <label className={label}>Category</label>
            <select className={input} value={form.category} onChange={(e) => set("category", e.target.value as AttractionForm["category"])}>
              {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Read time (minutes)</label>
            <input type="number" min={1} max={30} className={input} value={form.read_minutes} onChange={(e) => set("read_minutes", Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Emoji fallback</label>
            <input className={input} value={form.cover_emoji} onChange={(e) => set("cover_emoji", e.target.value)} placeholder="🌴" />
          </div>
        </div>
        <div>
          <label className={label}>Gradient (shown if no photo)</label>
          <div className="grid grid-cols-7 gap-2">
            {GRADIENTS.map((g) => (
              <button key={g.value} type="button" onClick={() => set("cover_gradient", g.value)}
                className={`h-9 rounded-lg bg-gradient-to-br ${g.value} transition-all ${form.cover_gradient === g.value ? "ring-2 ring-[#0c7b93] ring-offset-1" : "opacity-60 hover:opacity-100"}`}
                title={g.label} />
            ))}
          </div>
        </div>
        {/* Toggles */}
        <div className="flex gap-6">
          {(["is_featured", "is_live", "is_published"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form[key] ? "bg-[#085C52]" : "bg-slate-200"}`}
                onClick={() => set(key, !form[key])}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[key] ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-[13px] text-slate-600 capitalize">{key.replace("is_", "")}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div className={card}>
        <h2 className="text-[14px] font-semibold text-slate-700">Photo</h2>
        <PhotoUpload
          imageUrl={form.image_url} imageAlt={form.image_alt}
          title={form.title} category={form.category}
          onDone={handleUploadDone}
        />
      </div>

      {/* SEO */}
      <div className={card}>
        <h2 className="text-[14px] font-semibold text-slate-700">SEO</h2>
        <div>
          <label className={label}>URL slug</label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400 whitespace-nowrap">travelasiargao.com/attractions/</span>
            <input className={input} value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="auto-generated from title" />
          </div>
        </div>
        <div>
          <label className={label}>SEO keyword tags</label>
          <p className="text-[11px] text-slate-400 mb-2">3–6 phrases tourists would search on Google.</p>
          <TagInput tags={form.seo_tags} onChange={(t) => set("seo_tags", t)} />
        </div>
        <SeoPreview title={form.title} description={form.description} slug={form.slug} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {item && onDelete && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="px-4 py-2.5 text-[13px] font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-[13px] font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !form.title}
          className="ml-auto px-6 py-2.5 text-[13px] font-semibold text-white bg-[#085C52] rounded-xl hover:bg-[#0c7b93] disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : item ? "Save changes" : "Add attraction"}
        </button>
      </div>
    </div>
  );
}

// ─── Admin list view ──────────────────────────────────────────────────────────
export function AttractionsAdminPage({ initialItems }: { initialItems: Attraction[] }) {
  const [items,   setItems]   = useState<Attraction[]>(initialItems);
  const [editing, setEditing] = useState<Attraction | null | "new">(null);
  const [search,  setSearch]  = useState("");

  const filtered = search.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  async function handleSave(form: AttractionForm) {
    const body = {
      ...(editing && editing !== "new" ? { id: (editing as Attraction).id } : {}),
      title: form.title, slug: form.slug, description: form.description,
      image_url: form.image_url || null, sort_order: form.sort_order,
      is_published: form.is_published, category: form.category,
      cover_gradient: form.cover_gradient, cover_emoji: form.cover_emoji,
      is_live: form.is_live, is_featured: form.is_featured,
      read_minutes: form.read_minutes, seo_tags: form.seo_tags, type: form.type,
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
    return <AttractionForm item={editing === "new" ? null : editing} onSave={handleSave} onDelete={editing !== "new" ? handleDelete : undefined} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Explore & Discover</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{items.length} attractions</p>
        </div>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#085C52] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0c7b93] transition-colors">
          + Add attraction
        </button>
      </div>
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search attractions…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0c7b93] bg-white" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="py-12 text-center text-slate-400 text-[13px]">No attractions found.</div>}
        {filtered.map((item) => (
          <div key={item.id} onClick={() => setEditing(item)}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] cursor-pointer transition-colors group">
            <div className={`w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br ${item.cover_gradient ?? "from-[#085C52] to-[#0c7b93]"} flex items-center justify-center text-lg`}>
              {item.image_url
                ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                : item.cover_emoji ?? "🌴"
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title}</p>
                {item.is_featured && <span className="shrink-0 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                {item.is_live    && <span className="shrink-0 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>}
                {!item.is_published && <span className="shrink-0 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Draft</span>}
              </div>
              <p className="text-[11px] text-slate-400 capitalize">
                {item.type} · {item.category ?? "–"} · {new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
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
