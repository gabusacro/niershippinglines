"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Investor = { id: string; full_name: string | null; role: string };
type Share = { id: string; investor_id: string; share_percent: number; notes: string | null };
type Profile = { id: string; full_name: string | null; role: string };

export function InvestorSharesForm({
  initialInvestors,
  initialShares,
  allProfiles,
}: {
  initialInvestors: Investor[];
  initialShares: Share[];
  allProfiles: Profile[];
}) {
  const router = useRouter();
  const [investors, setInvestors] = useState(initialInvestors);
  const [shares, setShares] = useState(initialShares);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [promoteUserId, setPromoteUserId] = useState("");
  const [addForm, setAddForm] = useState({ investor_id: "", share_percent: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ share_percent: "", notes: "" });

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  async function handlePromote() {
    if (!promoteUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/investor-shares", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: promoteUserId, role: "investor" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const promoted = allProfiles.find((p) => p.id === promoteUserId);
      if (promoted) setInvestors((prev) => [...prev, { ...promoted, role: "investor" }]);
      setPromoteUserId("");
      flash("User promoted to Investor!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.investor_id) { flash("Select an investor.", true); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/investor-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_id: addForm.investor_id,
          share_percent: parseFloat(addForm.share_percent) || 0,
          notes: addForm.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShares((prev) => {
        const existing = prev.findIndex((s) => s.investor_id === addForm.investor_id);
        if (existing >= 0) { const next = [...prev]; next[existing] = json.share; return next; }
        return [...prev, json.share];
      });
      setAddForm({ investor_id: "", share_percent: "", notes: "" });
      flash("Share saved!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/investor-shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          share_percent: parseFloat(editForm.share_percent) || 0,
          notes: editForm.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShares((prev) => prev.map((s) => s.id === id ? json.share : s));
      setEditingId(null);
      flash("Share updated!");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this investor share?")) return;
    try {
      const res = await fetch("/api/admin/investor-shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShares((prev) => prev.filter((s) => s.id !== id));
      flash("Share removed.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed", true);
    }
  }

  const promotable = allProfiles.filter((p) => p.role !== "investor" && p.role !== "admin");
  const investorMap = new Map(investors.map((i) => [i.id, i]));
  const totalSharePercent = shares.reduce((s, i) => s + Number(i.share_percent), 0);

  return (
    <div className="space-y-8">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}

      {/* Total share summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Total Investors</p>
          <p className="mt-1.5 text-2xl font-bold text-[#134e4a]">{investors.length}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Total Share Allocated</p>
          <p className={`mt-1.5 text-2xl font-bold ${totalSharePercent > 100 ? "text-red-600" : "text-[#134e4a]"}`}>{totalSharePercent.toFixed(2)}%</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Remaining Pool</p>
          <p className={`mt-1.5 text-2xl font-bold ${100 - totalSharePercent < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{Math.max(0, 100 - totalSharePercent).toFixed(2)}%</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/70">Admin keeps remainder</p>
        </div>
      </div>

      {totalSharePercent > 100 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          ⚠ Total shares exceed 100%! Please adjust percentages.
        </div>
      )}

      {/* Step 1 — Promote user to investor */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Step 1 — Promote a user to Investor</p>
        <p className="mt-1 text-xs text-[#0f766e]/70">The user must already have an account.</p>
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
            Promote to Investor
          </button>
        </div>
      </div>

      {/* Current investors */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Current Investors ({investors.length})</p>
        {investors.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No investors yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {investors.map((i) => (
              <span key={i.id} className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm font-medium text-amber-800">
                💼 {i.full_name ?? "Unnamed"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — Set share percentage */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Step 2 — Set Investor Share %</p>
        <p className="mt-1 text-xs text-[#0f766e]/70">Each investor receives their % of the Net Platform Revenue each month.</p>
        {investors.length === 0 ? (
          <p className="mt-3 text-sm text-amber-600">⚠ No investors yet — promote a user first.</p>
        ) : (
          <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Investor</label>
              <select value={addForm.investor_id} onChange={(e) => setAddForm((f) => ({ ...f, investor_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]">
                <option value="">— Select investor —</option>
                {investors.map((i) => <option key={i.id} value={i.id}>{i.full_name ?? "Unnamed"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Share %</label>
              <input value={addForm.share_percent} onChange={(e) => setAddForm((f) => ({ ...f, share_percent: e.target.value }))}
                type="number" step="0.01" min="0" max="100" placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Notes (optional)</label>
              <input value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Silent partner"
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="w-full rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                {saving ? "Saving…" : "Save Share"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Shares table */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Investor Shares</p>
        {shares.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No shares set yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Investor</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Share %</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Notes</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {shares.map((s) => {
                  const investor = investorMap.get(s.investor_id);
                  return (
                    <tr key={s.id} className="hover:bg-teal-50/40">
                      <td className="px-4 py-3 font-medium text-[#134e4a]">💼 {investor?.full_name ?? "—"}</td>
                      {editingId === s.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input value={editForm.share_percent} onChange={(e) => setEditForm((f) => ({ ...f, share_percent: e.target.value }))}
                              type="number" step="0.01" min="0" max="100"
                              className="w-20 rounded-lg border border-teal-200 px-2 py-1 text-right text-sm outline-none focus:border-[#0c7b93]" />
                          </td>
                          <td className="px-4 py-3">
                            <input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                              className="w-full rounded-lg border border-teal-200 px-2 py-1 text-sm outline-none focus:border-[#0c7b93]" />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleEdit(s.id)} disabled={saving}
                                className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingId(null)}
                                className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">{Number(s.share_percent).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-[#0f766e]">{s.notes ?? "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => { setEditingId(s.id); setEditForm({ share_percent: String(s.share_percent), notes: s.notes ?? "" }); }}
                                className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">Edit</button>
                              <button onClick={() => handleDelete(s.id)}
                                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#134e4a]/5 font-semibold">
                  <td className="px-4 py-2 text-[#134e4a]">Total allocated</td>
                  <td className={`px-4 py-2 text-right ${totalSharePercent > 100 ? "text-red-600" : "text-amber-700"}`}>{totalSharePercent.toFixed(2)}%</td>
                  <td colSpan={2} className="px-4 py-2 text-xs text-[#0f766e]">Admin keeps {Math.max(0, 100 - totalSharePercent).toFixed(2)}% remainder</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
