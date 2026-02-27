"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AppRole = "admin" | "captain" | "crew" | "ticket_booth" | "passenger" | "vessel_owner" | "investor";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  approved_at: string | null;
  mobile: string | null;
  address: string | null;
  booking_count: number;
}

interface Props {
  users: UserRow[];
  currentUserId: string;
}

const ROLE_OPTIONS: AppRole[] = [
  "passenger", "crew", "captain", "ticket_booth",
  "vessel_owner", "investor", "admin",
];

const ROLE_STYLES: Record<string, string> = {
  admin:        "bg-red-100 text-red-800",
  captain:      "bg-[#0c7b93]/15 text-[#0c7b93]",
  crew:         "bg-teal-100 text-teal-800",
  ticket_booth: "bg-purple-100 text-purple-800",
  vessel_owner: "bg-amber-100 text-amber-800",
  investor:     "bg-green-100 text-green-800",
  passenger:    "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin:        "Admin",
  captain:      "Captain",
  crew:         "Deck Crew",
  ticket_booth: "Ticket Booth",
  vessel_owner: "Vessel Owner",
  investor:     "Investor",
  passenger:    "Passenger",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function UserManagementClient({ users, currentUserId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  // Track recently promoted vessel owners to show assign-vessel banner
  const [vesselOwnerPromoted, setVesselOwnerPromoted] = useState<{ id: string; name: string | null } | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = filterRole === "all" || u.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, search, filterRole]);

  const handleRoleChange = async (userId: string, newRole: AppRole, userName: string | null) => {
    if (userId === currentUserId && newRole !== "admin") {
      if (!confirm("You're about to change your own role. This may lock you out of the admin panel. Continue?")) return;
    }
    setChangingRole(userId);
    setError("");
    setVesselOwnerPromoted(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update role."); return; }

      // Show assign-vessel reminder when promoting to vessel_owner
      if (newRole === "vessel_owner") {
        setVesselOwnerPromoted({ id: userId, name: userName });
      }

      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setChangingRole(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-xl border border-teal-200 px-4 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]"
        >
          <option value="all">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Vessel Owner assignment reminder banner — appears after promoting a user */}
      {vesselOwnerPromoted && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-900">
              🚢 {vesselOwnerPromoted.name ?? "This user"} is now a Vessel Owner
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Role saved — but they need a <strong>vessel assigned</strong> before their dashboard shows any data.
              Go to <strong>Vessel Owners</strong> to assign a vessel and set their patronage bonus %.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin/vessel-owners"
              className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Assign Vessel →
            </Link>
            <button
              type="button"
              onClick={() => setVesselOwnerPromoted(null)}
              className="text-amber-600 hover:text-amber-800 text-lg font-bold px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* User count */}
      <p className="text-xs text-[#0f766e]">
        Showing {filtered.length} of {users.length} users
      </p>

      {/* Table — desktop */}
      <div className="hidden md:block rounded-2xl border border-teal-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-teal-50/80 border-b border-teal-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Bookings</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Joined</th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#0f766e]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#0f766e]/60">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className={`hover:bg-teal-50/30 transition-colors ${u.id === currentUserId ? "bg-amber-50/30" : ""}`}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#134e4a]">
                      {u.full_name ?? <span className="italic text-gray-400">No name</span>}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </p>
                    <p className="text-xs text-[#0f766e] mt-0.5">{u.email ?? "—"}</p>
                    {u.mobile && <p className="text-xs text-[#0f766e]/60">{u.mobile}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLES[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    {/* Persistent reminder for all vessel owners without vessel assignments */}
                    {u.role === "vessel_owner" && (
                      <Link href="/admin/vessel-owners" className="block mt-1 text-xs text-amber-600 hover:underline font-medium">
                        🚢 Manage vessel →
                      </Link>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-[#134e4a] font-medium">{u.booking_count}</span>
                    <span className="text-xs text-[#0f766e]/60 ml-1">booking{u.booking_count !== 1 ? "s" : ""}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#0f766e]">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole, u.full_name)}
                        disabled={changingRole === u.id}
                        className="rounded-lg border border-teal-200 px-2.5 py-1.5 text-xs text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93] disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      {changingRole === u.id && (
                        <span className="text-xs text-[#0f766e] animate-pulse">Saving…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className="text-xs text-[#0c7b93] hover:underline font-medium"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${u.id === currentUserId ? "border-amber-200" : "border-teal-200"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#134e4a]">
                  {u.full_name ?? <span className="italic text-gray-400">No name</span>}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </p>
                <p className="text-xs text-[#0f766e]">{u.email}</p>
                <p className="text-xs text-[#0f766e]/60 mt-1">Joined {formatDate(u.created_at)} · {u.booking_count} booking{u.booking_count !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLES[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                {u.role === "vessel_owner" && (
                  <Link href="/admin/vessel-owners" className="block mt-1 text-xs text-amber-600 hover:underline font-medium">
                    🚢 Manage vessel →
                  </Link>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole, u.full_name)}
                disabled={changingRole === u.id}
                className="flex-1 rounded-xl border border-teal-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-[#0c7b93] disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {changingRole === u.id && <span className="text-xs text-[#0f766e] animate-pulse">Saving…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

// ─── User Detail Modal ─────────────────────────────────────────────────────────

function UserDetailModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-teal-100">
        <div className="border-b border-teal-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-bold text-[#134e4a]">User Profile</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1">×</button>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center text-lg font-bold text-[#0c7b93]">
              {user.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-[#134e4a]">{user.full_name ?? "No name"}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_STYLES[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-teal-50/50 border border-teal-100 divide-y divide-teal-100">
            {[
              { label: "Email", value: user.email },
              { label: "Mobile", value: user.mobile },
              { label: "Address", value: user.address },
              { label: "Joined", value: formatDate(user.created_at) },
              { label: "Bookings", value: `${user.booking_count} booking${user.booking_count !== 1 ? "s" : ""}` },
              { label: "User ID", value: user.id.slice(0, 8) + "…" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-[#0f766e] font-medium">{label}</span>
                <span className="text-[#134e4a] text-right">{value ?? <span className="italic text-gray-400">Not set</span>}</span>
              </div>
            ))}
          </div>

          {/* Vessel owner: shortcut to vessel assignment page */}
          {user.role === "vessel_owner" && (
            <Link
              href="/admin/vessel-owners"
              onClick={onClose}
              className="flex items-center justify-center w-full min-h-[44px] rounded-xl border-2 border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              🚢 Manage Vessel Assignment →
            </Link>
          )}

          <button type="button" onClick={onClose}
            className="w-full min-h-[44px] rounded-xl border-2 border-teal-200 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
