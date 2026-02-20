"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";

type Mode = "login" | "signup" | "forgot";

const COUNTRIES = [
  "Filipino",
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", "Armenian", "Australian", "Austrian",
  "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese",
  "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "Bruneian", "Bulgarian", "Burkinabe", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese",
  "Colombian", "Comorian", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian",
  "Dominican", "Dutch", "East Timorese", "Ecuadorian", "Egyptian", "Emirati", "Equatorial Guinean", "Eritrean",
  "Estonian", "Ethiopian", "Fijian", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian",
  "Greek", "Grenadian", "Guatemalan", "Guinean", "Guinea-Bissauan", "Guyanese", "Haitian", "Honduran", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican",
  "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Korean", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese",
  "Liberian", "Libyan", "Liechtenstein", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian",
  "Malaysian", "Maldivian", "Malian", "Maltese", "Mauritanian", "Mauritian", "Mexican", "Moldovan", "Monegasque",
  "Mongolian", "Montenegrin", "Moroccan", "Mozambican", "Namibian", "Nepali", "New Zealander", "Nicaraguan", "Nigerian",
  "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish",
  "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "Saudi Arabian",
  "Senegalese", "Serbian", "Sierra Leonean", "Singaporean", "Slovak", "Slovenian", "Somali", "South African",
  "South Sudanese", "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swazi", "Swedish", "Swiss", "Syrian",
  "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Trinidadian", "Tunisian", "Turkish", "Turkmen", "Ugandan",
  "Ukrainian", "Uruguayan", "Uzbek", "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean",
];

function calculateAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

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
  const [gender, setGender] = useState<string>("");
  const [birthdate, setBirthdate] = useState<string>("");
  const [nationality, setNationality] = useState<string>("Filipino");
  const [recoveryEmail, setRecoveryEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const age = calculateAge(birthdate);

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
        if (recoveryEmail && recoveryEmail === email) {
          setError("Recovery email must be different from your main email.");
          return;
        }
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
            gender: gender || null,
            birthdate: birthdate || null,
            nationality: nationality || "Filipino",
            recovery_email: recoveryEmail.trim() || null,
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
            Back to sign in
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
          <button type="button" onClick={() => setMode("login")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Back to sign in</button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

      {/* Salutation */}
      <div>
        <label htmlFor="salutation" className={labelClass}>Salutation</label>
        <select id="salutation" value={salutation} onChange={(e) => setSalutation(e.target.value)} className={inputClass}>
          <option value="">Select (optional)</option>
          <option value="Mr">Mr.</option>
          <option value="Mrs">Mrs.</option>
          <option value="Ms">Ms.</option>
        </select>
      </div>

      {/* Full Name - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="fullName" className={labelClass}>Full name <span className="text-red-600">*</span></label>
          <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required className={inputClass} />
        </div>
      )}

      {/* Gender - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="gender" className={labelClass}>Gender</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
            <option value="">Select (optional)</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
      )}

      {/* Birthdate - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="birthdate" className={labelClass}>Date of birth</label>
          <input
            id="birthdate" type="date" value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className={inputClass}
          />
          {age !== null && <p className="mt-1 text-xs text-[#0f766e]">Age: {age} years old</p>}
        </div>
      )}

      {/* Nationality - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="nationality" className={labelClass}>Nationality</label>
          <select id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelClass}>Email <span className="text-red-600">*</span></label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
      </div>

      {/* Recovery Email - signup only */}
      {mode === "signup" && (
        <div>
          <label htmlFor="recoveryEmail" className={labelClass}>
            Recovery email <span className="text-xs text-[#0f766e] font-normal">(optional)</span>
          </label>
          <input
            id="recoveryEmail" type="email" value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            className={inputClass} placeholder="Backup email if you lose access"
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
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {mode === "signup" && <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>}
      </div>

      {/* Forgot password link */}
      {mode === "login" && (
        <p className="text-right text-sm">
          <button type="button" onClick={() => setMode("forgot")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
            Forgot password?
          </button>
        </p>
      )}

      <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target">
        {loading ? (mode === "signup" ? "Creating account..." : "Signing in...") : (mode === "signup" ? "Create account" : "Sign in")}
      </button>

      <p className="text-center text-sm text-[#0f766e]">
        {mode === "signup" ? (
          <>Already have an account?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Sign in</button>
          </>
        ) : (
          <>Don't have an account?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Create one</button>
          </>
        )}
      </p>
    </form>
  );
}