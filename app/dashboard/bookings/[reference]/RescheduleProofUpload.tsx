"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";

export function RescheduleProofUpload({
  reference,
  feeCents,
}: {
  reference: string;
  feeCents: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleUpload = async () => {
    if (!file) { setError("Please select a screenshot first."); return; }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("reference", reference);
      const res = await fetch("/api/booking/upload-reschedule-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-3">
        <p className="text-sm font-semibold text-teal-800">✓ Screenshot submitted! Admin will verify and confirm shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {GCASH_NUMBER && (
        <div className="rounded-lg border border-orange-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold text-orange-900">Send ₱{(feeCents / 100).toFixed(0)} via GCash:</p>
          <p className="text-sm text-orange-800 mt-0.5">
            <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME})
          </p>
          <p className="text-xs text-orange-700 mt-0.5">Put reference <strong>{reference}</strong> in the message.</p>
        </div>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-300 bg-white p-4 hover:bg-orange-50"
      >
        {preview ? (
          <img src={preview} alt="proof" className="max-h-36 rounded-lg object-contain" />
        ) : (
          <>
            <p className="text-sm text-orange-800">📷 Tap to select GCash screenshot</p>
            <p className="text-xs text-orange-600 mt-1">JPG, PNG, or PDF</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
      {file && <p className="text-xs text-orange-700">Selected: {file.name}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {uploading ? "Uploading…" : "Submit Payment Screenshot"}
      </button>
    </div>
  );
}
