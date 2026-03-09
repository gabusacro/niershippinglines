"use client";

import { useState } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  initialCategories: Category[];
}

export default function CategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New category form state
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(categories.length + 1);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);

  function toSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function showMsg(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 3000);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug || toSlug(newName),
          description: newDescription || null,
          sort_order: newSortOrder,
          is_active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setCategories([...categories, data.category]);
      setNewName(""); setNewSlug(""); setNewDescription("");
      setNewSortOrder(categories.length + 2);
      setShowAddForm(false);
      showMsg("Category added!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditDescription(cat.description ?? "");
    setEditSortOrder(cat.sort_order);
  }

  async function handleSaveEdit(id: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/categories/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug || toSlug(editName),
          description: editDescription || null,
          sort_order: editSortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setCategories(categories.map((c) => c.id === id ? data.category : c));
      setEditingId(null);
      showMsg("Category updated!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/categories/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCategories(categories.map((c) => c.id === id ? data.category : c));
      showMsg((!current ? "Activated" : "Deactivated") + " category!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm("Delete category \"" + name + "\"? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tours/categories/" + id, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      setCategories(categories.filter((c) => c.id !== id));
      showMsg("Category deleted!");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tour Categories</h1>
        <p className="mt-2 text-sm text-white/90">
          Manage categories used to classify tour packages.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link href="/admin/tours" className="text-sm text-emerald-600 hover:underline">
          Back to Tour Management
        </Link>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
          + Add Category
        </button>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div className={"mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
          (error ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200")}>
          {error || success}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="mt-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6">
          <h2 className="font-bold text-emerald-900 mb-4">New Category</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
              <input
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNewSlug(toSlug(e.target.value)); }}
                placeholder="e.g. Island Hopping"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="auto-generated"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !newName.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {loading ? "Adding..." : "Add Category"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className="mt-6 space-y-3">
        {sorted.map((cat) => (
          <div key={cat.id}
            className={"rounded-2xl border-2 bg-white p-5 transition-all " +
              (cat.is_active ? "border-gray-100 hover:border-emerald-200" : "border-dashed border-gray-200 opacity-60")}>

            {editingId === cat.id ? (
              // Edit mode
              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Slug</label>
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={editSortOrder}
                      onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 1)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(cat.id)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-300 w-6 text-center">{cat.sort_order}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#134e4a]">{cat.name}</p>
                      <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {cat.slug}
                      </span>
                      {!cat.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                          Inactive
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(cat)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:border-emerald-300 hover:text-emerald-700 transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(cat.id, cat.is_active)}
                    disabled={loading}
                    className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors " +
                      (cat.is_active
                        ? "border border-amber-200 text-amber-600 hover:bg-amber-50"
                        : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50")}>
                    {cat.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}