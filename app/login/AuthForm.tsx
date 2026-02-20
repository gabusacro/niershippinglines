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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const inputClass = "mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30";
  const labelClass = "block text-sm font-medium text-[#134e4a]";

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
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName.trim() || null,
            email: data.user.email ?? null,
            role: "passenger",
            mobile: mobile.trim() || null,
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
            Check your email for a link to reset your password. If you don't see it, check spam.
          </p>
          <button
            type="button"
            onClick={() => { setMode("login"); setResetSent(false); }}
            className="w-full min-h-[48px] rounded-xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors touch-target"
          >
            Back to Sign In
          </button>
        </div>
      );
    }
    return (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}
        <p className="text-sm text-[#0f766e]">Enter your email and we'll send you a link to reset your password.</p>
        <div>
          <label htmlFor="forgot-email" className={labelClass}>Email</label>
          <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
        </div>
        <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target">
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <p className="text-center text-sm text-[#0f766e]">
          <button type="button" onClick={() => setMode("login")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Back to Sign In</button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

      {/* Full Name - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="fullName" className={labelClass}>Full Name <span className="text-red-600">*</span></label>
          <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required className={inputClass} />
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelClass}>Email <span className="text-red-600">*</span></label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
      </div>

      {/* Mobile Number - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="mobile" className={labelClass}>Mobile Number <span className="text-red-600">*</span></label>
          <input
            id="mobile" type="tel" value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required placeholder="+63 912 345 6789"
            className={inputClass}
          />
        </div>
      )}

      {/* Password */}
      <div>
        <label htmlFor="password" className={labelClass}>Password <span className="text-red-600">*</span></label>
        <div className="relative">
          <input
            id="password" type={showPassword ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)}
            required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={inputClass}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0f766e]">
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </button>
        </div>
        {mode === "signup" && <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>}
      </div>

      {/* Confirm Password - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="confirmPassword" className={labelClass}>Confirm Password <span className="text-red-600">*</span></label>
          <div className="relative">
            <input
              id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required minLength={6} autoComplete="new-password"
              className={inputClass}
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0f766e]">
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
          )}
          {confirmPassword && password === confirmPassword && (
            <p className="mt-1 text-xs text-teal-600">✓ Passwords match</p>
          )}
        </div>
      )}

      {/* Forgot password link */}
      {mode === "login" && (
        <p className="text-right text-sm">
          <button type="button" onClick={() => setMode("forgot")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
            Forgot password?
          </button>
        </p>
      )}

      <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target">
        {loading ? (mode === "signup" ? "Creating account..." : "Signing in...") : (mode === "signup" ? "Create Account" : "Sign In")}
      </button>

      <p className="text-center text-sm text-[#0f766e]">
        {mode === "signup" ? (
          <>Already have an account?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Sign In</button>
          </>
        ) : (
          <>Don't have an account?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Create One</button>
          </>
        )}
      </p>
    </form>
  );
}
