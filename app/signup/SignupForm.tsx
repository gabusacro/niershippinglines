"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ActionToast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/constants";

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

// ── Rate limit: max 3 attempts per 60 seconds ────────────────────────────────
const RATE_LIMIT_KEY = "signup_attempts";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 60 * 1000;

function checkRateLimit(): { allowed: boolean; secondsLeft: number } {
  if (typeof window === "undefined") return { allowed: true, secondsLeft: 0 };
  const raw = localStorage.getItem(RATE_LIMIT_KEY);
  const now = Date.now();
  let attempts: number[] = raw ? JSON.parse(raw) : [];
  attempts = attempts.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (attempts.length >= RATE_LIMIT_MAX) {
    const oldest = attempts[0];
    const secondsLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - oldest)) / 1000);
    return { allowed: false, secondsLeft };
  }
  attempts.push(now);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(attempts));
  return { allowed: true, secondsLeft: 0 };
}

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [salutation, setSalutation] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [birthdate, setBirthdate] = useState<string>("");
  const [nationality, setNationality] = useState<string>("Filipino");
  const [recoveryEmail, setRecoveryEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const age = calculateAge(birthdate);
  const strength = getPasswordStrength(password);

  // ── Countdown timer for rate limit ───────────────────────────────────────
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setTimeout(() => setRateLimitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitSeconds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsDuplicate(false);

    // ── Rate limit check ─────────────────────────────────────────────────
    const { allowed, secondsLeft } = checkRateLimit();
    if (!allowed) {
      setRateLimitSeconds(secondsLeft);
      setError(`Too many attempts. Please wait ${secondsLeft} seconds before trying again.`);
      return;
    }

    if (birthdate) {
      const a = calculateAge(birthdate);
      if (a !== null && a < 0) { setError("Invalid birthdate."); return; }
    }
    if (recoveryEmail && recoveryEmail === email) {
      setError("Recovery email must be different from your main email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

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

      // ── Duplicate email detection ────────────────────────────────────────
      // Supabase returns user with empty identities when email already exists
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setIsDuplicate(true);
        // ── Security: same friendly message regardless (no enumeration) ──
        // But since this is a ferry booking site — not a bank — we show
        // a helpful message with login/reset links. Change to generic
        // message below if you ever need stricter security.
        setError("An account with this email already exists.");
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
      toast.showSuccess("Account created! Check your email to confirm, then log in.");
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
      <div className="mt-6 rounded-xl bg-teal-50 border-2 border-teal-200 px-5 py-6 text-center space-y-2">
        <div className="text-4xl">📧</div>
        <p className="font-bold text-[#134e4a]">Check your email</p>
        <p className="text-sm text-[#0f766e]">
          We sent a confirmation link to <strong>{email}</strong>.
          Click it to activate your account, then log in.
        </p>
        <p className="text-xs text-[#0f766e]/60">Don&apos;t see it? Check your spam folder.</p>
      </div>
    );
  }

  const inputClass = "mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30";
  const labelClass = "block text-sm font-medium text-[#134e4a]";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">

      {/* ── Error message ── */}
      {error && (
        <div className="rounded-xl bg-red-50 border-2 border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">{error}</p>
          {isDuplicate && (
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <a href={ROUTES.login} className="font-bold underline text-red-700 hover:text-red-900">
                Log in instead →
              </a>
              <a href={`${ROUTES.login}?mode=forgot`} className="font-bold underline text-red-700 hover:text-red-900">
                Reset your password →
              </a>
            </p>
          )}
          {rateLimitSeconds > 0 && (
            <p className="mt-1 text-xs text-red-600">Try again in {rateLimitSeconds}s</p>
          )}
        </div>
      )}

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

      {/* Full Name */}
      <div>
        <label htmlFor="fullName" className={labelClass}>Full name <span className="text-red-600">*</span></label>
        <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required className={inputClass} />
      </div>

      {/* Gender */}
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

      {/* Birthdate */}
      <div>
        <label htmlFor="birthdate" className={labelClass}>Date of birth</label>
        <input id="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().split("T")[0]} className={inputClass} />
        {age !== null && <p className="mt-1 text-xs text-[#0f766e]">Age: {age} years old</p>}
      </div>

      {/* Nationality */}
      <div>
        <label htmlFor="nationality" className={labelClass}>Nationality</label>
        <select id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelClass}>Email <span className="text-red-600">*</span></label>
        <input id="email" type="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setIsDuplicate(false); setError(null); }}
          required autoComplete="email" className={inputClass} />
      </div>

      {/* Recovery Email */}
      <div>
        <label htmlFor="recoveryEmail" className={labelClass}>
          Recovery email <span className="text-xs text-[#0f766e] font-normal">(optional)</span>
        </label>
        <input id="recoveryEmail" type="email" value={recoveryEmail}
          onChange={(e) => setRecoveryEmail(e.target.value)}
          autoComplete="email" className={inputClass} placeholder="Backup email if you lose access" />
      </div>

      {/* Password + strength meter */}
      <div>
        <label htmlFor="password" className={labelClass}>Password <span className="text-red-600">*</span></label>
        <input id="password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          required minLength={6} autoComplete="new-password" className={inputClass} />
        {/* Strength meter */}
        {password.length > 0 && (
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
        {!password && <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>}
      </div>

      <button type="submit" disabled={loading || rateLimitSeconds > 0}
        className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target">
        {loading ? "Creating account..." : rateLimitSeconds > 0 ? `Wait ${rateLimitSeconds}s...` : "Create account"}
      </button>
    </form>
  );
}
