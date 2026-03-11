"use client";
import { useEffect, useState } from "react";

const PAGES = [
  { value: "all", label: "All Pages" },
  { value: "/", label: "Homepage" },
  { value: "/tours", label: "Tours" },
  { value: "/schedule", label: "Schedule" },
  { value: "/parking", label: "Pay Parking (insert popup here when built)" },
  { value: "/book", label: "Booking Page" },
];

export default function PromoPopupAdmin() {
  const [form, setForm] = useState({
    is_active: false,
    image_url: "",
    headline: "",
    subtext: "",
    button_label: "Learn More",
    button_url: "",
    show_on: ["all"] as string[],
    expires_days: 7,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");

  useEffect(() => {
    fetch("/api/admin/promo-popup")
      .then((r) => r.json())
      .then((d) => { if (d) setForm({ ...form, ...d }); });
  }, []);

  const toggle = (val: string) => {
    if (val === "all") { setForm({ ...form, show_on: ["all"] }); return; }
    const curr = form.show_on.filter((v) => v !== "all");
    setForm({
      ...form,
      show_on: curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val],
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const ext = file.name.split(".").pop();
    const path = `promo-popup/banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("branding").getPublicUrl(path);
      setForm({ ...form, image_url: publicUrl });
    }
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/promo-popup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Promo Popup Banner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Shows once per visitor. Reappears after {form.expires_days} days or cache reset.
        </p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-white border rounded-xl p-4">
        <div>
          <p className="font-semibold text-gray-800">Popup Active</p>
          <p className="text-sm text-gray-500">Turn on to show popup to visitors</p>
        </div>
        <button
          onClick={() => setForm({ ...form, is_active: !form.is_active })}
          className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? "bg-teal-600" : "bg-gray-300"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_active ? "left-7" : "left-1"}`} />
        </button>
      </div>

      {/* Image */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-800">Promo Image</p>
        <div className="flex gap-2">
          <button onClick={() => setImageMode("url")} className={`px-3 py-1 rounded-lg text-sm font-medium border ${imageMode === "url" ? "bg-teal-600 text-white border-teal-600" : "text-gray-600 border-gray-300"}`}>Paste URL</button>
          <button onClick={() => setImageMode("upload")} className={`px-3 py-1 rounded-lg text-sm font-medium border ${imageMode === "upload" ? "bg-teal-600 text-white border-teal-600" : "text-gray-600 border-gray-300"}`}>Upload Image</button>
        </div>
        {imageMode === "url" ? (
          <input
            type="text"
            placeholder="https://..."
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        ) : (
          <input type="file" accept="image/*" onChange={handleUpload} className="text-sm" />
        )}
        {form.image_url && (
          <img src={form.image_url} alt="Preview" className="rounded-lg max-h-48 object-cover w-full" />
        )}
      </div>

      {/* Text */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-800">Text Overlay</p>
        <input type="text" placeholder="Headline e.g. 🏝️ Summer Sale!" value={form.headline}
          onChange={(e) => setForm({ ...form, headline: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm" />
        <input type="text" placeholder="Subtext e.g. Book now and save 20%" value={form.subtext}
          onChange={(e) => setForm({ ...form, subtext: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Button */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-800">Button</p>
        <input type="text" placeholder="Button label e.g. Book Now" value={form.button_label}
          onChange={(e) => setForm({ ...form, button_label: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm" />
        <input type="text" placeholder="Button URL e.g. /tours" value={form.button_url}
          onChange={(e) => setForm({ ...form, button_url: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Show on */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-800">Show On Pages</p>
        <div className="grid grid-cols-2 gap-2">
          {PAGES.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.show_on.includes(p.value) || form.show_on.includes("all")}
                onChange={() => toggle(p.value)} className="accent-teal-600" />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div className="bg-white border rounded-xl p-4 space-y-2">
        <p className="font-semibold text-gray-800">Reshow After (days)</p>
        <input type="number" min={1} max={30} value={form.expires_days}
          onChange={(e) => setForm({ ...form, expires_days: parseInt(e.target.value) })}
          className="w-24 border rounded-lg px-3 py-2 text-sm" />
        <p className="text-xs text-gray-400">Popup reappears after this many days (default: 7)</p>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
        {saving ? "Saving..." : saved ? "✅ Saved!" : "Save Popup Settings"}
      </button>
    </div>
  );
}