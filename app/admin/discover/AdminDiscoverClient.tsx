"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type ItemType = "video" | "attraction" | "partner";

type PhotoRow = { id: string; url: string; storage_path: string; sort_order: number };

type DiscoverItem = {
  id: string;
  type: ItemType;
  title: string;
  tag: string;
  emoji: string;
  video_path: string | null;
  video_url:  string | null;
  href: string | null;
  is_featured: boolean;
  is_active:   boolean;
  sort_order:  number;
  created_at:  string;
  photos: PhotoRow[];
};

// Pending photo (not yet uploaded — local only)
type PendingPhoto = { file: File; previewUrl: string; id: string };

const TYPE_OPTIONS: { value: ItemType; label: string; defaultTag: string; icon: string }[] = [
  { value: "attraction", label: "Attraction",  defaultTag: "🗺️ Attraction", icon: "🗺️" },
  { value: "video",      label: "Video",       defaultTag: "📹 Video Tour",  icon: "📹" },
  { value: "partner",    label: "Partner Ad",  defaultTag: "🤝 Partner",    icon: "🤝" },
];

const EMPTY_FORM = {
  type:        "attraction" as ItemType,
  title:       "",
  tag:         "🗺️ Attraction",
  video_url:   "",
  href:        "",
  is_featured: false,
  is_active:   true,
  sort_order:  0,
};

const BUCKET   = "discover-media";
const MAX_PHOTOS = 6;
const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 100;

// ─── Multi-photo drop zone ────────────────────────────────────────────────────
function PhotoDropZone({
  pending,
  existing,
  onAdd,
  onRemovePending,
  onRemoveExisting,
  disabled,
}: {
  pending: PendingPhoto[];
  existing: PhotoRow[];
  onAdd: (files: File[]) => void;
  onRemovePending: (id: string) => void;
  onRemoveExisting: (id: string) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const total = pending.length + existing.length;
  const canAdd = total < MAX_PHOTOS;

  const processFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const images = arr.filter((f) => f.type.startsWith("image/"));
    const tooBig = images.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    if (tooBig.length) { alert(`Some files exceed ${MAX_IMAGE_MB}MB and were skipped.`); }
    const valid = images.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024);
    const slots = MAX_PHOTOS - total;
    onAdd(valid.slice(0, slots));
  }, [total, onAdd]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (!disabled && canAdd) processFiles(e.dataTransfer.files);
  };

  const allPhotos = [
    ...existing.map((p) => ({ key: p.id, url: p.url, isExisting: true, existingId: p.id, pendingId: "" })),
    ...pending.map((p)  => ({ key: p.id, url: p.previewUrl, isExisting: false, existingId: "", pendingId: p.id })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#134e4a]">
          Photos <span className="font-normal text-[#6B8886]">— up to {MAX_PHOTOS} photos · JPG, PNG, WebP · Max {MAX_IMAGE_MB}MB each</span>
        </label>
        <span className={`text-xs font-semibold ${total >= MAX_PHOTOS ? "text-red-500" : "text-[#6B8886]"}`}>
          {total}/{MAX_PHOTOS}
        </span>
      </div>

      {/* Photo grid */}
      {allPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {allPhotos.map((p, i) => (
            <div key={p.key} className="relative group aspect-square">
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover border-2 border-teal-200" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                  {allPhotos[0] ? "1st" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => p.isExisting ? onRemoveExisting(p.existingId) : onRemovePending(p.pendingId)}
                disabled={disabled}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-30"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAdd && (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-all select-none ${
            disabled ? "opacity-50 cursor-not-allowed" :
            dragging  ? "border-[#0c7b93] bg-[#0c7b93]/10 scale-[1.02]"
                      : "border-teal-300 bg-teal-50 hover:border-[#0c7b93] hover:bg-teal-100"
          }`}
        >
          <span className="text-2xl">📸</span>
          <div>
            <p className="text-sm font-semibold text-[#134e4a]">
              {dragging ? "Drop photos here!" : "Drag & drop or click to select"}
            </p>
            <p className="text-xs text-[#6B8886]">Select up to {MAX_PHOTOS - total} more photo{MAX_PHOTOS - total !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
      {!canAdd && (
        <p className="text-center text-xs font-medium text-amber-600">Maximum {MAX_PHOTOS} photos reached. Remove one to add another.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />
    </div>
  );
}

// ─── Video drop zone ──────────────────────────────────────────────────────────
function VideoDropZone({
  preview,
  onFile,
  onClear,
  uploading,
  progress,
}: {
  preview: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  uploading: boolean;
  progress: number;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-[#134e4a]">
        Video file <span className="font-normal text-[#6B8886]">— MP4, MOV, WebM · Max {MAX_VIDEO_MB}MB</span>
      </label>

      {preview && (
        <div className="relative inline-block">
          <video src={preview} className="h-32 w-52 rounded-xl object-cover border-2 border-teal-200" muted />
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60">
              <div className="h-2 w-36 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs font-bold text-white">{progress}%</p>
            </div>
          )}
          {!uploading && (
            <button type="button" onClick={onClear}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow hover:bg-red-600">✕</button>
          )}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-all select-none ${
          dragging ? "border-[#0c7b93] bg-[#0c7b93]/10 scale-[1.02]" : "border-teal-300 bg-teal-50 hover:border-[#0c7b93] hover:bg-teal-100"
        }`}
      >
        <span className="text-2xl">🎬</span>
        <div>
          <p className="text-sm font-semibold text-[#134e4a]">{dragging ? "Drop it here!" : preview ? "Replace video" : "Drag & drop or click to select"}</p>
          <p className="text-xs text-[#6B8886]">MP4, MOV, WebM · Max {MAX_VIDEO_MB}MB</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} className="hidden" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AdminDiscoverClient() {
  const supabase = createClient();

  const [items, setItems]             = useState<DiscoverItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [isPending, startTransition]  = useTransition();

  // Photos
  const [pendingPhotos, setPendingPhotos]   = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PhotoRow[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Video
  const [videoFile, setVideoFile]       = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress]   = useState(0);

  // ── Load ────────────────────────────────────────────────────────────────────
  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("discover_items")
      .select("*, photos:discover_item_photos(id, url, storage_path, sort_order)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setItems((data ?? []).map((i) => ({
      ...(i as DiscoverItem),
      photos: (((i as any).photos ?? []) as PhotoRow[]).sort((a: PhotoRow, b: PhotoRow) => a.sort_order - b.sort_order),
    })) as DiscoverItem[]);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function resetForm() {
    setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM });
    setPendingPhotos([]); setExistingPhotos([]); setRemovedPhotoIds([]);
    setVideoFile(null); setVideoPreview(null); setVideoProgress(0);
    setPhotoUploadStatus("");
  }

  // ── Add pending photos ──────────────────────────────────────────────────────
  function addPendingPhotos(files: File[]) {
    const newPhotos: PendingPhoto[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: `pending-${Date.now()}-${Math.random()}`,
    }));
    setPendingPhotos((prev) => [...prev, ...newPhotos]);
  }

  function removePendingPhoto(id: string) {
    setPendingPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function removeExistingPhoto(id: string) {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== id));
    setRemovedPhotoIds((prev) => [...prev, id]);
  }

  // ── Video file handler ──────────────────────────────────────────────────────
  function handleVideoFile(file: File) {
    if (!file.type.startsWith("video/")) { flash("Please select a video file.", true); return; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { flash(`Video must be under ${MAX_VIDEO_MB}MB.`, true); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  // ── Upload helpers ──────────────────────────────────────────────────────────
  async function uploadSingleFile(
    file: File, path: string,
    setUploading: (v: boolean) => void,
    setProgress: (v: number) => void
  ): Promise<{ path: string; url: string } | null> {
    setUploading(true); setProgress(0);
    let p = 0;
    const interval = setInterval(() => { p = Math.min(p + 12, 85); setProgress(p); }, 200);

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    clearInterval(interval); setProgress(100); setUploading(false);

    if (error) { flash(`Upload failed: ${error.message}`, true); setProgress(0); return null; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  const [photoUploadStatus, setPhotoUploadStatus] = useState<string>("");

  async function uploadPhotos(itemId: string): Promise<{ path: string; url: string }[]> {
    if (pendingPhotos.length === 0) return [];
    setUploadingPhotos(true);
    const results: { path: string; url: string }[] = [];

    for (let i = 0; i < pendingPhotos.length; i++) {
      const photo = pendingPhotos[i];
      setPhotoUploadStatus(`Uploading photo ${i + 1} of ${pendingPhotos.length}…`);
      const ext   = photo.file.name.split(".").pop() ?? "jpg";
      const path  = `${itemId}/photos/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, photo.file, { upsert: true, contentType: photo.file.type });
      if (!error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        results.push({ path, url: data.publicUrl });
      } else {
        console.error("Photo upload error:", error);
      }
    }
    setPhotoUploadStatus("");
    setUploadingPhotos(false);
    return results;
  }

  async function deleteStorageFile(path: string) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  // ── Open forms ──────────────────────────────────────────────────────────────
  function openAdd() {
    resetForm();
    setForm({ ...EMPTY_FORM, sort_order: items.length });
    setShowForm(true);
  }

  function openEdit(item: DiscoverItem) {
    setEditingId(item.id);
    setForm({ type: item.type, title: item.title, tag: item.tag, video_url: item.video_url ?? "", href: item.href ?? "", is_featured: item.is_featured, is_active: item.is_active, sort_order: item.sort_order });
    setPendingPhotos([]); setExistingPhotos([...item.photos]); setRemovedPhotoIds([]);
    setVideoFile(null); setVideoPreview(item.video_url ?? null); setVideoProgress(0);
    setShowForm(true);
  }

  function handleTypeChange(type: ItemType) {
    const opt = TYPE_OPTIONS.find((o) => o.value === type)!;
    setForm((f) => ({ ...f, type, tag: opt.defaultTag }));
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { flash("Title is required.", true); return; }
    if (!form.tag.trim())   { flash("Tag label is required.", true); return; }

    startTransition(async () => {
      const basePayload = {
        type: form.type, title: form.title.trim(), tag: form.tag.trim(), emoji: "📷",
        href: form.href.trim() || null, is_featured: form.is_featured,
        is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
        video_path: null as string | null, video_url: form.video_url.trim() || null,
      };

      let itemId = editingId;

      // Insert or update base item
      if (!itemId) {
        const { data: inserted, error } = await supabase.from("discover_items").insert(basePayload).select("id").single();
        if (error || !inserted) { flash(error?.message ?? "Failed to save. Check console for details.", true); console.error("Insert error:", error); return; }
        itemId = inserted.id;
      } else {
        const { error } = await supabase.from("discover_items").update(basePayload).eq("id", itemId);
        if (error) { flash(error.message, true); return; }
      }

      // Delete removed existing photos from DB + storage
      for (const photoId of removedPhotoIds) {
        const photo = existingPhotos.find((p) => p.id === photoId) ??
          items.find((i) => i.id === itemId)?.photos.find((p) => p.id === photoId);
        if (photo?.storage_path) await deleteStorageFile(photo.storage_path);
        await supabase.from("discover_item_photos").delete().eq("id", photoId);
      }

      // Upload new photos and insert rows
      if (pendingPhotos.length > 0) {
        const uploaded = await uploadPhotos(itemId!);
        const nextOrder = existingPhotos.length;
        const photoRows = uploaded.map((u, i) => ({
          item_id: itemId!, storage_path: u.path, url: u.url, sort_order: nextOrder + i,
        }));
        if (photoRows.length > 0) {
          const { error } = await supabase.from("discover_item_photos").insert(photoRows);
          if (error) flash(`Photos saved but DB insert failed: ${error.message}`, true);
        }
      }

      // Upload video file if selected
      if (videoFile) {
        const oldItem = items.find((i) => i.id === itemId);
        if (oldItem?.video_path) await deleteStorageFile(oldItem.video_path);
        const ext  = videoFile.name.split(".").pop() ?? "mp4";
        const path = `${itemId}/videos/${Date.now()}.${ext}`;
        const result = await uploadSingleFile(videoFile, path, setUploadingVideo, setVideoProgress);
        if (result) {
          await supabase.from("discover_items").update({ video_path: result.path, video_url: result.url }).eq("id", itemId);
        }
      }

      flash(editingId ? "Item updated ✓" : "Item added ✓");
      resetForm();
      await loadItems();
    });
  }

  // ── Toggles ─────────────────────────────────────────────────────────────────
  async function toggleActive(item: DiscoverItem) {
    const { error } = await supabase.from("discover_items").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash(item.is_active ? "Hidden from passengers" : "Now visible to passengers"); await loadItems(); }
  }

  async function toggleFeatured(item: DiscoverItem) {
    if (!item.is_featured) await supabase.from("discover_items").update({ is_featured: false }).neq("id", "none");
    const { error } = await supabase.from("discover_items").update({ is_featured: !item.is_featured }).eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash(item.is_featured ? "Removed from featured" : "Set as featured ✓"); await loadItems(); }
  }

  async function handleDelete(item: DiscoverItem) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    for (const photo of item.photos) await deleteStorageFile(photo.storage_path);
    if (item.video_path) await deleteStorageFile(item.video_path);
    const { error } = await supabase.from("discover_items").delete().eq("id", item.id);
    if (error) flash(error.message, true);
    else { flash("Item deleted"); await loadItems(); }
  }

  const typeBadge: Record<ItemType, string> = {
    video: "bg-blue-100 text-blue-800", attraction: "bg-teal-100 text-teal-800", partner: "bg-amber-100 text-amber-800",
  };
  const isSaving = isPending || uploadingPhotos || uploadingVideo;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Content</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">🌊 Discover Siargao</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Add up to 6 photos per item. Passengers can swipe through them in a gallery modal. Videos get a thumbnail from your photos plus an optional video file or link.
        </p>
      </div>

      <div className="mt-5">
        <a href="/admin" className="text-sm font-semibold text-[#0c7b93] hover:underline">← Back to admin dashboard</a>
      </div>

      {error   && <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">⚠️ {error}</div>}
      {success && <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✅ {success}</div>}

      {/* Add button */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#134e4a]">Content items ({items.length})</h2>
          <p className="text-sm text-[#0f766e]/80">
            {items.filter((i) => i.is_active).length} visible · {items.filter((i) => !i.is_active).length} hidden
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e]">
          + Add item
        </button>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mt-5 rounded-2xl border-2 border-[#0c7b93] bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-base font-bold text-[#134e4a]">{editingId ? "✏️ Edit item" : "➕ Add new item"}</h3>

          <div className="grid gap-5 sm:grid-cols-2">

            {/* Type card selector */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">Type * <span className="font-normal text-[#6B8886]">— what are you adding?</span></label>
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => handleTypeChange(o.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                      form.type === o.value
                        ? "border-[#0c7b93] bg-[#0c7b93] text-white shadow-md scale-[1.03]"
                        : "border-teal-200 bg-white text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50"
                    }`}>
                    <span className="text-2xl">{o.icon}</span>
                    <span className="text-xs">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Cloud 9 Surfing Beach, Kermit Restaurant, Sugba Lagoon"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
            </div>

            {/* Tag */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">Tag label * <span className="font-normal text-[#6B8886]">(shown on card)</span></label>
              <input type="text" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="e.g. 🍽️ Restaurant, 🏄 Surf Spot"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
            </div>

            {/* Sort order */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">Sort order <span className="font-normal text-[#6B8886]">(lower = shown first)</span></label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
            </div>

            {/* Link */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">Link URL <span className="font-normal text-[#6B8886]">(optional — where card or "Learn more" button goes)</span></label>
              <input type="text" value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="/attractions or https://facebook.com/yourbusiness"
                className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
            </div>

            {/* ── PHOTOS — all types ── */}
            <div className="sm:col-span-2">
              <PhotoDropZone
                pending={pendingPhotos}
                existing={existingPhotos}
                onAdd={addPendingPhotos}
                onRemovePending={removePendingPhoto}
                onRemoveExisting={removeExistingPhoto}
                disabled={isSaving}
              />
              <p className="mt-1.5 text-xs text-[#6B8886]">
                💡 First photo is used as the card thumbnail and video poster image if you add a video.
              </p>
            </div>

            {/* ── VIDEO — available for all types ── */}
            <div className="sm:col-span-2 space-y-3 rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">📹 Video <span className="font-normal normal-case tracking-normal text-blue-600">(optional — upload a clip or paste a link)</span></p>
              <VideoDropZone
                preview={videoPreview}
                onFile={handleVideoFile}
                onClear={() => { setVideoFile(null); setVideoPreview(null); }}
                uploading={uploadingVideo}
                progress={videoProgress}
              />
              {!videoFile && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#134e4a]">
                    Or paste a video URL <span className="font-normal text-[#6B8886]">(YouTube, Facebook, TikTok)</span>
                  </label>
                  <input type="text" value={form.video_url}
                    onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=... or https://fb.watch/..."
                    className="w-full rounded-xl border-2 border-teal-200 px-3 py-2.5 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none" />
                  <p className="mt-1 text-xs text-[#6B8886]">Optional for all types. Passengers watch it in the modal. Upload a file OR paste a link.</p>
                </div>
              )}
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#134e4a]">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-teal-300 accent-[#0c7b93]" />
                👁 Visible to passengers
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#134e4a]">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                  className="h-4 w-4 rounded border-teal-300 accent-[#0c7b93]" />
                ✨ Featured (shown large — only one at a time)
              </label>
            </div>
          </div>

          {/* Upload status */}
          {(uploadingPhotos || uploadingVideo || isPending) && (
            <div className="mt-4 rounded-xl border-2 border-teal-200 bg-teal-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0c7b93] border-t-transparent" />
                <p className="text-sm font-medium text-[#0c7b93]">
                  {uploadingPhotos ? photoUploadStatus || "📸 Uploading photos…"
                    : uploadingVideo ? "🎬 Uploading video…"
                    : "💾 Saving…"}
                </p>
              </div>
              <p className="mt-1 text-xs text-[#6B8886]">Please wait, do not close this page.</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0c7b93] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f766e] disabled:opacity-60">
              {isSaving ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </button>
            <button type="button" onClick={resetForm} disabled={isSaving}
              className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] transition-colors hover:bg-teal-50 disabled:opacity-50">
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
          <p className="text-3xl">🌊</p>
          <p className="mt-2 font-semibold text-[#134e4a]">No content yet</p>
          <p className="mt-1 text-sm text-[#0f766e]/80">Add your first item above. The Discover section is hidden from passengers until you add at least one active item.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id}
              className={`rounded-xl border-2 bg-white p-4 shadow-sm transition-all ${item.is_active ? "border-teal-200" : "border-gray-200 opacity-60"}`}>
              <div className="flex flex-wrap items-start gap-4">

                {/* Photo strip */}
                <div className="flex shrink-0 gap-1.5">
                  {item.photos.length > 0 ? (
                    item.photos.slice(0, 3).map((photo, i) => (
                      <div key={photo.id} className="relative">
                        <img src={photo.url} alt="" className={`rounded-lg object-cover border border-teal-100 shadow-sm ${i === 0 ? "h-16 w-20" : "h-16 w-12 opacity-70"}`} />
                        {i === 0 && item.type === "video" && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[10px] shadow">▶</span>
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-[#E6F4F2] text-2xl border border-teal-100">
                      {item.type === "video" ? "🎬" : item.type === "attraction" ? "🏝️" : "🏪"}
                    </div>
                  )}
                  {item.photos.length > 3 && (
                    <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-teal-50 border border-teal-100 text-xs font-bold text-[#0c7b93]">
                      +{item.photos.length - 3}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#134e4a]">{item.title}</span>
                    {item.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">✨ Featured</span>}
                    {!item.is_active  && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Hidden</span>}
                    {item.photos.length === 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">⚠ No photos</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B8886]">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${typeBadge[item.type]}`}>{item.type}</span>
                    <span>{item.tag}</span>
                    <span>📸 {item.photos.length} photo{item.photos.length !== 1 ? "s" : ""}</span>
                    {item.video_url && <span className="text-blue-600">🎬 {item.video_path ? "Video uploaded" : "Video linked"}</span>}
                    {item.href      && <span className="truncate max-w-[160px]">🔗 {item.href}</span>}
                    <span>Order: {item.sort_order}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button type="button" onClick={() => toggleFeatured(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${item.is_featured ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "border border-gray-200 bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-800"}`}>
                    ✨ {item.is_featured ? "Unfeature" : "Feature"}
                  </button>
                  <button type="button" onClick={() => toggleActive(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${item.is_active ? "bg-teal-100 text-teal-800 hover:bg-teal-200" : "border border-gray-200 bg-white text-gray-500 hover:bg-teal-50 hover:text-teal-800"}`}>
                    {item.is_active ? "👁 Visible" : "🙈 Hidden"}
                  </button>
                  <button type="button" onClick={() => openEdit(item)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#134e4a] transition-colors hover:bg-teal-50">
                    ✏️ Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(item)}
                    className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50">
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
