"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const age = calculateAge(birthdate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (birthdate) {
      const a = calculateAge(birthdate);
      if (a !== null && a < 0) {
        setError("Invalid birthdate.");
        return;
      }
    }

    if (recoveryEmail && recoveryEmail === email) {
      setError("Recovery email must be different from your main email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            salutation: salutation || null,
          },
        },
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

  const inputClass = "mt-1 block w-full rounded-lg border-2 border-teal-200 bg-white px-3 py-2 text-[#134e4a] shadow-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30";
  const labelClass = "block text-sm font-medium text-[#134e4a]";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>
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
        <label htmlFor="fullName" className={labelClass}>
          Full name <span className="text-red-600">*</span>
        </label>
        <input
          id="fullName" type="text" value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name" required className={inputClass}
        />
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
        <input
          id="birthdate" type="date" value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className={inputClass}
        />
        {age !== null && (
          <p className="mt-1 text-xs text-[#0f766e]">Age: {age} years old</p>
        )}
      </div>

      {/* Nationality */}
      <div>
        <label htmlFor="nationality" className={labelClass}>Nationality</label>
        <select id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelClass}>
          Email <span className="text-red-600">*</span>
        </label>
        <input
          id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          required autoComplete="email" className={inputClass}
        />
      </div>

      {/* Recovery Email */}
      <div>
        <label htmlFor="recoveryEmail" className={labelClass}>
          Recovery email <span className="text-xs text-[#0f766e] font-normal">(optional)</span>
        </label>
        <input
          id="recoveryEmail" type="email" value={recoveryEmail}
          onChange={(e) => setRecoveryEmail(e.target.value)}
          autoComplete="email" className={inputClass}
          placeholder="Backup email if you lose access"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className={labelClass}>
          Password <span className="text-red-600">*</span>
        </label>
        <input
          id="password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          required minLength={6} autoComplete="new-password" className={inputClass}
        />
        <p className="mt-1 text-xs text-[#0f766e]/80">At least 6 characters</p>
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors touch-target"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}


