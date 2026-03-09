"use client";

import { useState } from "react";
import Link from "next/link";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  tour_operator_id: string;
  tour_guide_id: string;
  is_active: boolean;
  created_at: string;
  operator: { full_name: string | null; email: string | null } | null;
  guide: { full_name: string | null; email: string | null } | null;
}

interface Props {
  operators: Profile[];
  guides: Profile[];
  assignments: Assignment[];
  adminId: string;
}

export default function TeamClient({ operators, guides, assignments, adminId }: Props) {
  const [tab, setTab] = useState<"operators" | "guides" | "assign">("operators");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  // Assign form
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Local state for live updates
  const [localOperators, setLocalOperators] = useState<Profile[]>(operators);
  const [localGuides, setLocalGuides] = useState<Profile[]>(guides);
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>(assignments);

  function showMsg(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch("/api/admin/tours/team/search?q=" + encodeURIComponent(searchQuery));
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch {
      showMsg("Search failed", true);
    } finally {
      setSearching(false);
    }
  }

  async function handleAssignRole(userId: string, role: "tour_operator" | "tour_guide") {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/team/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      const updated = data.profile as Profile;
      if (role === "tour_operator") {
        setLocalOperators((prev) => [...prev.filter((o) => o.id !== updated.id), updated].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")));
      } else {
        setLocalGuides((prev) => [...prev.filter((g) => g.id !== updated.id), updated].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")));
      }
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
      showMsg((updated.full_name ?? "User") + " assigned as " + role.replace("_", " ") + "!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveRole(userId: string, currentRole: "tour_operator" | "tour_guide") {
    if (!confirm("Remove this person's " + currentRole.replace("_", " ") + " role? They will become a regular passenger.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/team/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: "passenger" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      if (currentRole === "tour_operator") {
        setLocalOperators((prev) => prev.filter((o) => o.id !== userId));
      } else {
        setLocalGuides((prev) => prev.filter((g) => g.id !== userId));
      }
      showMsg("Role removed successfully!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkGuide() {
    if (!selectedOperatorId || !selectedGuideId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/team/link-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tour_operator_id: selectedOperatorId,
          tour_guide_id: selectedGuideId,
          assigned_by: adminId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      setLocalAssignments((prev) => [...prev, data.assignment]);
      setSelectedOperatorId("");
      setSelectedGuideId("");
      showMsg("Tour guide linked to operator!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlinkGuide(assignmentId: string) {
    if (!confirm("Unlink this tour guide from the operator?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/team/link-guide/" + assignmentId, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink");
      setLocalAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      showMsg("Tour guide unlinked!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (t: string) =>
    "px-4 py-2 rounded-xl text-sm font-semibold transition-colors " +
    (tab === t
      ? "bg-emerald-600 text-white shadow"
      : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tour Team</h1>
        <p className="mt-2 text-sm text-white/90">
          Manage tour operators and tour guides. Assign roles and link guides to operators.
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {localOperators.length} Operator{localOperators.length !== 1 ? "s" : ""}
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {localGuides.length} Guide{localGuides.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Link href="/admin/tours" className="text-sm text-emerald-600 hover:underline">
          Back to Tour Management
        </Link>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div className={"mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
          (error ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200")}>
          {error || success}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => setTab("operators")} className={tabClass("operators")}>
          Operators {localOperators.length > 0 && <span className="ml-1 text-xs opacity-70">({localOperators.length})</span>}
        </button>
        <button onClick={() => setTab("guides")} className={tabClass("guides")}>
          Tour Guides {localGuides.length > 0 && <span className="ml-1 text-xs opacity-70">({localGuides.length})</span>}
        </button>
        <button onClick={() => setTab("assign")} className={tabClass("assign")}>
          Assign Roles
        </button>
      </div>

      {/* OPERATORS TAB */}
      {tab === "operators" && (
        <div className="mt-6 space-y-4">
          {localOperators.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
              <p className="text-3xl mb-2">🏢</p>
              <p className="font-semibold text-gray-500">No tour operators yet</p>
              <p className="text-sm text-gray-400 mt-1">Use the Assign Roles tab to add operators.</p>
            </div>
          ) : (
            localOperators.map((op) => {
              const opAssignments = localAssignments.filter((a) => a.tour_operator_id === op.id);
              return (
                <div key={op.id} className="rounded-2xl border-2 border-gray-100 bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#134e4a]">{op.full_name ?? "—"}</p>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Operator</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{op.email}</p>
                      {op.mobile && <p className="text-xs text-gray-400">{op.mobile}</p>}
                    </div>
                    <button
                      onClick={() => handleRemoveRole(op.id, "tour_operator")}
                      disabled={loading}
                      className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      Remove Role
                    </button>
                  </div>

                  {/* Linked guides */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Linked Tour Guides ({opAssignments.length})
                    </p>
                    {opAssignments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No guides linked yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {opAssignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                            <span className="text-sm font-semibold text-blue-800">
                              {a.guide?.full_name ?? a.guide?.email ?? "—"}
                            </span>
                            <button
                              onClick={() => handleUnlinkGuide(a.id)}
                              disabled={loading}
                              className="text-blue-400 hover:text-red-500 transition-colors text-xs font-bold">
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* GUIDES TAB */}
      {tab === "guides" && (
        <div className="mt-6 space-y-3">
          {localGuides.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
              <p className="text-3xl mb-2">🧭</p>
              <p className="font-semibold text-gray-500">No tour guides yet</p>
              <p className="text-sm text-gray-400 mt-1">Use the Assign Roles tab to add guides.</p>
            </div>
          ) : (
            localGuides.map((guide) => {
              const guideAssignment = localAssignments.find((a) => a.tour_guide_id === guide.id);
              return (
                <div key={guide.id} className="rounded-2xl border-2 border-gray-100 bg-white p-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#134e4a]">{guide.full_name ?? "—"}</p>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Guide</span>
                      {guideAssignment ? (
                        <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                          Under: {guideAssignment.operator?.full_name ?? "—"}
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          Not assigned to operator
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{guide.email}</p>
                    {guide.mobile && <p className="text-xs text-gray-400">{guide.mobile}</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveRole(guide.id, "tour_guide")}
                    disabled={loading}
                    className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    Remove Role
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ASSIGN ROLES TAB */}
      {tab === "assign" && (
        <div className="mt-6 space-y-6">

          {/* Search users */}
          <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Find User by Name or Email</h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search name or email..."
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {searching ? "..." : "Search"}
              </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3">
                    <div>
                      <p className="font-semibold text-sm text-[#134e4a]">{u.full_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAssignRole(u.id, "tour_operator")}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        Make Operator
                      </button>
                      <button
                        onClick={() => handleAssignRole(u.id, "tour_guide")}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        Make Guide
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="mt-3 text-sm text-gray-400 text-center">No results. Try a different name or email.</p>
            )}
          </div>

          {/* Link guide to operator */}
          {localOperators.length > 0 && localGuides.length > 0 && (
            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-6">
              <h2 className="font-bold text-blue-900 mb-4">Link Tour Guide to Operator</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Tour Operator</label>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="w-full rounded-xl border border-blue-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                    <option value="">Select operator...</option>
                    {localOperators.map((op) => (
                      <option key={op.id} value={op.id}>{op.full_name ?? op.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Tour Guide</label>
                  <select
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    className="w-full rounded-xl border border-blue-200 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                    <option value="">Select guide...</option>
                    {localGuides.map((g) => (
                      <option key={g.id} value={g.id}>{g.full_name ?? g.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleLinkGuide}
                disabled={loading || !selectedOperatorId || !selectedGuideId}
                className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? "Linking..." : "Link Guide to Operator"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
