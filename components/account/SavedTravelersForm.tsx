"use client";
import { useState, useEffect } from "react";

type Traveler = {
  id: string;
  full_name: string;
  gender: string | null;
  birthdate: string | null;
  nationality: string | null;
};

const NATIONALITIES = [
  "Filipino", "American", "Australian", "British", "Canadian", "Chinese",
  "French", "German", "Japanese", "Korean", "Singaporean", "Other"
];

const GENDERS = ["Male", "Female", "Other"];

function calcAge(birthdate: string | null): string {
  if (!birthdate) return "";
  const today = new Date();
  const dob = new Date(birthdate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? `${age} years old` : "";
}

function TravelerForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Traveler>;
  onSave: (data: Omit<Traveler, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [birthdate, setBirthdate] = useState(initial?.birthdate ?? "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "");

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
      <div>
        <label className="block text-xs text-[#0f766e] mb-1">Full Name *</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Maria Santos"
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">— Select —</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Date of Birth</label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
          {birthdate && <p className="mt-0.5 text-xs text-[#0f766e]">{calcAge(birthdate)}</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Nationality</label>
          <select
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">— Select —</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave({ full_name: fullName.trim(), gender: gender || null, birthdate: birthdate || null, nationality: nationality || null })}
          disabled={saving || !fullName.trim()}
          className="rounded-lg bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SavedTravelersForm() {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saved-travelers")
      .then((r) => r.json())
      .then((data) => setTravelers(data.travelers ?? []))
      .catch(() => setError("Failed to load saved travelers"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (data: Omit<Traveler, "id">) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-travelers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error ?? "Failed to save"); return; }
      setTravelers((prev) => [...prev, result.traveler]);
      setShowAdd(false);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id: string, data: Omit<Traveler, "id">) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/saved-travelers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error ?? "Failed to update"); return; }
      setTravelers((prev) => prev.map((t) => t.id === id ? result.traveler : t));
      setEditingId(null);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this traveler from your saved list?")) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/saved-travelers/${id}`, { method: "DELETE" });
      if (!res.ok) { setError("Failed to delete"); return; }
      setTravelers((prev) => prev.filter((t) => t.id !== id));
    } catch { setError("Network error"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#134e4a]">Saved Travelers</h2>
          <p className="text-sm text-[#0f766e] mt-0.5">
            Save family members so you can quickly add them when booking.
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-[#0c7b93] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            + Add
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {showAdd && (
        <div className="mb-4">
          <TravelerForm
            onSave={handleAdd}
            onCancel={() => setShowAdd(false)}
            saving={saving}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#0f766e]">Loading…</p>
      ) : travelers.length === 0 && !showAdd ? (
        <p className="text-sm text-[#0f766e]/70 italic">
          No saved travelers yet. Add family members to speed up future bookings.
        </p>
      ) : (
        <div className="space-y-3">
          {travelers.map((t) => (
            <div key={t.id}>
              {editingId === t.id ? (
                <TravelerForm
                  initial={t}
                  onSave={(data) => handleEdit(t.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/20 px-4 py-3">
                  <div>
                    <p className="font-medium text-[#134e4a]">{t.full_name}</p>
                    <p className="text-xs text-[#0f766e] mt-0.5">
                      {[t.gender, t.birthdate ? calcAge(t.birthdate) : null, t.nationality]
                        .filter(Boolean).join(" · ") || "No details saved"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(t.id)}
                      className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0f766e] hover:bg-teal-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === t.id ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
