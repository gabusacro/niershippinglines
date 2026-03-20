"use client";

import { useState, useEffect } from "react";

type Photo = {
  id: string;
  vehicle_plate: string;
  label: string;
  photo_path: string;
  notes: string | null;
  uploaded_at: string;
  signed_url: string | null;
  uploader?: { full_name: string; role: string } | null;
};

const LABEL_META: Record<string, { label: string; color: string; emoji: string }> = {
  arrival:   { label: "Arrival condition",   color: "bg-blue-50 text-blue-800 border-blue-200",     emoji: "🟦" },
  departure: { label: "Departure condition", color: "bg-emerald-50 text-emerald-800 border-emerald-200", emoji: "🟩" },
  damage:    { label: "Damage noted",        color: "bg-red-50 text-red-800 border-red-200",         emoji: "🔴" },
  other:     { label: "Other",               color: "bg-gray-50 text-gray-700 border-gray-200",      emoji: "⬜" },
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });
}

export default function VehicleConditionPhotos({ reservationId }: { reservationId: string }) {
  const [photos, setPhotos]   = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/parking/photos?reservation_id=${reservationId}`);
        if (res.ok) { const data = await res.json(); setPhotos(data); }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [reservationId]);

  if (loading) return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
      <h2 className="text-sm font-black text-[#134e4a] mb-3">📸 Vehicle Condition Photos</h2>
      <p className="text-sm text-gray-400 animate-pulse">Loading photos…</p>
    </div>
  );

  if (photos.length === 0) return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white p-5">
      <h2 className="text-sm font-black text-[#134e4a] mb-2">📸 Vehicle Condition Photos</h2>
      <p className="text-sm text-gray-400">No condition photos uploaded yet. Crew will upload photos when your vehicle arrives.</p>
    </div>
  );

  // Group by plate
  const byPlate = photos.reduce<Record<string, Photo[]>>((acc, p) => {
    if (!acc[p.vehicle_plate]) acc[p.vehicle_plate] = [];
    acc[p.vehicle_plate].push(p);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border-2 border-teal-100 bg-white overflow-hidden">
      <div className="bg-teal-50 px-5 py-3 border-b border-teal-100">
        <h2 className="text-sm font-black text-[#134e4a]">📸 Vehicle Condition Photos ({photos.length})</h2>
        <p className="text-xs text-gray-400 mt-0.5">Photos expire after 6 months from upload date.</p>
      </div>
      <div className="p-5 space-y-5">
        {Object.entries(byPlate).map(([plate, platePhotos]) => (
          <div key={plate}>
            <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide mb-3 font-mono">🚗 {plate}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {platePhotos.map(photo => {
                const meta = LABEL_META[photo.label] ?? { label: photo.label, color: "bg-gray-50 text-gray-700 border-gray-200", emoji: "📷" };
                const uploaderName = photo.uploader
                  ? (Array.isArray(photo.uploader) ? (photo.uploader as { full_name: string }[])[0]?.full_name : (photo.uploader as { full_name: string }).full_name)
                  : null;
                return (
                  <div key={photo.id} className="rounded-xl border border-teal-100 overflow-hidden bg-white">
                    {photo.signed_url ? (
                      <a href={photo.signed_url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={photo.signed_url}
                          alt={`${meta.label} — ${plate}`}
                          className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                        Preview unavailable
                      </div>
                    )}
                    <div className="p-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${meta.color}`}>
                        {meta.emoji} {meta.label}
                      </span>
                      {photo.notes && <p className="text-xs text-gray-600 mt-1">{photo.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">{formatDateTime(photo.uploaded_at)}</p>
                      {uploaderName && <p className="text-xs text-gray-400">by {uploaderName}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
