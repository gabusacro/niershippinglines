"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_SIZE = 400;        // max width/height in px
const QUALITY  = 0.85;       // JPEG/WebP compression quality
const OUTPUT_TYPE = "image/webp"; // always output WebP for best compression

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions (max 400x400, preserve aspect ratio)
      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width  = MAX_SIZE;
        } else {
          width  = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          resolve(blob);
        },
        OUTPUT_TYPE,
        QUALITY
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AvatarUpload({
  currentAvatarUrl,
  initials,
}: {
  currentAvatarUrl?: string | null;
  initials: string;
}) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview,     setPreview]     = useState<string | null>(currentAvatarUrl ?? null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [sizeInfo,    setSizeInfo]    = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSizeInfo(null);

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }

    try {
      setUploading(true);

      // Compress client-side
      const originalSize = file.size;
      const compressed   = await compressImage(file);
      const compressedSize = compressed.size;

      setSizeInfo(
        `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} ` +
        `(${Math.round((1 - compressedSize / originalSize) * 100)}% smaller)`
      );

      // Show preview immediately
      const previewUrl = URL.createObjectURL(compressed);
      setPreview(previewUrl);

      // Upload to server
      const fd = new FormData();
      fd.append("file", new File([compressed], "avatar.webp", { type: OUTPUT_TYPE }));

      const res  = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setPreview(currentAvatarUrl ?? null);
        return;
      }

      // Update preview with real URL (with cache buster)
      setPreview(data.avatar_url);
      router.refresh();

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar display */}
      <div className="relative group">
        <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-white/30 shadow-lg bg-white/20">
          {preview ? (
            <img
              src={preview}
              alt="Profile photo"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-3xl font-black text-white">
              {initials}
            </div>
          )}
        </div>

        {/* Camera overlay button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile photo"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
        >
          {uploading ? (
            <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {/* Upload prompt */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs font-semibold text-white/70 hover:text-white transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
      </button>

      {/* Size info */}
      {sizeInfo && !error && (
        <p className="text-[10px] text-white/60 text-center">✓ Compressed: {sizeInfo}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs font-semibold text-red-300 text-center max-w-[160px]">⚠ {error}</p>
      )}
    </div>
  );
}
