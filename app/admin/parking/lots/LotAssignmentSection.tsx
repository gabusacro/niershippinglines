"use client";

import { useState } from "react";

type Profile = { id: string; full_name: string | null; email: string | null };
type CrewMember = { id: string; crew_id: string; full_name: string; email: string };

interface Props {
  lotId: string;
  lotName: string;
  currentOwner: Profile | null;
  currentCrew: CrewMember[];
  availableOwners: Profile[];
  availableCrew: Profile[];
  onRefresh: () => void;
}

export default function LotAssignmentSection({
  lotId, lotName, currentOwner, currentCrew,
  availableOwners, availableCrew, onRefresh,
}: Props) {
  const [selectedOwner, setSelectedOwner] = useState(currentOwner?.id ?? "");
  const [selectedCrew, setSelectedCrew]   = useState("");
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState<string | null>(null);

  async function post(action: string, userId: string) {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/parking/lots/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: lotId, action, user_id: userId }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? "Failed."); return false; }
      return true;
    } catch { setMsg("Network error."); return false; }
    finally { setSaving(false); }
  }

  async function handleSetOwner() {
    if (!selectedOwner) { setMsg("Select an owner first."); return; }
    const ok = await post("set_owner", selectedOwner);
    if (ok) { setMsg("✅ Owner assigned."); onRefresh(); }
  }

  async function handleAddCrew() {
    if (!selectedCrew) { setMsg("Select a crew member first."); return; }
    if (currentCrew.some(c => c.crew_id === selectedCrew)) { setMsg("Already assigned."); return; }
    const ok = await post("add_crew", selectedCrew);
    if (ok) { setMsg("✅ Crew member added."); setSelectedCrew(""); onRefresh(); }
  }

  async function handleRemoveCrew(crewId: string) {
    if (!confirm("Remove this crew member from the lot?")) return;
    const ok = await post("remove_crew", crewId);
    if (ok) { setMsg("✅ Crew member removed."); onRefresh(); }
  }

  // Filter out crew already assigned
  const unassignedCrew = availableCrew.filter(c => !currentCrew.some(a => a.crew_id === c.id));

  const selectCls = "flex-1 rounded-xl border-2 border-teal-100 bg-white px-3 py-2 text-sm text-[#134e4a] focus:border-[#0c7b93] focus:outline-none";
  const btnCls    = "rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50";

  return (
    <div className="mt-4 rounded-xl border-2 border-teal-100 bg-teal-50/40 p-4 space-y-4">
      <p className="text-xs font-black uppercase tracking-widest text-[#0f766e]">👤 Owner &amp; Crew Assignment</p>

      {msg && (
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Owner */}
      <div>
        <p className="text-xs font-semibold text-[#134e4a] mb-2">Lot Owner</p>
        {currentOwner ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2.5 mb-2">
            <div>
              <p className="text-sm font-semibold text-[#134e4a]">{currentOwner.full_name ?? "—"}</p>
              <p className="text-xs text-gray-400">{currentOwner.email}</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Owner</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 font-semibold mb-2">
            ⚠️ No owner assigned — parking owner cannot see this lot yet
          </div>
        )}
        {availableOwners.length > 0 ? (
          <div className="flex gap-2">
            <select value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)} className={selectCls}>
              <option value="">— Select owner —</option>
              {availableOwners.map(o => (
                <option key={o.id} value={o.id}>{o.full_name ?? o.email} ({o.email})</option>
              ))}
            </select>
            <button onClick={handleSetOwner} disabled={saving || !selectedOwner}
              className={`${btnCls} bg-[#0c7b93] hover:bg-[#085f72]`}>
              {saving ? "…" : "Assign"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No users with Parking Owner role yet. Go to User Management → assign role first.</p>
        )}
      </div>

      {/* Crew */}
      <div>
        <p className="text-xs font-semibold text-[#134e4a] mb-2">Assigned Crew</p>
        {currentCrew.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400 italic mb-2">
            No crew assigned yet
          </div>
        ) : (
          <div className="space-y-1.5 mb-2">
            {currentCrew.map(c => (
              <div key={c.crew_id} className="flex items-center justify-between rounded-xl border border-teal-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#134e4a]">{c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
                <button onClick={() => handleRemoveCrew(c.crew_id)} disabled={saving}
                  className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {unassignedCrew.length > 0 ? (
          <div className="flex gap-2">
            <select value={selectedCrew} onChange={e => setSelectedCrew(e.target.value)} className={selectCls}>
              <option value="">— Add crew member —</option>
              {unassignedCrew.map(c => (
                <option key={c.id} value={c.id}>{c.full_name ?? c.email} ({c.email})</option>
              ))}
            </select>
            <button onClick={handleAddCrew} disabled={saving || !selectedCrew}
              className={`${btnCls} bg-emerald-600 hover:bg-emerald-700`}>
              {saving ? "…" : "Add"}
            </button>
          </div>
        ) : availableCrew.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No users with Parking Crew role yet. Go to User Management → assign role first.</p>
        ) : (
          <p className="text-xs text-gray-400 italic">All parking crew members are already assigned to this lot.</p>
        )}
      </div>
    </div>
  );
}
