"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ActionToast";

export function ChangePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.showError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.showError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.showSuccess("Password updated. Use your new password next time you sign in.");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-4 rounded-xl border-2 border-teal-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#134e4a]">Change password</h2>
      <p className="text-sm text-[#0f766e]">
        Set a new password for your account. You will use it the next time you sign in.
      </p>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-[#134e4a]">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          placeholder="At least 6 characters"
          required
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-[#134e4a]">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          placeholder="Same as above"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
