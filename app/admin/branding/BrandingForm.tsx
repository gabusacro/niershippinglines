"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import type { SiteBranding } from "@/lib/site-branding";

export function BrandingForm({ initial }: { initial: SiteBranding }) {
  const router = useRouter();
  const toast = useToast();
  const [siteName, setSiteName] = useState(initial.site_name);
  const [routesText, setRoutesText] = useState(initial.routes_text);
  const [tagline, setTagline] = useState(initial.tagline);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName.trim(),
          routes_text: routesText.trim(),
          tagline: tagline.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.showSuccess(data.message ?? "Branding updated.");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="site_name" className="block text-sm font-medium text-[#134e4a]">
          Site name (website title)
        </label>
        <input
          id="site_name"
          type="text"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g. Nier Shipping Lines or Travel As Iargao"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]">Shown in header, footer, tickets, manifest, and page titles.</p>
      </div>
      <div>
        <label htmlFor="routes_text" className="block text-sm font-medium text-[#134e4a]">
          Routes line
        </label>
        <input
          id="routes_text"
          type="text"
          value={routesText}
          onChange={(e) => setRoutesText(e.target.value)}
          placeholder="e.g. Siargao Island ↔ Surigao · Dinagat ↔ Surigao City"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]">Shown under the site name on home, tickets, and emails.</p>
      </div>
      <div>
        <label htmlFor="tagline" className="block text-sm font-medium text-[#134e4a]">
          Tagline
        </label>
        <input
          id="tagline"
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Feel the island before you arrive. Sun, waves, and a smooth sail away."
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]">Shown on home hero and in email footers.</p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
