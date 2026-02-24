"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type ItemType = "video" | "attraction" | "partner";

type DiscoverItem = {
  id: string;
  type: ItemType;
  title: string;
  tag: string;
  emoji: string;
  href: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const TYPE_OPTIONS: { value: ItemType; label: string; defaultTag: string; defaultEmoji: string }[] = [
  { value: "video",      label: "📹 Video",      defaultTag: "📹 Video Tour",  defaultEmoji: "🎬" },
  { value: "attraction", label: "🗺️ Attraction", defaultTag: "🗺️ Attraction", defaultEmoji: "🏝️" },
  { value: "partner",    label: "🤝 Partner Ad", defaultTag: "🤝 Partner",    defaultEmoji: "🏪" },
];

const EMPTY_FORM = {
  type: "attraction" as ItemType,
  title: "",
  tag: "🗺️ Attraction",
  emoji: "🏝️",
  href: "",
  is_featured: false,
  is_active: true,
  sort_order: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AdminDiscoverClient() {
  const supabase = createClient();

  const [items, setItems]         = useState<DiscoverItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [isPending, startTransition] = useTransition();

  // ── Load items ──────────────────────────────────────────────────────────────
  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("discover_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setItems((data ?? []) as DiscoverItem[]);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  // ── Open add form ───────────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: items.length });
    setShowForm(true);
  }

  // ── Open edit form ──────────────────────────────────────────────────────────
  function openEdit(item: DiscoverItem) {
    setEditingId(item.id);
    setForm({
      type:        item.type,
      title:       item.title,
      tag:         item.tag,
      emoji:       item.emoji,
      href:        item.href ?? "",
      is_featured: item.is_featured,
      is_active:   item.is_active,
      sort_order:  item.sort_order,
    });
    setShowForm(true);
  }

  // ── Handle type change — auto-fill tag & emoji ──────────────────────────────
  function handleTypeChange(type: ItemType) {
    const opt = TYPE_OPTIONS.find((o) => o.value === type)!;
    setForm((f) => ({ ...f, type, tag: opt.defaultTag, emoji: opt.defaultEmoji }));
  }

  // ── Save (insert or update) ─────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { flash("Title is required.", true); return; }
    if (!form.tag.trim())   { flash("Tag is required.", true); return; }
    if (!form.emoji.trim()) { flash("Emoji is required.", true); return; }

    startTransition(async () => {
      const payload = {
        type:        form.type,
        title:       form.title.trim(),
        tag:         form.tag.trim(),
        emoji:       form.emoji.trim(),
        href:        form.href.trim() || null,
        is_featured: form.is_featured,
        is_active:   form.is_active,
        sort_order:  Number(form.sort_order) || 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from("discover_items")
          .update(payload)
          .eq("id", editingId);
        if (error) { flash(error.message, true); return; }
        flash("Item updated ✓");
      } else {
        const { error } = await supabase
          .from("discover_items")
          .insert(payload);
        if (error) { flash(error.message, true); return; }
        flash("Item added ✓");
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      await loadItems();
    });
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  async function toggleActive(item: DiscoverItem) {
    const { error } = await supabase
      .from("discover_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash(item.is_active ? "Hidden from passengers" : "Now visible to passengers"); await loadItems(); }
  }

  // ── Toggle featured ─────────────────────────────────────────────────────────
  async function toggleFeatured(item: DiscoverItem) {
    // Unfeatured all first, then set this one
    if (!item.is_featured) {
      await supabase.from("discover_items").update({ is_featured: false }).neq("id", "none");
    }
    const { error } = await supabase
      .from("discover_items")
      .update({ is_featured: !item.is_featured })
      .eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash(item.is_featured ? "Removed from featured" : "Set as featured ✓"); await loadItems(); }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(item: DiscoverItem) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("discover_items").delete().eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash("Item deleted"); await loadItems(); }
  }

  // ── Badge helpers ───────────────────────────────────────────────────────────
  const typeBadge: Record<ItemType, string> = {
    video:      "bg-blue-100 text-blue-800",
    attraction: "bg-teal-100 text-teal-800",
    partner:    "bg-amber-100 text-amber-800",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Page header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Content</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">🌊 Discover Siargao</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage content shown to passengers on their dashboard. Add videos, attractions, and partner ads. The section is hidden from passengers until you add at least one active item.
        </p>
      </div>

      {/* Back link */}
      <div className="mt-5">
        <a href="/admin" className="text-sm font-semibold text-[#0c7b93] hover:underline">← Back to admin dashboard</a>
      </div>

      {/* Toasts */}
      {error   && <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div>}
      {success && <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>}

      {/* Add button */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#134e4a]">Content items ({items.length})</h2>
          <p className="text-sm text-[#0f766e]/80">
            {items.filter((i) => i.is_active).length} visible to passengers ·{" "}
            {items.filter((i) => !i.is_active).length} hidden
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]"
        >
          + Add item
        </button>
      </div>

      {/* ── Add / Edit Form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mt-5 rounded-2xl border-2 border-[#0c7b93] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-[#134e4a]">
            {editingId ? "✏️ Edit item" : "➕ Add new item"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Type *</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value as ItemType)}
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Emoji */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Emoji * <span className="font-normal text-[#6B8886]">(shown as thumbnail)</span></label>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="🏝️"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              />
            </div>

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Cloud 9 — World-Class Surfing"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              />
            </div>

            {/* Tag */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Tag label * <span className="font-normal text-[#6B8886]">(shown under title)</span></label>
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="e.g. 📹 Video Tour"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              />
            </div>

            {/* Sort order */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Sort order <span className="font-normal text-[#6B8886]">(lower = shown first)</span></label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              />
            </div>

            {/* Link */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#134e4a]">Link URL <span className="font-normal text-[#6B8886]">(optional — where card clicks go)</span></label>
              <input
                type="text"
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="e.g. /attractions or https://youtube.com/..."
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none"
              />
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#134e4a]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-teal-300 accent-[#0c7b93]"
                />
                Visible to passengers
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#134e4a]">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                  className="h-4 w-4 rounded border-teal-300 accent-[#0c7b93]"
                />
                ✨ Featured (shown large, only one at a time)
              </label>
            </div>
          </div>

          {/* Form actions */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0c7b93] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] disabled:opacity-60"
            >
              {isPending ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] transition-colors hover:bg-teal-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Items list ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="mt-6 rounded-xl border border-teal-100 bg-white p-8 text-center text-sm text-[#0f766e]">Loading…</div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-teal-200 bg-white p-10 text-center">
          <p className="text-2xl">🌊</p>
          <p className="mt-2 font-semibold text-[#134e4a]">No content yet</p>
          <p className="mt-1 text-sm text-[#0f766e]/80">
            Add your first item above. The Discover section will be hidden from passengers until you add at least one active item.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border-2 bg-white p-4 shadow-sm transition-all ${
                item.is_active ? "border-teal-200" : "border-gray-200 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                {/* Emoji preview */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F2] text-2xl">
                  {item.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#134e4a]">{item.title}</span>
                    {item.is_featured && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">✨ Featured</span>
                    )}
                    {!item.is_active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Hidden</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#6B8886]">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${typeBadge[item.type]}`}>{item.type}</span>
                    <span>{item.tag}</span>
                    {item.href && <span className="truncate max-w-[200px]">🔗 {item.href}</span>}
                    <span>Order: {item.sort_order}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFeatured(item)}
                    title={item.is_featured ? "Remove featured" : "Set as featured"}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      item.is_featured
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        : "border border-gray-200 bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-800"
                    }`}
                  >
                    ✨ {item.is_featured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      item.is_active
                        ? "bg-teal-100 text-teal-800 hover:bg-teal-200"
                        : "border border-gray-200 bg-white text-gray-500 hover:bg-teal-50 hover:text-teal-800"
                    }`}
                  >
                    {item.is_active ? "👁 Visible" : "🙈 Hidden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#134e4a] transition-colors hover:bg-teal-50"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
