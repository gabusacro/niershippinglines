"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";

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

type Props = {
  initialData: {
    full_name: string | null;
    salutation: string | null;
    email: string | null;
    address: string | null;
    gender: string | null;
    birthdate: string | null;
    nationality: string | null;
    recovery_email: string | null;
  };
  authEmail: string;
};

export function ProfileForm({ initialData, authEmail }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [fullName, setFullName] = useState(initialData.full_name ?? "");
  const [salutation, setSalutation] = useState(initialData.salutation ?? "");
  const [gender, setGender] = useState(initialData.gender ?? "");
  const [birthdate, setBirthdate] = useState(initialData.birthdate ?? "");
  const [nationality, setNationality] = useState(initialData.nationality ?? "Filipino");
  const [address, setAddress] = useState(initialData.address ?? "");
  const [recoveryEmail, setRecoveryEmail] = useState(initialData.recovery_email ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const age = calculateAge(birthdate);

  const inputClass = "mt-1 block w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/30";
  const labelClass = "block text-sm font-medium text-[#134e4a]";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newEmail && newEmail === authEmail) {
      toast.showError("New email must be different from your current email.");
      return;
    }
    if (recoveryEmail && recoveryEmail === (newEmail || authEmail)) {
      toast.showError("Recovery email must differ from your main email.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        full_name: fullName.trim() || null,
        salutation: salutation || null,
        address: address.trim() || null,
        gender: gender || null,
        birthdate: birthdate || null,
        nationality: nationality || "Filipino",
        recovery_email: recoveryEmail.trim() || null,
      };
      if (newEmail.trim()) body.email = newEmail.trim();

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      if (newEmail.trim()) {
        toast.showSuccess("Profile saved! Check your new email inbox to confirm the email change.");
      } else {
        toast.showSuccess("Profile saved successfully!");
      }
      setNewEmail("");
      router.refresh();
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Personal Info Section */}
      <div className="rounded-xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#134e4a]">Personal information</h2>
        <p className="mt-1 text-sm text-[#0f766e]">Used on tickets and Coast Guard manifest.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Salutation</label>
            <select value={salutation} onChange={(e) => setSalutation(e.target.value)} className={inputClass}>
              <option value="">Select (optional)</option>
              <option value="Mr">Mr.</option>
              <option value="Mrs">Mrs.</option>
              <option value="Ms">Ms.</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
              <option value="">Select (optional)</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Date of birth</label>
            <input
              type="date" value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={inputClass}
            />
            {age !== null && (
              <p className="mt-1 text-xs text-[#0f766e]">Age: {age} years old</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Nationality</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="For tickets and manifest" />
          </div>
        </div>
      </div>

      {/* Email Section */}
      <div className="rounded-xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#134e4a]">Email settings</h2>
        <p className="mt-1 text-sm text-[#0f766e]">Your current email: <span className="font-semibold">{authEmail}</span></p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Change email <span className="text-xs text-[#0f766e] font-normal">(optional)</span>
            </label>
            <input
              type="email" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
              placeholder="Enter new email address"
            />
            <p className="mt-1 text-xs text-[#0f766e]/80">You will receive a confirmation link at the new email. Your old email will no longer work after confirmation.</p>
          </div>

          <div>
            <label className={labelClass}>
              Recovery email <span className="text-xs text-[#0f766e] font-normal">(optional)</span>
            </label>
            <input
              type="email" value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              className={inputClass}
              placeholder="Backup email if you lose access"
            />
          </div>
        </div>
      </div>

      <button
        type="submit" disabled={saving}
        className="w-full rounded-xl bg-[#0c7b93] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
