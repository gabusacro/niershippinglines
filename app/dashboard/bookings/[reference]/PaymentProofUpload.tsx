"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

export function PaymentProofUpload({
  reference,
  hasProof,
}: {
  reference: string;
  hasProof: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("reference", reference);
      formData.set("file", file);
      const res = await fetch("/api/booking/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setSuccess(true);
      toast.showSuccess("Payment proof uploaded. We'll verify and confirm your booking soon.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-amber-900 mt-2">Submit payment proof</h3>
      <p className="text-xs text-amber-800 mt-0.5">
        Upload a screenshot of your GCash payment so we can confirm your booking faster.
      </p>
      {hasProof && (
        <p className="mt-2 text-sm font-medium text-emerald-700">Proof already submitted. We’ll confirm soon.</p>
      )}
      <label className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="sr-only"
          onChange={handleChange}
          disabled={uploading}
        />
        {uploading ? "Uploading…" : "Choose screenshot or PDF"}
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-700">Uploaded. We’ll verify and confirm your booking.</p>}
    </div>
  );
}
