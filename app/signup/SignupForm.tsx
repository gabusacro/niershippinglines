"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ActionToast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [salutation, setSalutation] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim(), salutation: salutation || null } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: fullName.trim() || null,
          salutation: salutation || null,
          email: data.user.email ?? null,
          role: "crew",
        });
      }
      setSuccess(true);
      toast.showSuccess("Account created. Check your email to confirm, then log in.");
      router.refresh();
      router.push(ROUTES.login);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="mt-6 rounded-md bg-teal-100 px-3 py-2 text-sm text-teal-800">
        Account created. Check your email to confirm, then log in.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="salutation" className="block text-sm font-medium text-[#134e4a]">
          Salutation
        </label>
        <select
          id="salutation"
          value={salutation}
          onChange={(e) => setSalutation(e.target.value)}
          className="mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        >
          <option value="">Select (optional)</option>
          <option value="Mr">Mr.</option>
          <option value="Mrs">Mrs.</option>
          <option value="Ms">Ms.</option>
        </select>
      </div>
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-[#134e4a]">
          Full name <span className="text-red-600">*</span>
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
          className="mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[#134e4a]">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[#134e4a]">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
        />
        <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target"
      >
        {loading ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
