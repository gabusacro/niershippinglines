"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";

type Mode = "login" | "signup" | "forgot";

export function AuthForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const emailParam = searchParams.get("email");
  const refParam = searchParams.get("ref");
  const [mode, setMode] = useState<Mode>(modeParam === "signup" ? "signup" : "login");
  const [email, setEmail] = useState(typeof emailParam === "string" ? emailParam.trim() : "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [salutation, setSalutation] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${ROUTES.account}?reset=1`)}` : undefined,
        });
        if (resetError) {
          const msg = /rate limit|too many requests/i.test(resetError.message)
            ? "Too many reset requests. Please wait an hour and try again."
            : resetError.message;
          setError(msg);
          return;
        }
        setResetSent(true);
        toast.showSuccess("Password reset email sent. Check your inbox.");
        return;
      }
      if (mode === "signup") {
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
            role: "passenger",
          });
        }
        setSuccess(true);
        toast.showSuccess("Account created. Check your email to confirm, then sign in.");
        router.refresh();
        if (refParam) router.push(`${ROUTES.login}?ref=${encodeURIComponent(refParam)}`);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        toast.showSuccess("Signed in successfully");
        const next = refParam ? `${ROUTES.dashboard}?ref=${encodeURIComponent(refParam)}` : ROUTES.dashboard;
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="mt-6 rounded-md bg-teal-100 px-3 py-2 text-sm text-teal-800">
        Account created. Check your email to confirm, then sign in below.
      </p>
    );
  }

  if (mode === "forgot") {
    if (resetSent) {
      return (
        <div className="mt-6 space-y-4">
          <p className="rounded-md bg-teal-100 px-3 py-2 text-sm text-teal-800">
            Check your email for a link to reset your password. If you don’t see it, check spam.
          </p>
          <button
            type="button"
            onClick={() => { setMode("login"); setResetSent(false); }}
            className="w-full min-h-[48px] rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors touch-target"
          >
            Back to sign in
          </button>
        </div>
      );
    }
    return (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>
        )}
        <p className="text-sm text-[#0f766e]">
          Enter your email and we’ll send you a link to reset your password.
        </p>
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-[#134e4a]">Email</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className="w-full text-sm font-semibold text-[#0c7b93] underline hover:text-[#0f766e]"
        >
          ← Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {refParam && mode === "signup" && (
        <p className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your booking <strong className="font-mono">{refParam}</strong> was created. Create an account with the same email to upload payment proof, get notifications, and manage your trip.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {mode === "signup" && (
        <>
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
        </>
      )}
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
        <div className="relative mt-1">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="block w-full rounded-lg border-2 border-teal-200 bg-white py-2 pl-3 pr-10 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#0f766e] hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30"
            title={showPassword ? "Hide password" : "Show password"}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        {mode === "signup" && (
          <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>
        )}
        {mode === "login" && (
          <p className="mt-1 text-right">
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm font-semibold text-[#0c7b93] underline hover:text-[#0f766e]"
            >
              Forgot password?
            </button>
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target"
      >
        {loading
          ? mode === "signup"
            ? "Creating account…"
            : "Signing in…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
      <p className="text-center text-sm text-[#0f766e]">
        {mode === "login" ? (
          <>
            No account?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]"
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}
