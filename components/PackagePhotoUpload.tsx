"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  packageId: string;
  currentCoverUrl: string | null;
  currentGalleryUrls: string[];
  onUpdate: (coverUrl: string | null, galleryUrls: string[]) => void;
}

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 900;
const QUALITY = 0.82;
const MAX_GALLERY = 6;

async function compressToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Maintain aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Compression failed")),
        "image/webp",
        QUALITY,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PackagePhotoUpload({
  packageId, currentCoverUrl, currentGalleryUrls, onUpdate,
}: Props) {
  const [coverUrl, setCoverUrl] = useState<string | null>(currentCoverUrl);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(currentGalleryUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const coverInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function uploadFile(blob: Blob, path: string): Promise<string> {
    const { error } = await supabase.storage
      .from("tour-photos")
      .upload(path, blob, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("tour-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }

    setUploading(true); setError("");
    try {
      setProgress(`Compressing ${file.name}...`);
      const originalSize = file.size;
      const blob = await compressToWebP(file);
      const saving = Math.round((1 - blob.size / originalSize) * 100);
      setProgress(`Uploading... (${formatBytes(blob.size)}, ${saving}% smaller)`);

      const path = `packages/${packageId}/cover.webp`;
      const url  = await uploadFile(blob, path);

      // Save to DB
      const res = await fetch(`/api/admin/tours/packages/${packageId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_image_url: url }),
      });
      if (!res.ok) throw new Error("Failed to save");

      setCoverUrl(url);
      onUpdate(url, galleryUrls);
      setProgress(`✅ Cover uploaded! Saved ${saving}% file size.`);
      setTimeout(() => setProgress(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_GALLERY - galleryUrls.length;
    if (remaining <= 0) { setError(`Maximum ${MAX_GALLERY} gallery photos.`); return; }
    const toUpload = files.slice(0, remaining);

    setUploadingGallery(true); setError("");
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        setProgress(`Compressing photo ${i + 1}/${toUpload.length}...`);
        const blob = await compressToWebP(file);
        const path = `packages/${packageId}/gallery-${Date.now()}-${i}.webp`;
        setProgress(`Uploading photo ${i + 1}/${toUpload.length}...`);
        const url = await uploadFile(blob, path);
        newUrls.push(url);
      }

      const updated = [...galleryUrls, ...newUrls];

      const res = await fetch(`/api/admin/tours/packages/${packageId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gallery_urls: updated }),
      });
      if (!res.ok) throw new Error("Failed to save");

      setGalleryUrls(updated);
      onUpdate(coverUrl, updated);
      setProgress(`✅ ${newUrls.length} photo${newUrls.length > 1 ? "s" : ""} added!`);
      setTimeout(() => setProgress(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function removeGalleryPhoto(urlToRemove: string) {
    const updated = galleryUrls.filter(u => u !== urlToRemove);
    const res = await fetch(`/api/admin/tours/packages/${packageId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery_urls: updated }),
    });
    if (res.ok) {
      setGalleryUrls(updated);
      onUpdate(coverUrl, updated);
    }
  }

  async function removeCover() {
    const res = await fetch(`/api/admin/tours/packages/${packageId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_image_url: null }),
    });
    if (res.ok) {
      setCoverUrl(null);
      onUpdate(null, galleryUrls);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 space-y-5">
      <h2 className="font-bold text-[#134e4a]">📸 Package Photos</h2>
      <p className="text-xs text-gray-400 -mt-3">
        Photos are automatically compressed to WebP format. Upload high-quality originals — we handle the rest.
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}
      {progress && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 font-semibold">
          {progress}
        </div>
      )}

      {/* Cover Photo */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">Cover Photo <span className="text-xs font-normal text-gray-400">(shown in listing)</span></p>
        {coverUrl ? (
          <div className="relative inline-block">
            <img src={coverUrl} alt="Cover" className="w-full max-w-sm h-48 object-cover rounded-xl border-2 border-emerald-200" />
            <div className="absolute top-2 right-2 flex gap-1">
              <button onClick={() => coverInputRef.current?.click()}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 shadow-sm">
                Change
              </button>
              <button onClick={removeCover}
                className="bg-white border border-red-200 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 shadow-sm">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => coverInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center w-full max-w-sm h-40 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-colors disabled:opacity-50">
            <span className="text-3xl mb-2">🖼️</span>
            <span className="text-sm font-semibold text-emerald-700">
              {uploading ? "Uploading..." : "Upload Cover Photo"}
            </span>
            <span className="text-xs text-emerald-600 mt-1">JPG, PNG, WEBP — auto-compressed</span>
          </button>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>

      {/* Gallery */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">
          Gallery Photos
          <span className="text-xs font-normal text-gray-400 ml-2">({galleryUrls.length}/{MAX_GALLERY})</span>
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {galleryUrls.map((url, i) => (
            <div key={url} className="relative group">
              <img src={url} alt={`Gallery ${i + 1}`}
                className="w-full h-24 object-cover rounded-xl border border-gray-200" />
              <button onClick={() => removeGalleryPhoto(url)}
                className="absolute top-1 right-1 bg-white/90 border border-red-200 rounded-full w-6 h-6 text-xs text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 flex items-center justify-center">
                ✕
              </button>
            </div>
          ))}
          {galleryUrls.length < MAX_GALLERY && (
            <button onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery}
              className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-emerald-300 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <span className="text-xl">+</span>
              <span className="text-xs text-gray-400 mt-0.5">
                {uploadingGallery ? "..." : "Add"}
              </span>
            </button>
          )}
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={handleGalleryUpload} />
        <p className="text-xs text-gray-400">
          Up to {MAX_GALLERY} photos. Select multiple at once. All compressed to WebP automatically.
        </p>
      </div>
    </div>
  );
}
