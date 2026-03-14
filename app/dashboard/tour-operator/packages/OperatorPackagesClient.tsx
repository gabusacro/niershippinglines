"use client";

import { useState } from "react";

type AdminPackage = {
  id: string;
  title: string;
  short_description: string;
  joiner_price_cents: number;
  is_active: boolean;
};

type MyPackage = {
  id: string;
  title: string;
  short_description: string;
  description: string;
  joiner_price_cents: number;
  private_price_cents: number;
  private_is_negotiable: boolean;
  pickup_time_label: string;
  end_time_label: string;
  duration_label: string;
  meeting_point: string;
  cancellation_policy: string;
  is_active: boolean;
  approval_status: string;
  approval_note: string | null;
  accepts_joiners: boolean;
  accepts_private: boolean;
  created_at: string;
};

interface Props {
  operatorId: string;
  operatorName: string;
  adminPackages: AdminPackage[];
  myPackages: MyPackage[];
  markupCents: number;
}

const emptyForm = {
  title: "",
  short_description: "",
  description: "",
  joiner_price_cents: 0,
  private_price_cents: 0,
  private_is_negotiable: false,
  pickup_time_label: "",
  end_time_label: "",
  duration_label: "",
  meeting_point: "",
  cancellation_policy: "",
  accepts_joiners: true,
  accepts_private: false,
  is_active: true,
};

type FormState = typeof emptyForm;

const statusBadge: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

const statusLabel: Record<string, string> = {
  pending:  "⏳ Pending Approval",
  approved: "✅ Approved",
  rejected: "❌ Rejected",
};

export default function OperatorPackagesClient({
  operatorId, operatorName, adminPackages, myPackages, markupCents,
}: Props) {
  const [packages, setPackages] = useState<MyPackage[]>(myPackages);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const markupPesos = markupCents / 100;

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(pkg: MyPackage) {
    setForm({
      title: pkg.title,
      short_description: pkg.short_description,
      description: pkg.description,
      joiner_price_cents: pkg.joiner_price_cents,
      private_price_cents: pkg.private_price_cents,
      private_is_negotiable: pkg.private_is_negotiable,
      pickup_time_label: pkg.pickup_time_label,
      end_time_label: pkg.end_time_label,
      duration_label: pkg.duration_label,
      meeting_point: pkg.meeting_point,
      cancellation_policy: pkg.cancellation_policy,
      accepts_joiners: pkg.accepts_joiners,
      accepts_private: pkg.accepts_private,
      is_active: pkg.is_active,
    });
    setEditingId(pkg.id);
    setShowForm(true);
    setError("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.cancellation_policy.trim()) { setError("Cancellation policy is required."); return; }
    if (form.accepts_joiners && form.joiner_price_cents <= 0) { setError("Joiner price is required."); return; }

    setSaving(true); setError("");
    try {
      const url = editingId
        ? `/api/dashboard/tour-operator/packages/${editingId}`
        : "/api/dashboard/tour-operator/packages";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      if (editingId) {
        setPackages(prev => prev.map(p => p.id === editingId ? { ...p, ...form, approval_status: "pending", approval_note: null } : p));
        setSuccess("Package updated! Pending admin approval.");
      } else {
        setPackages(prev => [{
          id: data.id,
          ...form,
          approval_status: "pending",
          approval_note: null,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setSuccess("Package submitted for admin approval!");
      }
      closeForm();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/dashboard/tour-operator/packages/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPackages(prev => prev.filter(p => p.id !== id));
        setSuccess("Package deleted.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Tour Operator</p>
        <h1 className="mt-1 font-bold text-2xl">My Tour Packages</h1>
        <p className="mt-1 text-sm text-white/70">Add your own packages. Admin reviews and approves before they go live.</p>
        <div className="mt-3 rounded-xl bg-white/10 px-4 py-2 inline-flex items-center gap-2">
          <span className="text-xs text-white/70">Admin markup per pax:</span>
          <span className="font-bold text-white">+₱{markupPesos.toLocaleString()}</span>
          <span className="text-xs text-white/60">added to your price for guests</span>
        </div>
      </div>

      {/* Toast */}
      {success && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700">
          ✅ {success}
        </div>
      )}

      {/* Admin Packages reference */}
      {adminPackages.length > 0 && (
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-5 mb-5">
          <h2 className="font-bold text-[#134e4a] mb-1">📋 Admin Packages (Reference)</h2>
          <p className="text-xs text-gray-400 mb-3">These are Travela Siargao packages. You can be assigned bookings from these.</p>
          <div className="space-y-2">
            {adminPackages.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#134e4a]">{p.title}</p>
                  {p.short_description && <p className="text-xs text-gray-400">{p.short_description}</p>}
                </div>
                {p.joiner_price_cents > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Guest pays</p>
                    <p className="text-sm font-bold text-emerald-700">
                      ₱{((p.joiner_price_cents + markupCents) / 100).toLocaleString()}/pax
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Packages */}
      <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">My Packages ({packages.length})</h2>
          <button onClick={openNew}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold transition-colors">
            + Add Package
          </button>
        </div>

        {packages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-sm font-semibold text-gray-500">No packages yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first package and submit for admin approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-sm text-[#134e4a]">{pkg.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge[pkg.approval_status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabel[pkg.approval_status] ?? pkg.approval_status}
                      </span>
                    </div>
                    {pkg.short_description && (
                      <p className="text-xs text-gray-400">{pkg.short_description}</p>
                    )}
                    {pkg.approval_note && pkg.approval_status === "rejected" && (
                      <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                        <p className="text-xs font-semibold text-red-700">Admin note: {pkg.approval_note}</p>
                      </div>
                    )}
                    <div className="flex gap-3 mt-2 flex-wrap">
                      {pkg.accepts_joiners && pkg.joiner_price_cents > 0 && (
                        <div>
                          <p className="text-xs text-gray-400">Your price</p>
                          <p className="text-sm font-bold text-[#134e4a]">₱{(pkg.joiner_price_cents / 100).toLocaleString()}/pax</p>
                        </div>
                      )}
                      {pkg.accepts_joiners && pkg.joiner_price_cents > 0 && (
                        <div>
                          <p className="text-xs text-gray-400">Guest pays</p>
                          <p className="text-sm font-bold text-emerald-700">₱{((pkg.joiner_price_cents + markupCents) / 100).toLocaleString()}/pax</p>
                        </div>
                      )}
                      {pkg.duration_label && (
                        <div>
                          <p className="text-xs text-gray-400">Duration</p>
                          <p className="text-xs font-semibold text-gray-600">{pkg.duration_label}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(pkg)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(pkg.id, pkg.title)}
                      disabled={deleting === pkg.id}
                      className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
                      {deleting === pkg.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PACKAGE FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#134e4a]">{editingId ? "Edit Package" : "New Package"}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-semibold">
                  {error}
                </div>
              )}

              {/* Markup info */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-700">
                  ℹ️ Admin adds ₱{markupPesos}/pax markup on top of your price.
                  If you set ₱1,000/pax → guests pay ₱{(1000 + markupPesos).toLocaleString()}/pax.
                </p>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Basic Info</h3>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Package Title *</label>
                  <input value={form.title} onChange={e => setField("title", e.target.value)}
                    placeholder="e.g. Island Hopping Tour"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Short Description</label>
                  <input value={form.short_description} onChange={e => setField("short_description", e.target.value)}
                    placeholder="e.g. Naked Island · Daku · Guyam with boodle fight"
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Description</label>
                  <textarea value={form.description} onChange={e => setField("description", e.target.value)}
                    rows={3} placeholder="Describe what guests will experience..."
                    className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Pickup Time</label>
                    <input value={form.pickup_time_label} onChange={e => setField("pickup_time_label", e.target.value)}
                      placeholder="e.g. 7:45–8:00 AM"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">End Time</label>
                    <input value={form.end_time_label} onChange={e => setField("end_time_label", e.target.value)}
                      placeholder="e.g. 4:30–5:00 PM"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Duration</label>
                    <input value={form.duration_label} onChange={e => setField("duration_label", e.target.value)}
                      placeholder="e.g. Full day (~8-9 hours)"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Point</label>
                    <input value={form.meeting_point} onChange={e => setField("meeting_point", e.target.value)}
                      placeholder="e.g. General Luna area"
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Booking Types */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Booking Type & Pricing</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.accepts_joiners}
                      onChange={e => setField("accepts_joiners", e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600" />
                    <span className="text-sm font-semibold text-gray-700">Accepts Joiners</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.accepts_private}
                      onChange={e => setField("accepts_private", e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600" />
                    <span className="text-sm font-semibold text-gray-700">Accepts Private</span>
                  </label>
                </div>

                {form.accepts_joiners && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Your Joiner Price (₱/pax) *
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} step={50}
                        value={form.joiner_price_cents / 100 || ""}
                        onChange={e => setField("joiner_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                        placeholder="e.g. 1000"
                        className="w-36 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                      {form.joiner_price_cents > 0 && (
                        <span className="text-xs text-emerald-600 font-semibold">
                          → Guest pays ₱{((form.joiner_price_cents + markupCents) / 100).toLocaleString()}/pax
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {form.accepts_private && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Private Price (₱/group)
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} step={100}
                        value={form.private_price_cents / 100 || ""}
                        onChange={e => setField("private_price_cents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                        placeholder="Leave blank if negotiable"
                        className="w-36 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.private_is_negotiable}
                          onChange={e => setField("private_is_negotiable", e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600" />
                        <span className="text-xs text-gray-600">Negotiable</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancellation Policy — REQUIRED */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cancellation Policy *
                </label>
                <textarea value={form.cancellation_policy}
                  onChange={e => setField("cancellation_policy", e.target.value)}
                  rows={3}
                  placeholder="e.g. Full refund if cancelled 48 hours before tour date. No refund for no-shows."
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                <p className="text-xs text-gray-400 mt-1">Required — guests will see this before booking.</p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button onClick={() => setField("is_active", !form.is_active)}
                  className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                    (form.is_active ? "bg-emerald-500" : "bg-gray-200")}>
                  <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow " +
                    (form.is_active ? "translate-x-6" : "translate-x-1")} />
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {editingId && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700">
                    ⚠️ Editing will reset approval status to Pending. Admin will need to re-approve.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={closeForm}
                className="px-5 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
