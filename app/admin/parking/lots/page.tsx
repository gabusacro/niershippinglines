"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import LotAssignmentSection from "./LotAssignmentSection";

type LotMedia = { id: string; photo_url: string; seo_name: string; is_cover: boolean; sort_order: number };
type Profile = { id: string; full_name: string | null; email: string | null };
type CrewMember = { id: string; crew_id: string; full_name: string; email: string };
type Lot = {
  id: string; name: string; slug: string; address: string;
  distance_from_port: string | null;
  owner_id: string | null; owner: Profile | null; crew: CrewMember[];
  total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number;
  accepts_car: boolean; accepts_motorcycle: boolean; accepts_van: boolean;
  car_rate_cents: number | null; motorcycle_rate_cents: number | null; van_rate_cents: number | null;
  is_active: boolean; is_24hrs: boolean;
  available_car: number; available_motorcycle: number; available_van: number;
  media: LotMedia[];
};
type LotForm = {
  name: string; slug: string; address: string; distance_from_port: string;
  total_slots_car: number; total_slots_motorcycle: number; total_slots_van: number;
  accepts_car: boolean; accepts_motorcycle: boolean; accepts_van: boolean;
  car_rate_cents: string; motorcycle_rate_cents: string; van_rate_cents: string;
  is_active: boolean; is_24hrs: boolean;
};

const emptyForm: LotForm = {
  name: "", slug: "", address: "", distance_from_port: "",
  total_slots_car: 0, total_slots_motorcycle: 0, total_slots_van: 0,
  accepts_car: true, accepts_motorcycle: true, accepts_van: false,
  car_rate_cents: "", motorcycle_rate_cents: "", van_rate_cents: "",
  is_active: true, is_24hrs: true,
};

function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function compressToWebP(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const tryQ = (q: number) => {
        c.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size > 3 * 1024 * 1024 && q > 0.55) { tryQ(q - 0.15); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: Date.now() }));
        }, "image/webp", q);
      };
      tryQ(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Photo Gallery for a single lot ───────────────────────────────────────────
function LotPhotoManager({ lot, onUpdate }: { lot: Lot; onUpdate: () => void }) {
  const [media, setMedia]         = useState<LotMedia[]>(lot.media);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canAdd = media.length < 5;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (fileRef.current) fileRef.current.value = "";

    setUploading(true); setProgress(10); setMsg(null);
    try {
      setProgress(30);
      const compressed = await compressToWebP(raw);
      setProgress(55);

      const fd = new FormData();
      fd.append("photo", compressed);
      fd.append("lot_id", lot.id);
      fd.append("lot_name", lot.name);

      setProgress(70);
      const res = await fetch("/api/admin/parking/lots/media", { method: "POST", body: fd });
      const d = await res.json();
      setProgress(90);

      if (!res.ok) { setMsg(d.error ?? "Upload failed."); return; }
      setMedia(prev => [...prev, d.photo]);
      setProgress(100);
      onUpdate();
      setTimeout(() => setProgress(0), 800);
    } catch { setMsg("Upload failed. Try again."); }
    finally { setUploading(false); }
  }

  async function handleDelete(photoId: string) {
    setDeleting(photoId); setMsg(null);
    try {
      const res = await fetch(`/api/admin/parking/lots/media?id=${photoId}`, { method: "DELETE" });
      if (!res.ok) { setMsg("Delete failed."); return; }
      setMedia(prev => {
        const updated = prev.filter(p => p.id !== photoId);
        // If deleted was cover, promote first remaining
        const wascover = prev.find(p => p.id === photoId)?.is_cover;
        if (wascover && updated.length > 0) updated[0].is_cover = true;
        return updated;
      });
      onUpdate();
    } catch { setMsg("Network error."); }
    finally { setDeleting(null); }
  }

  async function handleSetCover(photoId: string) {
    try {
      await fetch("/api/admin/parking/lots/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photoId, lot_id: lot.id }),
      });
      setMedia(prev => prev.map(p => ({ ...p, is_cover: p.id === photoId })));
      onUpdate();
    } catch { setMsg("Network error."); }
  }

  return (
    <div className="space-y-3">
      {msg && (
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${msg.includes("failed") || msg.includes("error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {msg}
        </div>
      )}

      {/* Progress bar */}
      {uploading && progress > 0 && (
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-2 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-5 gap-2">
        {media.map(photo => (
          <div key={photo.id} className="relative group rounded-xl overflow-hidden border-2 border-blue-100 aspect-square bg-gray-100">
            <img src={photo.photo_url} alt={photo.seo_name} className="w-full h-full object-cover" />
            {photo.is_cover && (
              <div className="absolute top-1 left-1 rounded-full bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5">Cover</div>
            )}
            {/* Hover actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
              {!photo.is_cover && (
                <button onClick={() => handleSetCover(photo.id)}
                  className="w-full rounded-lg bg-blue-500 text-white text-[10px] font-bold py-1 hover:bg-blue-600">
                  Set Cover
                </button>
              )}
              <button onClick={() => handleDelete(photo.id)} disabled={deleting === photo.id}
                className="w-full rounded-lg bg-red-500 text-white text-[10px] font-bold py-1 hover:bg-red-600 disabled:opacity-50">
                {deleting === photo.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}

        {/* Add slot */}
        {canAdd && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors ${uploading ? "border-blue-200 bg-blue-50 cursor-wait" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"}`}>
            {uploading
              ? <div className="w-5 h-5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
              : <><span className="text-2xl text-blue-300">+</span><span className="text-[10px] text-blue-400 mt-0.5">Add photo</span></>
            }
          </button>
        )}

        {/* Empty slots indicator */}
        {Array.from({ length: Math.max(0, 5 - media.length - (canAdd ? 1 : 0)) }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-gray-100 bg-gray-50" />
        ))}
      </div>

      <p className="text-[10px] text-gray-400">{media.length}/5 photos · Auto-compressed to WebP · Hover photo to set cover or delete</p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminParkingLotsPage() {
  const [lots, setLots]           = useState<Lot[]>([]);
  const [allOwners, setAllOwners] = useState<Profile[]>([]);
  const [allCrew, setAllCrew]     = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lot | null>(null);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState<LotForm>(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const [lotsRes, allMedia] = await Promise.all([
        fetch("/api/admin/parking/lots").then(r => r.json()),
        fetch("/api/admin/parking/lots/media?lot_id=all").then(r => r.json()).catch(() => []),
      ]);
      const mediaByLot = new Map<string, LotMedia[]>();
      (Array.isArray(allMedia) ? allMedia : []).forEach((m: LotMedia & { lot_id: string }) => {
        if (!mediaByLot.has(m.lot_id)) mediaByLot.set(m.lot_id, []);
        mediaByLot.get(m.lot_id)!.push(m);
      });
      // API now returns { lots, owners, crew }
      const lotsArray = lotsRes?.lots ?? lotsRes ?? [];
      const withMedia = lotsArray.map((l: Lot) => ({ ...l, media: mediaByLot.get(l.id) ?? [] }));
      setLots(withMedia);
      if (lotsRes?.owners) setAllOwners(lotsRes.owners);
      if (lotsRes?.crew)   setAllCrew(lotsRes.crew);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  async function saveLot() {
    if (!editing) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/parking/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Save failed."); return; }
      setMsg("✅ Saved."); setEditing(null); await fetchLots();
    } catch { setMsg("Network error."); }
    finally { setSaving(false); }
  }

  async function addLot() {
    if (!form.name.trim() || !form.address.trim()) { setMsg("Name and address are required."); return; }
    setSaving(true); setMsg(null);
    try {
      const body = {
        ...form,
        slug: form.slug || slugify(form.name),
        car_rate_cents:        form.car_rate_cents        ? Math.round(parseFloat(form.car_rate_cents) * 100)        : null,
        motorcycle_rate_cents: form.motorcycle_rate_cents ? Math.round(parseFloat(form.motorcycle_rate_cents) * 100) : null,
        van_rate_cents:        form.van_rate_cents        ? Math.round(parseFloat(form.van_rate_cents) * 100)        : null,
      };
      const res = await fetch("/api/admin/parking/lots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Failed to create lot."); return; }
      setMsg("✅ Lot created."); setAdding(false); setForm(emptyForm); await fetchLots();
    } catch { setMsg("Network error."); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full rounded-xl border-2 border-blue-100 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none";
  const labelCls = "text-xs font-semibold text-gray-600 block mb-1";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">🅿️ Parking Lots</h1>
        <p className="mt-2 text-sm text-white/90">Manage lots, slots, rates, and photos.</p>
      </div>

      <div className="mb-6 flex gap-3 flex-wrap">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back</Link>
        <button onClick={() => { setAdding(true); setMsg(null); }}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
          + Add New Lot
        </button>
      </div>

      {msg && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>{msg}</div>}

      {/* Add lot form */}
      {adding && (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 mb-6">
          <h2 className="font-black text-blue-800 text-lg mb-4">➕ New Parking Lot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Lot Name *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} placeholder="Travela Parking — Port Area 3" className={inputCls} /></div>
            <div><label className={labelCls}>Slug (auto-filled)</label><input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="port-area-3" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Address *</label><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Near Dapa Port, Siargao Island" className={inputCls} /></div>
            <div><label className={labelCls}>Distance from Port</label><input type="text" value={form.distance_from_port} onChange={e => setForm({ ...form, distance_from_port: e.target.value })} placeholder="100–150 mtrs near port" className={inputCls} /></div>
            <div />
            <div><label className={labelCls}>Car Slots</label><input type="number" min={0} value={form.total_slots_car} onChange={e => setForm({ ...form, total_slots_car: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Motorcycle Slots</label><input type="number" min={0} value={form.total_slots_motorcycle} onChange={e => setForm({ ...form, total_slots_motorcycle: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Van Slots</label><input type="number" min={0} value={form.total_slots_van} onChange={e => setForm({ ...form, total_slots_van: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Car Rate ₱/day</label><input type="number" min={0} value={form.car_rate_cents} onChange={e => setForm({ ...form, car_rate_cents: e.target.value })} placeholder="250" className={inputCls} /></div>
            <div><label className={labelCls}>Motorcycle Rate ₱/day</label><input type="number" min={0} value={form.motorcycle_rate_cents} onChange={e => setForm({ ...form, motorcycle_rate_cents: e.target.value })} placeholder="250" className={inputCls} /></div>
            <div><label className={labelCls}>Van Rate ₱/day</label><input type="number" min={0} value={form.van_rate_cents} onChange={e => setForm({ ...form, van_rate_cents: e.target.value })} placeholder="300" className={inputCls} /></div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            {[{ key: "accepts_car", label: "Accepts Cars" }, { key: "accepts_motorcycle", label: "Accepts Motorcycles" }, { key: "accepts_van", label: "Accepts Vans" }, { key: "is_active", label: "Active" }, { key: "is_24hrs", label: "24 Hours" }].map(f => (
              <label key={f.key} className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form[f.key as keyof LotForm] as boolean} onChange={e => setForm({ ...form, [f.key]: e.target.checked })} className="rounded" />
                {f.label}
              </label>
            ))}
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setAdding(false); setForm(emptyForm); setMsg(null); }} className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={addLot} disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Creating…" : "Create Lot"}</button>
          </div>
        </div>
      )}

      {/* Lots list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">Loading…</div>
      ) : (
        <div className="space-y-4">
          {lots.map(lot => {
            const cover = lot.media.find(m => m.is_cover) ?? lot.media[0];
            const hasPhotos = lot.media.length > 0;
            return (
              <div key={lot.id} className="rounded-2xl border-2 border-blue-100 bg-white overflow-hidden">
                {/* Cover photo strip */}
                {cover && (
                  <div className="h-36 w-full overflow-hidden">
                    <img src={cover.photo_url} alt={lot.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="font-black text-gray-800 text-lg">{lot.name}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lot.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{lot.is_active ? "Active" : "Inactive"}</span>
                        {hasPhotos
                          ? <span className="rounded-full bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5">📸 {lot.media.length} photo{lot.media.length > 1 ? "s" : ""}</span>
                          : <span className="rounded-full bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5">📷 No photos</span>
                        }
                      </div>
                      <p className="text-sm text-gray-500">📍 {lot.distance_from_port ?? lot.address}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        {lot.accepts_car        && <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-800">🚗 {lot.total_slots_car} · {lot.available_car} avail{lot.car_rate_cents ? ` · ${peso(lot.car_rate_cents)}/day` : ""}</span>}
                        {lot.accepts_motorcycle && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800">🏍️ {lot.total_slots_motorcycle} · {lot.available_motorcycle} avail{lot.motorcycle_rate_cents ? ` · ${peso(lot.motorcycle_rate_cents)}/day` : ""}</span>}
                        {lot.accepts_van        && <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-800">🚐 {lot.total_slots_van} · {lot.available_van} avail{lot.van_rate_cents ? ` · ${peso(lot.van_rate_cents)}/day` : ""}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEditing({ ...lot }); setMsg(null); }}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                      Edit Slots &amp; Rates
                    </button>
                  </div>

                  {/* Photo manager inline */}
                  <LotPhotoManager lot={lot} onUpdate={fetchLots} />
                  <LotAssignmentSection
                    lotId={lot.id}
                    lotName={lot.name}
                    currentOwner={lot.owner ?? null}
                    currentCrew={lot.crew ?? []}
                    availableOwners={allOwners}
                    availableCrew={allCrew}
                    onRefresh={fetchLots}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal — slots and rates only */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl mx-4 my-8">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Edit — {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Car Slots</label><input type="number" min={0} value={editing.total_slots_car} onChange={e => setEditing({ ...editing, total_slots_car: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Motorcycle Slots</label><input type="number" min={0} value={editing.total_slots_motorcycle} onChange={e => setEditing({ ...editing, total_slots_motorcycle: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Van Slots</label><input type="number" min={0} value={editing.total_slots_van} onChange={e => setEditing({ ...editing, total_slots_van: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Car Rate ₱/day</label><input type="number" min={0} value={editing.car_rate_cents ? editing.car_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, car_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Default" className={inputCls} /></div>
                <div><label className={labelCls}>Motorcycle Rate ₱/day</label><input type="number" min={0} value={editing.motorcycle_rate_cents ? editing.motorcycle_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, motorcycle_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Default" className={inputCls} /></div>
                <div><label className={labelCls}>Van Rate ₱/day</label><input type="number" min={0} value={editing.van_rate_cents ? editing.van_rate_cents / 100 : ""} onChange={e => setEditing({ ...editing, van_rate_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} placeholder="Default" className={inputCls} /></div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{ key: "accepts_car", label: "Accepts Cars" }, { key: "accepts_motorcycle", label: "Accepts Motorcycles" }, { key: "accepts_van", label: "Accepts Vans" }, { key: "is_active", label: "Active" }, { key: "is_24hrs", label: "24 Hours" }].map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editing[f.key as keyof Lot] as boolean} onChange={e => setEditing({ ...editing, [f.key]: e.target.checked })} className="rounded" />
                    {f.label}
                  </label>
                ))}
              </div>
              {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg}</div>}
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveLot} disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
