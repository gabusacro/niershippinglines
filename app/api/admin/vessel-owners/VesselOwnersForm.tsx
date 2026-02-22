"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Owner = { id: string; full_name: string | null; role: string };
type Boat = { id: string; name: string };
type Assignment = {
  id: string;
  vessel_owner_id: string;
  boat_id: string;
  patronage_bonus_percent: number;
  assigned_at: string;
  boat: { id: string; name: string } | null;
};
type Profile = { id: string; full_name: string | null; role: string };

export function VesselOwnersForm({
  initialOwners,
  initialBoats,
  initialAssignments,
  allProfiles,
}: {
  initialOwners: Owner[];
  initialBoats: Boat[];
  initialAssignments: Assignment[];
  allProfiles: Profile[];
}) {
  const router = useRouter();
  const [owners, setOwners] = useState(initialOwners);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Assign vessel form
  const [assignForm, setAssignForm] = useState({ owner_id: "", boat_id: "", bonus: "0" });
  // Promote user form
  const [promoteUserId, setPromoteUserId] = useState("");
  // Edit bonus
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBonus, setEditBonus] = useState("");

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  async function handlePromote() {
    if (!promoteUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vessel-owners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: promoteUserId, role: "vessel_owner" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const promoted = allProfiles.find((p) => p.id === promoteUserId);
      if (promoted) setOwners((prev) => [...prev, { ...promoted, role: "vessel_owner" }]);
      setPromoteUserId("");
      flash("User promoted to Vessel Owner!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm.owner_id || !assignForm.boat_id) {
      flash("Select an owner and a vessel.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vessel-owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vessel_owner_id: assignForm.owner_id,
          boat_id: assignForm.boat_id,
          patronage_bonus_percent: parseFloat(assignForm.bonus) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAssignments((prev) => {
        const existing = prev.findIndex((a) => a.boat_id === assignForm.boat_id);
        const boat = initialBoats.find((b) => b.id === assignForm.boat_id) ?? null;
        const newA = { ...json.assignment, boat };
        if (existing >= 0) { const next = [...prev]; next[existing] = newA; return next; }
        return [...prev, newA];
      });
      setAssignForm({ owner_id: "", boat_id: "", bonus: "0" });
      flash("Vessel assigned!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateBonus(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vessel-owners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patronage_bonus_percent: parseFloat(editBonus) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, patronage_bonus_percent: json.assignment.patronage_bonus_percent } : a));
      setEditingId(null);
      flash("Bonus updated!");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign(id: string) {
    if (!confirm("Remove this vessel assignment?")) return;
    try {
      const res = await fetch("/api/admin/vessel-owners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      flash("Assignment removed.");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    }
  }

  // Non-owner profiles that can be promoted
  const promotable = allProfiles.filter((p) => p.role !== "vessel_owner" && p.role !== "admin");
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return (
    <div className="space-y-8">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}

      {/* Step 1 — Promote user to vessel_owner */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Step 1 — Promote a user to Vessel Owner</p>
        <p className="mt-1 text-xs text-[#0f766e]/70">The user must already have an account. Find them by name and set their role to Vessel Owner.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-[#134e4a]">Select user</label>
            <select value={promoteUserId} onChange={(e) => setPromoteUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]">
              <option value="">— Choose user —</option>
              {promotable.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? "Unnamed"} ({p.role})</option>
              ))}
            </select>
          </div>
          <button onClick={handlePromote} disabled={saving || !promoteUserId}
            className="rounded-xl bg-[#0c7b93] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
            Promote to Vessel Owner
          </button>
        </div>
      </div>

      {/* Current vessel owners */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Current Vessel Owners ({owners.length})</p>
        {owners.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No vessel owners yet. Promote a user above.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {owners.map((o) => (
              <span key={o.id} className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-sm font-medium text-[#134e4a]">
                🚢 {o.full_name ?? "Unnamed"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — Assign vessel to owner */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Step 2 — Assign a Vessel to an Owner</p>
        <p className="mt-1 text-xs text-[#0f766e]/70">Set which vessel belongs to which owner and their patronage bonus % from the net platform revenue pool.</p>
        {owners.length === 0 ? (
          <p className="mt-3 text-sm text-amber-600">⚠ No vessel owners yet — promote a user first.</p>
        ) : (
          <form onSubmit={handleAssign} className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Vessel Owner</label>
              <select value={assignForm.owner_id} onChange={(e) => setAssignForm((f) => ({ ...f, owner_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]">
                <option value="">— Select owner —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name ?? "Unnamed"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Vessel</label>
              <select value={assignForm.boat_id} onChange={(e) => setAssignForm((f) => ({ ...f, boat_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]">
                <option value="">— Select vessel —</option>
                {initialBoats.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Patronage Bonus %</label>
              <input value={assignForm.bonus} onChange={(e) => setAssignForm((f) => ({ ...f, bonus: e.target.value }))}
                type="number" step="0.01" min="0" max="100" placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="w-full rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                {saving ? "Saving…" : "Assign Vessel"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Current assignments */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Vessel Assignments</p>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No assignments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Owner</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Patronage Bonus %</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {assignments.map((a) => {
                  const owner = ownerMap.get(a.vessel_owner_id);
                  return (
                    <tr key={a.id} className="hover:bg-teal-50/40">
                      <td className="px-4 py-3 font-medium text-[#134e4a]">🚢 {a.boat?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-[#134e4a]">{owner?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {editingId === a.id ? (
                          <input value={editBonus} onChange={(e) => setEditBonus(e.target.value)}
                            type="number" step="0.01" min="0" max="100"
                            className="w-24 rounded-lg border border-teal-200 px-2 py-1 text-right text-sm outline-none focus:border-[#0c7b93]" />
                        ) : (
                          <span className="font-semibold text-[#0c7b93]">{a.patronage_bonus_percent}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          {editingId === a.id ? (
                            <>
                              <button onClick={() => handleUpdateBonus(a.id)} disabled={saving}
                                className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingId(null)}
                                className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(a.id); setEditBonus(String(a.patronage_bonus_percent)); }}
                                className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">Edit %</button>
                              <button onClick={() => handleUnassign(a.id)}
                                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
