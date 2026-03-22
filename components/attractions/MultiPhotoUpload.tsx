"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Check, ImageIcon, Link, Instagram, Facebook } from "lucide-react";

export type Photo = {
  url:          string;
  alt:          string;
  credit_name?: string;   // e.g. "@juandelacruz"
  credit_url?:  string;   // e.g. "https://instagram.com/juandelacruz"
  credit_type?: "instagram" | "facebook" | "other";
};

export function MultiPhotoUpload({
  photos,
  title,
  category,
  onChange,
}: {
  photos:   Photo[];
  title:    string;
  category: string;
  onChange: (photos: Photo[]) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [errors,    setErrors]    = useState<Record<number, string>>({});
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const MAX  = 3;
  const slots = Array.from({ length: MAX }, (_, i) => photos[i] ?? null);

  async function handleUpload(slotIndex: number, file: File) {
    setUploading(slotIndex);
    setErrors((e) => ({ ...e, [slotIndex]: "" }));
    try {
      const fd = new FormData();
      fd.append("file",     file);
      fd.append("title",    title    || "siargao attraction");
      fd.append("category", category || "attraction");
      const res  = await fetch("/api/admin/upload-attraction", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) { setErrors((e) => ({ ...e, [slotIndex]: data.error ?? "Upload failed" })); return; }
      const next = [...photos];
      next[slotIndex] = { url: data.url, alt: data.alt ?? "", credit_name: "", credit_url: "", credit_type: "instagram" };
      onChange(next.filter(Boolean) as Photo[]);
    } catch {
      setErrors((e) => ({ ...e, [slotIndex]: "Network error — try again" }));
    } finally { setUploading(null); }
  }

  function updatePhoto(i: number, patch: Partial<Photo>) {
    const next = [...photos];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function removePhoto(i: number) {
    onChange(photos.filter((_, idx) => idx !== i));
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  const input = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Photos (up to 3)
        </p>
        <p style={{ fontSize: 11, color: "#9CA3AF" }}>
          {photos.length}/3 · First photo = hero
        </p>
      </div>

      {/* ── Photo slots ── */}
      <div className="grid grid-cols-3 gap-3">
        {slots.map((photo, i) => (
          <div key={i}>
            <input ref={inputRefs[i]} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(i, e.target.files[0])} />

            {photo ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 group" style={{ aspectRatio: "4/3" }}>
                <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <button type="button" onClick={() => inputRefs[i].current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-[11px] font-semibold rounded-lg hover:bg-white/30 transition-colors">
                    <Upload className="w-3 h-3" /> Replace
                  </button>
                  <button type="button" onClick={() => removePhoto(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 text-white text-[11px] font-semibold rounded-lg hover:bg-red-500 transition-colors">
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
                <div className="absolute top-1.5 left-1.5">
                  <span style={{
                    background: i === 0 ? "#085C52" : "rgba(0,0,0,0.5)", color: "white",
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {i === 0 ? "Hero" : `Photo ${i + 1}`}
                  </span>
                </div>
                {photo.credit_name && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <span style={{ background: "rgba(0,0,0,0.55)", color: "white", fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 6, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📸 {photo.credit_name}
                    </span>
                  </div>
                )}
                {photos.length > 1 && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {i > 0 && (
                      <button type="button" onClick={() => movePhoto(i, i - 1)}
                        className="w-5 h-5 bg-white/20 text-white rounded text-[10px] hover:bg-white/40 flex items-center justify-center">←</button>
                    )}
                    {i < photos.length - 1 && (
                      <button type="button" onClick={() => movePhoto(i, i + 1)}
                        className="w-5 h-5 bg-white/20 text-white rounded text-[10px] hover:bg-white/40 flex items-center justify-center">→</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button type="button"
                onClick={() => i <= photos.length && inputRefs[i].current?.click()}
                disabled={uploading !== null || i > photos.length}
                className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all hover:border-[#0c7b93] hover:bg-slate-50"
                style={{ aspectRatio: "4/3", borderColor: i > photos.length ? "#F1F5F9" : "#E2E8F0", background: "#FAFAFA", cursor: i > photos.length ? "not-allowed" : "pointer", opacity: i > photos.length ? 0.5 : 1 }}>
                {uploading === i ? (
                  <><Loader2 className="w-5 h-5 text-[#0c7b93] animate-spin mb-1" /><span style={{ fontSize: 10, color: "#0c7b93", fontWeight: 600 }}>Uploading…</span></>
                ) : (
                  <><ImageIcon className="w-5 h-5 text-slate-300 mb-1" /><span style={{ fontSize: 10, color: i > photos.length ? "#CBD5E1" : "#94A3B8", fontWeight: 500 }}>
                    {i === 0 ? "Add hero photo" : i > photos.length ? `Add photo ${i} first` : `Add photo ${i + 1}`}
                  </span></>
                )}
              </button>
            )}
            {errors[i] && <p style={{ fontSize: 10, color: "#EF4444", marginTop: 4 }}>{errors[i]}</p>}
          </div>
        ))}
      </div>

      {/* ── Per-photo details: alt text + photo credit ── */}
      {photos.length > 0 && (
        <div className="space-y-3 pt-1">
          {photos.map((photo, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <p style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {i === 0 ? "Hero photo" : `Photo ${i + 1}`}
              </p>

              {/* Alt text */}
              <div>
                <label style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 3 }}>
                  Alt text (SEO)
                </label>
                <input value={photo.alt}
                  onChange={(e) => updatePhoto(i, { alt: e.target.value })}
                  placeholder="Describe the photo for Google…"
                  className={input} />
              </div>

              {/* Photo credit */}
              <div>
                <label style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 3 }}>
                  Photo credit (optional — if borrowed from social media)
                </label>
                <div className="flex gap-2">
                  {/* Credit type */}
                  <select
                    value={photo.credit_type ?? "instagram"}
                    onChange={(e) => updatePhoto(i, { credit_type: e.target.value as Photo["credit_type"] })}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]"
                    style={{ minWidth: 100 }}
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="other">Other</option>
                  </select>
                  {/* Credit name */}
                  <input value={photo.credit_name ?? ""}
                    onChange={(e) => updatePhoto(i, { credit_name: e.target.value })}
                    placeholder="@username or Full Name"
                    className={input} />
                </div>
              </div>

              {/* Credit URL */}
              {photo.credit_name && (
                <div>
                  <label style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 3 }}>
                    Link to their profile / post
                  </label>
                  <input value={photo.credit_url ?? ""}
                    onChange={(e) => updatePhoto(i, { credit_url: e.target.value })}
                    placeholder="https://instagram.com/username"
                    className={input} />
                  <p style={{ fontSize: 9, color: "#9CA3AF", marginTop: 3 }}>
                    Will show as "📸 Photo by @username" with a clickable link on the public page.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.5 }}>
        💡 First photo = hero banner. Use ← → to reorder. All photos auto-compressed to WebP.
      </p>
    </div>
  );
}
