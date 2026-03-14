"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ActionToast";

// ── Role → dashboard redirect ─────────────────────────────────────────────────
function getDashboardForRole(role: string | null): string {
  switch (role) {
    case "admin":         return "/admin";
    case "vessel_owner":  return "/dashboard/vessel-owner";
    case "investor":      return "/dashboard/investor";
    case "tour_operator": return "/dashboard/tour-operator";
    case "tour_guide":    return "/dashboard/tour-guide";
    case "ticket_booth":  return "/dashboard";
    case "passenger":     return "/dashboard";
    default:              return "/dashboard";
  }
}

// ── Password strength ─────────────────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-400" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

export function ChangePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(newPassword);

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

      // ── Update password ───────────────────────────────────────────────────
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.showSuccess("Password updated! Redirecting to your dashboard...");
      setNewPassword("");
      setConfirmPassword("");

      // ── Read role → redirect to correct dashboard ─────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        router.push(getDashboardForRole(profile?.role ?? null));
        router.refresh();
      } else {
        router.push("/dashboard");
        router.refresh();
      }

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

      {/* New password + strength meter */}
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-[#134e4a]">
          New password
        </label>
        <input
          id="new-password" type="password" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6} autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          placeholder="At least 6 characters" required
        />
        {/* Strength meter */}
        {newPassword.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                  strength.score >= i ? strength.color : "bg-gray-200"
                }`} />
              ))}
            </div>
            <p className={`text-xs font-semibold ${
              strength.label === "Weak" ? "text-red-500" :
              strength.label === "Fair" ? "text-amber-500" :
              strength.label === "Good" ? "text-blue-500" : "text-emerald-600"
            }`}>
              {strength.label}
              {strength.label === "Weak" && " — add uppercase, numbers, or symbols"}
              {strength.label === "Fair" && " — try making it longer"}
              {strength.label === "Good" && " — almost there!"}
              {strength.label === "Strong" && " — great password ✓"}
            </p>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-[#134e4a]">
          Confirm new password
        </label>
        <input
          id="confirm-password" type="password" value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6} autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-teal-200 px-4 py-2.5 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          placeholder="Same as above" required
        />
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
        )}
        {confirmPassword && newPassword === confirmPassword && (
          <p className="mt-1 text-xs text-emerald-600">✓ Passwords match</p>
        )}
      </div>

      <button type="submit" disabled={submitting}
        className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
