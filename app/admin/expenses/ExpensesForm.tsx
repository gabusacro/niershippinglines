"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Preset common expenses for quick add
const PRESETS = [
  { name: "Hosting (Vercel)", amount: 175000 },
  { name: "Deployment", amount: 175000 },
  { name: "IDE / Cursor", amount: 350000 },
  { name: "Domain", amount: 12500 },
  { name: "Ads / Marketing", amount: 600000 },
];

type Expense = {
  id: string;
  name: string;
  amount_cents: number;
  is_recurring: boolean;
  applies_month: number | null;
  applies_year: number | null;
};

export function ExpensesForm({ initialExpenses }: { initialExpenses: Expense[] }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New expense form state
  const [form, setForm] = useState({
    name: "",
    amount: "",
    is_recurring: true,
    applies_month: "",
    applies_year: "",
  });

  // Edit form state
  const [editForm, setEditForm] = useState<{
    name: string;
    amount: string;
    is_recurring: boolean;
    applies_month: string;
    applies_year: string;
  } | null>(null);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amount_cents = Math.round(parseFloat(form.amount) * 100);
    if (!form.name.trim() || isNaN(amount_cents) || amount_cents <= 0) {
      flash("Please enter a valid name and amount.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          amount_cents,
          is_recurring: form.is_recurring,
          applies_month: form.is_recurring ? null : (form.applies_month ? parseInt(form.applies_month) : null),
          applies_year: form.is_recurring ? null : (form.applies_year ? parseInt(form.applies_year) : null),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setExpenses((prev) => [...prev, json.expense]);
      setForm({ name: "", amount: "", is_recurring: true, applies_month: "", applies_year: "" });
      flash("Expense added!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed to add expense", true);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setEditForm({
      name: exp.name,
      amount: (exp.amount_cents / 100).toFixed(2),
      is_recurring: exp.is_recurring,
      applies_month: exp.applies_month ? String(exp.applies_month) : "",
      applies_year: exp.applies_year ? String(exp.applies_year) : "",
    });
  }

  async function handleEdit(id: string) {
    if (!editForm) return;
    const amount_cents = Math.round(parseFloat(editForm.amount) * 100);
    if (!editForm.name.trim() || isNaN(amount_cents) || amount_cents <= 0) {
      flash("Please enter a valid name and amount.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editForm.name.trim(),
          amount_cents,
          is_recurring: editForm.is_recurring,
          applies_month: editForm.is_recurring ? null : (editForm.applies_month ? parseInt(editForm.applies_month) : null),
          applies_year: editForm.is_recurring ? null : (editForm.applies_year ? parseInt(editForm.applies_year) : null),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setExpenses((prev) => prev.map((e) => e.id === id ? json.expense : e));
      setEditingId(null);
      setEditForm(null);
      flash("Expense updated!");
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed to update", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      flash("Expense deleted.");
      router.refresh();
    } catch {
      flash("Failed to delete expense.", true);
    } finally {
      setDeleting(null);
    }
  }

  function applyPreset(preset: { name: string; amount: number }) {
    setForm((f) => ({ ...f, name: preset.name, amount: (preset.amount / 100).toFixed(2) }));
  }

  const recurringExpenses = expenses.filter((e) => e.is_recurring);
  const oneTimeExpenses = expenses.filter((e) => !e.is_recurring);
  const recurringTotal = recurringExpenses.reduce((s, e) => s + e.amount_cents, 0);
  const oneTimeTotal = oneTimeExpenses.reduce((s, e) => s + e.amount_cents, 0);

  function peso(cents: number) {
    return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-8">

      {/* Flash messages */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">Monthly Recurring</p>
          <p className="mt-1.5 text-xl font-bold text-[#134e4a]">{peso(recurringTotal)}</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/70">{recurringExpenses.length} expense{recurringExpenses.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">One-Time This Month</p>
          <p className="mt-1.5 text-xl font-bold text-[#134e4a]">{peso(oneTimeTotal)}</p>
          <p className="mt-0.5 text-xs text-[#0f766e]/70">{oneTimeExpenses.length} expense{oneTimeExpenses.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Total Monthly Expenses</p>
          <p className="mt-1.5 text-xl font-bold text-rose-700">{peso(recurringTotal + oneTimeTotal)}</p>
          <p className="mt-0.5 text-xs text-rose-500">Deducted from Platform Revenue</p>
        </div>
      </div>

      {/* Quick presets */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Quick add — common expenses</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => applyPreset(p)}
              className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0c7b93] hover:bg-teal-50">
              {p.name} — ₱{(p.amount / 100).toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* Add expense form */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Add expense</p>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hosting (Vercel)"
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93] focus:ring-1 focus:ring-[#0c7b93]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134e4a]">Amount (₱)</label>
              <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                type="number" step="0.01" min="0" placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93] focus:ring-1 focus:ring-[#0c7b93]" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                className="h-4 w-4 rounded border-teal-300 text-[#0c7b93]" />
              <span className="text-sm text-[#134e4a]">Recurring every month</span>
            </label>
          </div>

          {!form.is_recurring && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#134e4a]">Applies Month</label>
                <select value={form.applies_month} onChange={(e) => setForm((f) => ({ ...f, applies_month: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93]">
                  <option value="">— Any month —</option>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#134e4a]">Applies Year</label>
                <input value={form.applies_year} onChange={(e) => setForm((f) => ({ ...f, applies_year: e.target.value }))}
                  type="number" placeholder={String(new Date().getFullYear())}
                  className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm text-[#134e4a] outline-none focus:border-[#0c7b93] focus:ring-1 focus:ring-[#0c7b93]" />
              </div>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
            {saving ? "Adding…" : "Add expense"}
          </button>
        </form>
      </div>

      {/* Recurring expenses list */}
      <div>
        <p className="text-sm font-semibold text-[#134e4a]">Monthly recurring expenses</p>
        {recurringExpenses.length === 0 ? (
          <p className="mt-2 text-sm text-[#0f766e]/70">No recurring expenses yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Name</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Amount/Month</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {recurringExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-teal-50/40">
                    {editingId === exp.id && editForm ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editForm.name} onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                            className="w-full rounded-lg border border-teal-200 px-2 py-1 text-sm outline-none focus:border-[#0c7b93]" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editForm.amount} onChange={(e) => setEditForm((f) => f ? { ...f, amount: e.target.value } : f)}
                            type="number" step="0.01" className="w-full rounded-lg border border-teal-200 px-2 py-1 text-sm outline-none focus:border-[#0c7b93] text-right" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleEdit(exp.id)} disabled={saving}
                              className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">Save</button>
                            <button onClick={() => { setEditingId(null); setEditForm(null); }}
                              className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-medium text-[#134e4a]">{exp.name}</td>
                        <td className="px-4 py-2 text-right text-rose-600 font-semibold">{peso(exp.amount_cents)}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => startEdit(exp)} className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">Edit</button>
                            <button onClick={() => handleDelete(exp.id)} disabled={deleting === exp.id}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                              {deleting === exp.id ? "…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#134e4a]/5 font-semibold">
                  <td className="px-4 py-2 text-[#134e4a]">Total</td>
                  <td className="px-4 py-2 text-right text-rose-700">{peso(recurringTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* One-time expenses list */}
      {oneTimeExpenses.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-[#134e4a]">One-time expenses</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-teal-100 text-sm">
              <thead>
                <tr className="bg-[#0c7b93]/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Applies</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {oneTimeExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-teal-50/40">
                    {editingId === exp.id && editForm ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editForm.name} onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                            className="w-full rounded-lg border border-teal-200 px-2 py-1 text-sm outline-none focus:border-[#0c7b93]" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <select value={editForm.applies_month} onChange={(e) => setEditForm((f) => f ? { ...f, applies_month: e.target.value } : f)}
                              className="rounded-lg border border-teal-200 px-2 py-1 text-xs outline-none focus:border-[#0c7b93]">
                              <option value="">Any</option>
                              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                            <input value={editForm.applies_year} onChange={(e) => setEditForm((f) => f ? { ...f, applies_year: e.target.value } : f)}
                              type="number" placeholder="Year" className="w-20 rounded-lg border border-teal-200 px-2 py-1 text-xs outline-none focus:border-[#0c7b93]" />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input value={editForm.amount} onChange={(e) => setEditForm((f) => f ? { ...f, amount: e.target.value } : f)}
                            type="number" step="0.01" className="w-full rounded-lg border border-teal-200 px-2 py-1 text-sm outline-none focus:border-[#0c7b93] text-right" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleEdit(exp.id)} disabled={saving}
                              className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">Save</button>
                            <button onClick={() => { setEditingId(null); setEditForm(null); }}
                              className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-medium text-[#134e4a]">{exp.name}</td>
                        <td className="px-4 py-2 text-[#0f766e]">
                          {exp.applies_month ? MONTH_NAMES[exp.applies_month - 1] : "Any"}{exp.applies_year ? ` ${exp.applies_year}` : ""}
                        </td>
                        <td className="px-4 py-2 text-right text-rose-600 font-semibold">{peso(exp.amount_cents)}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => startEdit(exp)} className="rounded-lg border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">Edit</button>
                            <button onClick={() => handleDelete(exp.id)} disabled={deleting === exp.id}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                              {deleting === exp.id ? "…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#134e4a]/5 font-semibold">
                  <td className="px-4 py-2 text-[#134e4a]" colSpan={2}>Total</td>
                  <td className="px-4 py-2 text-right text-rose-700">{peso(oneTimeTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
