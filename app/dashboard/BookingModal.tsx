"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { formatTime, passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";

const TERMS_VERSION = "1.0";

const FARE_TYPE_OPTIONS = [
  { value: "adult",   label: "Adult"       },
  { value: "senior",  label: "Senior"      },
  { value: "pwd",     label: "PWD"         },
  { value: "student", label: "Student"     },
  { value: "child",   label: "Child"       },
  { value: "infant",  label: "Infant (<2)" },
] as const;
type FareTypeValue = typeof FARE_TYPE_OPTIONS[number]["value"];

const NATIONALITIES = ["Filipino","American","Australian","British","Canadian","Chinese",
  "French","German","Japanese","Korean","Singaporean","Other"];
const GENDERS = ["Male","Female","Other"];

// ── Passenger box color palette (cycles per slot) ──
const PAX_COLORS = [
  { border: "border-l-blue-500",   bg: "bg-blue-50/60",   badge: "bg-blue-500",   label: "text-blue-700"   },
  { border: "border-l-violet-500", bg: "bg-violet-50/60", badge: "bg-violet-500", label: "text-violet-700" },
  { border: "border-l-teal-500",   bg: "bg-teal-50/60",   badge: "bg-teal-500",   label: "text-teal-700"   },
  { border: "border-l-amber-500",  bg: "bg-amber-50/60",  badge: "bg-amber-500",  label: "text-amber-700"  },
  { border: "border-l-rose-500",   bg: "bg-rose-50/60",   badge: "bg-rose-500",   label: "text-rose-700"   },
];

// Base color index per fare type so same type is always the same hue family
const FARE_BASE_COLOR: Record<string, number> = {
  adult: 0, senior: 1, pwd: 2, student: 3, child: 4, infant: 0,
};

// Types
type FareRow = {
  base_fare_cents: number;
  discount_percent: number;
  admin_fee_cents_per_passenger?: number;
  gcash_fee_cents?: number;
  child_min_age?: number;
  child_max_age?: number;
  child_discount_percent?: number;
  infant_max_age?: number;
  infant_is_free?: boolean;
  senior_min_age?: number;
  senior_discount_percent?: number;
  pwd_discount_percent?: number;
};
type SavedTraveler = {
  id: string; full_name: string;
  gender: string|null; birthdate: string|null; nationality: string|null;
  address: string|null; phone: string|null;
  // Verification fields
  fare_type: string|null;
  id_verified: boolean|null;
  id_verified_at: string|null;
  id_expires_at: string|null;
};
type PassengerExtra = { gender: string; birthdate: string; nationality: string };

// Per-passenger ID upload state (payment step only)
type IdUpload = {
  fileName: string;
  uploading: boolean;
  uploaded: boolean;
  preVerified: boolean;
  error: string;
};

// Pure helpers
function calcAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const dob   = new Date(birthdate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

function getAutoFareType(age: number|null, f: FareRow|null): FareTypeValue {
  if (age === null || !f) return "adult";
  if (age <= (f.infant_max_age  ?? 2))  return "infant";
  if (age >= (f.child_min_age   ?? 3) && age <= (f.child_max_age ?? 10)) return "child";
  if (age >= (f.senior_min_age  ?? 60)) return "senior";
  return "adult";
}

const ID_REQUIRED_TYPES = ["senior","pwd","student","child"] as const;
function requiresId(fareType: string): boolean {
  return (ID_REQUIRED_TYPES as readonly string[]).includes(fareType);
}

function idHint(fareType: string): string {
  if (fareType === "senior")  return "Senior Citizen ID, OSCA ID, or any gov-issued ID showing birthdate";
  if (fareType === "pwd")     return "PWD ID issued by NCDA or LGU";
  if (fareType === "student") return "School ID or any valid student ID showing enrollment";
  if (fareType === "child")   return "Birth certificate, school ID, or any ID showing birthdate";
  return "Valid government-issued ID";
}

function discountPct(fareType: string, f: FareRow): number {
  if (fareType === "infant")  return 100;
  if (fareType === "child")   return f.child_discount_percent  ?? 50;
  if (fareType === "senior")  return f.senior_discount_percent ?? 20;
  if (fareType === "pwd")     return f.pwd_discount_percent    ?? 20;
  if (fareType === "student") return f.discount_percent        ?? 20;
  return 0;
}

function effectiveFareCents(
  base: number, fareType: string, waived: boolean, f: FareRow
): number {
  if (fareType === "adult")  return base;
  if (fareType === "infant" && !waived) return 0;
  if (waived)  return base;
  const pct = discountPct(fareType, f);
  return Math.round(base * (1 - pct / 100));
}

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length >= len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill("")];
}
function ensureExtraLength(arr: PassengerExtra[], len: number): PassengerExtra[] {
  const e: PassengerExtra = { gender:"", birthdate:"", nationality:"" };
  if (arr.length >= len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill(null).map(() => ({...e}))];
}

// ── Verified Traveler Badge ──
function VerifiedTravelerBadge({
  traveler, fareType,
}: {
  traveler: SavedTraveler; fareType: string;
}) {
  if (!traveler.id_verified) return null;

  const isExpired = traveler.id_expires_at
    ? new Date(traveler.id_expires_at) < new Date()
    : false;

  if (isExpired) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5">
        <span className="text-amber-500 text-sm">⚠</span>
        <span className="text-xs font-semibold text-amber-700">
          ID expired — please upload a new one on boarding
        </span>
      </div>
    );
  }

  const savedFare = traveler.fare_type;
  const mismatch  = savedFare && savedFare !== fareType;

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5">
      <span className="text-green-600 text-sm mt-0.5">✓</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-green-700">
          {savedFare
            ? `${savedFare.charAt(0).toUpperCase() + savedFare.slice(1)} ID on file — verified`
            : "ID verified — no upload needed"}
        </span>
        {mismatch && (
          <p className="text-[10px] text-amber-700 mt-0.5">
            ⚠ Saved as <strong>{savedFare}</strong> but booking as <strong>{fareType}</strong> — present ID at terminal.
          </p>
        )}
      </div>
    </div>
  );
}

// PassengerExtraFields
function PassengerExtraFields({
  extra, onChange, savedTravelers, onSelectTraveler,
  isLoggedIn, fareType, fare, onSuggestSwitch, usedNames, isVerified,
}: {
  extra: PassengerExtra;
  onChange: (u: PassengerExtra) => void;
  savedTravelers: SavedTraveler[];
  onSelectTraveler: (t: SavedTraveler) => void;
  isLoggedIn: boolean;
  fareType: string;
  fare: FareRow | null;
  onSuggestSwitch?: (to: FareTypeValue) => void;
  usedNames?: string[];
  isVerified?: boolean;
}) {
  const age       = extra.birthdate ? calcAge(extra.birthdate) : null;
  const suggested = fare && age !== null ? getAutoFareType(age, fare) : null;
  // Hide switch tip if:
  // 1. Already in the correct verified slot (no need to switch)
  // 2. Suggested type matches current fare type
  // 3. No suggestion or suggestion is adult
  const showTip   = !isVerified && suggested && suggested !== fareType && suggested !== "adult";

  return (
    <div className="mt-1 rounded-lg border border-teal-100 bg-teal-50/30 p-2 space-y-2">
      {isLoggedIn && savedTravelers.length > 0 && (
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Fill from saved travelers</label>
          <select
            value=""
            onChange={(e) => {
              const t = savedTravelers.find(s => s.id === e.target.value);
              if (t) onSelectTraveler(t);
            }}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">— Select saved traveler —</option>
            {savedTravelers
              .filter(t => !(usedNames ?? []).includes(t.full_name.trim()))
              .map(t => (
              <option key={t.id} value={t.id}>
                {t.full_name}
                {t.id_verified && !( t.id_expires_at && new Date(t.id_expires_at) < new Date() )
                  ? ` ✓ verified`
                  : ""}
                {t.fare_type ? ` (${t.fare_type})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Gender</label>
          <select value={extra.gender} onChange={e => onChange({...extra, gender: e.target.value})}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">—</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Birthdate</label>
          <input
            type="date" value={extra.birthdate}
            onChange={e => onChange({...extra, birthdate: e.target.value})}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
          {age !== null && <p className="text-xs text-[#0f766e] mt-0.5">{age} yrs</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Nationality</label>
          <select value={extra.nationality} onChange={e => onChange({...extra, nationality: e.target.value})}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">—</option>
            {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {showTip && onSuggestSwitch && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5">
          <p className="text-xs text-amber-800">
            Age {age} → qualifies as <strong className="capitalize">{suggested}</strong>
            {suggested === "infant" ? " (FREE)" : ` (${discountPct(suggested!, fare!)}% off)`}
          </p>
          <button
            type="button"
            onClick={() => onSuggestSwitch(suggested!)}
            className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600"
          >
            Switch
          </button>
        </div>
      )}
    </div>
  );
}

// IdWaiverCard
function IdWaiverCard({
  paxKey, fareType, name, waived, onWaiverChange,
}: {
  paxKey: string; fareType: string; name: string;
  waived: boolean; onWaiverChange: (waived: boolean) => void;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${waived ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50/50"}`}>
      <p className="text-xs font-semibold text-[#134e4a] capitalize">
        {fareType}: <span className="font-normal">{name}</span>
      </p>
      <p className="text-xs text-slate-500 italic">{idHint(fareType)}</p>

      {waived ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-amber-700">
            ⚠ Discount waived — full adult fare will be charged.
          </p>
          <button
            type="button"
            onClick={() => onWaiverChange(false)}
            className="shrink-0 text-xs text-blue-600 underline"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id={`waive-${paxKey}`}
            checked={false}
            onChange={e => { if (e.target.checked) onWaiverChange(true); }}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-amber-400 text-amber-500"
          />
          <label htmlFor={`waive-${paxKey}`} className="text-xs text-amber-800 cursor-pointer">
            <strong>Waive discount</strong> — I will not present an ID on boarding.
            Regular adult fare applies instead.
          </label>
        </div>
      )}
    </div>
  );
}

// IdUploadCard
function IdUploadCard({
  paxKey, fareType, name, passengerIndex,
  upload, onFileChange, onUpload,
}: {
  paxKey: string; fareType: string; name: string; passengerIndex: number;
  upload: IdUpload;
  onFileChange: (key: string, file: File|null) => void;
  onUpload: (pax: { key: string; fareType: string; name: string; passengerIndex: number }) => void;
}) {
  const inputId = `id-upload-${paxKey}`;
  return (
    <div className={`rounded-lg border p-3 space-y-2 bg-white ${upload.uploaded ? "border-green-300" : "border-blue-200"}`}>
      <p className="text-xs font-semibold text-[#134e4a] capitalize">
        {fareType}: <span className="font-normal">{name}</span>
      </p>
      <p className="text-xs text-slate-500 italic">{idHint(fareType)}</p>
      {upload.uploaded ? (
        <p className="text-xs font-semibold text-green-700">
          {upload.preVerified ? "✓ ID already on file — verified" : "✓ ID uploaded successfully"}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor={inputId}
              className="inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 active:bg-blue-100"
            >
              🔎 Choose ID photo or PDF
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="sr-only"
              disabled={upload.uploading}
              onChange={e => onFileChange(paxKey, e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={upload.uploading || !upload.fileName}
              onClick={() => onUpload({ key: paxKey, fareType, name, passengerIndex })}
              className="inline-flex min-h-[36px] items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {upload.uploading ? "Uploading…" : "Upload ID"}
            </button>
          </div>
          {upload.fileName && (
            <p className="text-xs text-green-700">✓ Selected: {upload.fileName}</p>
          )}
          {upload.error && (
            <p className="text-xs font-semibold text-red-600">⚠ {upload.error}</p>
          )}
          <p className="text-xs text-slate-400">Optional — you may skip and present ID at the terminal instead.</p>
        </div>
      )}
    </div>
  );
}

// Main Component
export function BookingModal({
  trip, onClose,
  loggedInEmail = "", passengerName,
  loggedInAddress = "", loggedInGender = "",
  loggedInBirthdate = "", loggedInNationality = "",
}: {
  trip: UpcomingTripRow; onClose: () => void;
  loggedInEmail?: string; passengerName?: string;
  loggedInAddress?: string; loggedInGender?: string;
  loggedInBirthdate?: string; loggedInNationality?: string;
}) {
  const routeName  = trip.route?.display_name
    ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" ↔ ") ?? "—";
  const vesselName = trip.boat?.name ?? "—";
  const toast      = useToast();
  const router     = useRouter();
  const isLoggedIn = !!loggedInEmail?.trim();

  const [fare, setFare] = useState<FareRow|null>(null);
  const [autoFareApplied, setAutoFareApplied] = useState(false);
  const loggedInAge  = loggedInBirthdate ? calcAge(loggedInBirthdate) : null;
  const firstExtra: PassengerExtra = {
    gender: loggedInGender, birthdate: loggedInBirthdate, nationality: loggedInNationality,
  };

  const [countAdult,   setCountAdult]   = useState(1);
  const [countSenior,  setCountSenior]  = useState(0);
  const [countPwd,     setCountPwd]     = useState(0);
  const [countStudent, setCountStudent] = useState(0);
  const [countChild,   setCountChild]   = useState(0);
  const [countInfant,  setCountInfant]  = useState(0);

  const [adultNames,   setAdultNames]   = useState<string[]>([passengerName ?? ""]);
  const [seniorNames,  setSeniorNames]  = useState<string[]>([]);
  const [pwdNames,     setPwdNames]     = useState<string[]>([]);
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [childNames,   setChildNames]   = useState<string[]>([]);
  const [infantNames,  setInfantNames]  = useState<string[]>([]);

  const [adultAddresses,   setAdultAddresses]   = useState<string[]>([]);
  const [seniorAddresses,  setSeniorAddresses]  = useState<string[]>([]);
  const [pwdAddresses,     setPwdAddresses]     = useState<string[]>([]);
  const [studentAddresses, setStudentAddresses] = useState<string[]>([]);
  const [childAddresses,   setChildAddresses]   = useState<string[]>([]);
  const [infantAddresses,  setInfantAddresses]  = useState<string[]>([]);

  const [adultExtras,   setAdultExtras]   = useState<PassengerExtra[]>([firstExtra]);
  const [seniorExtras,  setSeniorExtras]  = useState<PassengerExtra[]>([]);
  const [pwdExtras,     setPwdExtras]     = useState<PassengerExtra[]>([]);
  const [studentExtras, setStudentExtras] = useState<PassengerExtra[]>([]);
  const [childExtras,   setChildExtras]   = useState<PassengerExtra[]>([]);
  const [infantExtras,  setInfantExtras]  = useState<PassengerExtra[]>([]);

  const [waivers,    setWaivers]    = useState<Record<string, boolean>>({});
  const [idUploads,  setIdUploads]  = useState<Record<string, IdUpload>>({});
  const idFiles = useRef<Record<string, File|null>>({});

  const [savedTravelers,  setSavedTravelers]  = useState<SavedTraveler[]>([]);
  const [customerEmail,   setCustomerEmail]   = useState(loggedInEmail);
  const [customerMobile,  setCustomerMobile]  = useState("");
  const [customerAddress, setCustomerAddress] = useState(loggedInAddress);
  const [notifyAlsoEmail, setNotifyAlsoEmail] = useState("");
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [formError,       setFormError]       = useState("");

  const [proofFile,      setProofFile]      = useState<File|null>(null);
  const [saveTravelerChecked, setSaveTravelerChecked] = useState<Record<string, boolean>>({});
  const [savedJustNow,        setSavedJustNow]        = useState<Record<string, boolean>>({});
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded,  setProofUploaded]  = useState(false);
  const [proofError,     setProofError]     = useState("");
  const proofInputRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number; discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
      fare_subtotal_cents?: number; gcash_fee_cents?: number; admin_fee_cents?: number;
    };
  }|null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/saved-travelers")
      .then(r => r.json())
      .then(d => setSavedTravelers(d.travelers ?? []))
      .catch(() => {});
  }, [isLoggedIn]);

  const routeId = trip.route?.id;
  useEffect(() => {
    if (!routeId) return;
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.base_fare_cents == null) return;
        setFare({
          base_fare_cents:               data.base_fare_cents,
          discount_percent:              data.discount_percent             ?? 20,
          admin_fee_cents_per_passenger: data.admin_fee_cents_per_passenger,
          gcash_fee_cents:               data.gcash_fee_cents,
          child_min_age:                 data.child_min_age                ?? 3,
          child_max_age:                 data.child_max_age                ?? 10,
          child_discount_percent:        data.child_discount_percent       ?? 50,
          infant_max_age:                data.infant_max_age               ?? 2,
          infant_is_free:                data.infant_is_free               ?? true,
          senior_min_age:                data.senior_min_age               ?? 60,
          senior_discount_percent:       data.senior_discount_percent      ?? 20,
          pwd_discount_percent:          data.pwd_discount_percent         ?? 20,
        });
      })
      .catch(() => {});
  }, [routeId]);

  useEffect(() => {
    if (!fare || autoFareApplied) { if (fare) setAutoFareApplied(true); return; }
    if (!loggedInBirthdate) { setAutoFareApplied(true); return; }
    const auto = getAutoFareType(loggedInAge, fare);
    const name = passengerName ?? "";
    if (auto === "senior") {
      setCountAdult(0);  setAdultNames([]);  setAdultExtras([]);
      setCountSenior(1); setSeniorNames([name]); setSeniorExtras([firstExtra]);
    } else if (auto === "child") {
      setCountAdult(0); setAdultNames([]); setAdultExtras([]);
      setCountChild(1); setChildNames([name]); setChildExtras([firstExtra]);
    } else if (auto === "infant") {
      setCountAdult(0);  setAdultNames([]);  setAdultExtras([]);
      setCountInfant(1); setInfantNames([name]); setInfantExtras([firstExtra]);
    }
    setAutoFareApplied(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fare]);

  useEffect(() => { setAdultNames(p=>ensureLength(p,countAdult));     setAdultAddresses(p=>ensureLength(p,countAdult));     setAdultExtras(p=>ensureExtraLength(p,countAdult));     }, [countAdult]);
  useEffect(() => { setSeniorNames(p=>ensureLength(p,countSenior));   setSeniorAddresses(p=>ensureLength(p,countSenior));   setSeniorExtras(p=>ensureExtraLength(p,countSenior));   }, [countSenior]);
  useEffect(() => { setPwdNames(p=>ensureLength(p,countPwd));         setPwdAddresses(p=>ensureLength(p,countPwd));         setPwdExtras(p=>ensureExtraLength(p,countPwd));         }, [countPwd]);
  useEffect(() => { setStudentNames(p=>ensureLength(p,countStudent)); setStudentAddresses(p=>ensureLength(p,countStudent)); setStudentExtras(p=>ensureExtraLength(p,countStudent)); }, [countStudent]);
  useEffect(() => { setChildNames(p=>ensureLength(p,countChild));     setChildAddresses(p=>ensureLength(p,countChild));     setChildExtras(p=>ensureExtraLength(p,countChild));     }, [countChild]);
  useEffect(() => { setInfantNames(p=>ensureLength(p,countInfant));   setInfantAddresses(p=>ensureLength(p,countInfant));   setInfantExtras(p=>ensureExtraLength(p,countInfant));   }, [countInfant]);

  const base           = fare?.base_fare_cents          ?? 55000;
  const adminFeePerPax = fare?.admin_fee_cents_per_passenger ?? 2000;
  const gcashFee       = fare?.gcash_fee_cents           ?? 1500;
  const totalPassengers = countAdult + countSenior + countPwd + countStudent + countChild + countInfant;

  const passengerDetails = useMemo(() => {
    const list: {
      fare_type: string; full_name: string; address: string;
      gender?: string; birthdate?: string; nationality?: string;
      waived: boolean;
    }[] = [];
    const mainAddr = customerAddress.trim();
    const add = (
      count: number, fareType: string,
      names: string[], addresses: string[], extras: PassengerExtra[],
    ) => {
      for (let i = 0; i < count; i++) {
        const ex  = extras[i]    ?? { gender:"", birthdate:"", nationality:"" };
        const key = `${fareType}-${i}`;
        list.push({
          fare_type:   fareType,
          full_name:   names[i]?.trim() ?? "",
          address:     addresses[i]?.trim() || mainAddr,
          gender:      ex.gender      || undefined,
          birthdate:   ex.birthdate   || undefined,
          nationality: ex.nationality || undefined,
          waived:      waivers[key]   ?? false,
        });
      }
    };
    add(countAdult,   "adult",   adultNames,   adultAddresses,   adultExtras);
    add(countSenior,  "senior",  seniorNames,  seniorAddresses,  seniorExtras);
    add(countPwd,     "pwd",     pwdNames,     pwdAddresses,     pwdExtras);
    add(countStudent, "student", studentNames, studentAddresses, studentExtras);
    add(countChild,   "child",   childNames,   childAddresses,   childExtras);
    add(countInfant,  "infant",  infantNames,  infantAddresses,  infantExtras);
    return list;
  }, [
    countAdult,countSenior,countPwd,countStudent,countChild,countInfant,
    adultNames,seniorNames,pwdNames,studentNames,childNames,infantNames,
    adultAddresses,seniorAddresses,pwdAddresses,studentAddresses,childAddresses,infantAddresses,
    customerAddress,adultExtras,seniorExtras,pwdExtras,studentExtras,childExtras,infantExtras,
    waivers,
  ]);

  const fareSubtotalCents = useMemo(() => {
    if (!fare) return 0;
    return passengerDetails.reduce((sum, p) =>
      sum + effectiveFareCents(base, p.fare_type, p.waived, fare), 0
    );
  }, [passengerDetails, base, fare]);

  const adminFeeCents = totalPassengers * adminFeePerPax;
  const totalCents    = fareSubtotalCents + gcashFee + adminFeeCents;

  // ── Verified records — loaded once from passenger_id_verifications via API ──
  // Source of truth: never depends on saved_travelers name matching
  const [verifiedRecords, setVerifiedRecords] = useState<{
    passenger_name: string; discount_type: string; expires_at: string | null;
  }[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/passenger-id")
      .then(r => r.json())
      .then(d => {
        const now = new Date();
        setVerifiedRecords(
          (d.verifications ?? []).filter((v: {
            verification_status: string; expires_at: string | null;
          }) =>
            v.verification_status === "verified" &&
            (!v.expires_at || new Date(v.expires_at) > now)
          )
        );
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const isNameVerified = useCallback((name: string, fareType: string): boolean => {
    if (!name.trim() || !requiresId(fareType)) return false;
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z]/g, " ").replace(/\s+/g, " ").trim();
    return verifiedRecords.some(v =>
      v.discount_type === fareType &&
      norm(v.passenger_name ?? "") === norm(name)
    );
  }, [verifiedRecords]);



  const idUploadRequired = useMemo(() => {
    let offset = countAdult;
    const list: { key: string; fareType: string; name: string; passengerIndex: number }[] = [];
    const check = (count: number, fareType: string, names: string[]) => {
      for (let i = 0; i < count; i++) {
        const key = `${fareType}-${i}`;
        // Skip if passenger has a verified ID on file
        const isVerified = isNameVerified(names[i] ?? "", fareType);
        if (requiresId(fareType) && !(waivers[key] ?? false) && !isVerified) {
          list.push({ key, fareType, name: names[i] || `${fareType} ${i+1}`, passengerIndex: offset + i });
        }
      }
      offset += count;
    };
    check(countSenior,  "senior",  seniorNames);
    check(countPwd,     "pwd",     pwdNames);
    check(countStudent, "student", studentNames);
    check(countChild,   "child",   childNames);
    return list;
  }, [countAdult,countSenior,countPwd,countStudent,countChild,seniorNames,pwdNames,studentNames,childNames,waivers,isNameVerified]); // eslint-disable-line react-hooks/exhaustive-deps

  const setWaiver = useCallback((key: string, val: boolean) => {
    setWaivers(prev => ({ ...prev, [key]: val }));
  }, []);

  const getUpload = useCallback((key: string): IdUpload => {
    return idUploads[key] ?? { fileName:"", uploading:false, uploaded:false, preVerified:false, error:"" };
  }, [idUploads]);

  const patchUpload = useCallback((key: string, patch: Partial<IdUpload>) => {
    setIdUploads(prev => ({ ...prev, [key]: { ...(prev[key] ?? { fileName:"", uploading:false, uploaded:false, preVerified:false, error:"" }), ...patch } }));
  }, []);

  const handleIdFileChange = useCallback((key: string, file: File|null) => {
    idFiles.current[key] = file;
    patchUpload(key, { fileName: file?.name ?? "", error:"" });
  }, [patchUpload]);

  const handleIdUpload = useCallback(async (pax: { key: string; fareType: string; name: string; passengerIndex: number }) => {
    if (!result?.reference) return;
    const file = idFiles.current[pax.key];
    if (!file) { patchUpload(pax.key, { error: "Please choose a file first." }); return; }
    patchUpload(pax.key, { uploading: true, error:"" });
    try {
      const fd = new FormData();
      fd.set("booking_reference", result.reference);
      fd.set("passenger_index",   String(pax.passengerIndex));
      fd.set("passenger_name",    pax.name);
      fd.set("discount_type",     pax.fareType === "student" ? "student" : pax.fareType);
      fd.set("file", file);
      const res  = await fetch("/api/passenger-id", { method:"POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { patchUpload(pax.key, { uploading:false, error: data.error ?? "Upload failed." }); return; }
      patchUpload(pax.key, { uploading:false, uploaded:true });
      toast.showSuccess(`ID uploaded for ${pax.name}.`);
    } catch {
      patchUpload(pax.key, { uploading:false, error:"Network error. Please try again." });
    }
  }, [result, patchUpload, toast]);

  useEffect(() => {
    if (!result?.reference || idUploadRequired.length === 0) return;
    idUploadRequired.forEach(async (pax) => {
      const current = idFiles.current[pax.key];
      if (current) return;
      try {
        const fd = new FormData();
        fd.set("booking_reference", result.reference);
        fd.set("passenger_index",   String(pax.passengerIndex));
        fd.set("passenger_name",    pax.name);
        fd.set("discount_type",     pax.fareType === "student" ? "student" : pax.fareType);
        fd.set("check_only",        "true");
        const res  = await fetch("/api/passenger-id", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.already_verified) {
          patchUpload(pax.key, { uploaded: true, preVerified: true, fileName: "", error: "" });
        }
      } catch { /* silent */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.reference]);

  const switchFareType = useCallback((fromType: string, fromIndex: number, toType: FareTypeValue) => {
    const getName = (t: string, i: number) => {
      if (t==="adult")   return adultNames[i]   ?? "";
      if (t==="senior")  return seniorNames[i]  ?? "";
      if (t==="pwd")     return pwdNames[i]     ?? "";
      if (t==="student") return studentNames[i] ?? "";
      if (t==="child")   return childNames[i]   ?? "";
      if (t==="infant")  return infantNames[i]  ?? "";
      return "";
    };
    const getExtra = (t: string, i: number): PassengerExtra => {
      const e = { gender:"", birthdate:"", nationality:"" };
      if (t==="adult")   return adultExtras[i]   ?? e;
      if (t==="senior")  return seniorExtras[i]  ?? e;
      if (t==="pwd")     return pwdExtras[i]     ?? e;
      if (t==="student") return studentExtras[i] ?? e;
      if (t==="child")   return childExtras[i]   ?? e;
      if (t==="infant")  return infantExtras[i]  ?? e;
      return e;
    };
    const name  = getName(fromType, fromIndex);
    const extra = getExtra(fromType, fromIndex);

    const rm = (names: string[], setN: (v:string[])=>void, setC: (v:number)=>void, extras: PassengerExtra[], setE: (v:PassengerExtra[])=>void) => {
      const nn = names.filter((_,i)=>i!==fromIndex);
      const ne = extras.filter((_,i)=>i!==fromIndex);
      setN(nn); setE(ne); setC(nn.length);
    };
    if (fromType==="adult")   rm(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (fromType==="senior")  rm(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (fromType==="pwd")     rm(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (fromType==="student") rm(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (fromType==="child")   rm(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (fromType==="infant")  rm(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);

    const add = (names: string[], setN: (v:string[])=>void, setC: (v:number)=>void, extras: PassengerExtra[], setE: (v:PassengerExtra[])=>void) => {
      setN([...names, name]); setE([...extras, extra]); setC(names.length+1);
    };
    if (toType==="adult")   add(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (toType==="senior")  add(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (toType==="pwd")     add(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (toType==="student") add(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (toType==="child")   add(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (toType==="infant")  add(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);
  }, [adultNames,seniorNames,pwdNames,studentNames,childNames,infantNames,adultExtras,seniorExtras,pwdExtras,studentExtras,childExtras,infantExtras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (totalPassengers < 1)                          { setFormError("Add at least one passenger."); return; }
    if (passengerDetails.some(p => !p.full_name))     { setFormError("Please enter a full name for every passenger."); return; }
    if (!customerEmail.trim() || !customerMobile.trim()) { setFormError("Please enter contact email and mobile number."); return; }
    if (!customerAddress.trim())                      { setFormError("Please enter your address (required for tickets and manifest)."); return; }
    if (!termsAccepted)                               { setFormError("Please accept the Terms and Privacy Policy to continue."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id:          trip.id,
          customer_email:   customerEmail.trim(),
          customer_mobile:  customerMobile.trim(),
          customer_address: customerAddress.trim(),
          notify_also_email: notifyAlsoEmail.trim() || undefined,
          terms_accepted_at: new Date().toISOString(),
          terms_version:    TERMS_VERSION,
          passenger_details: passengerDetails.map(p => ({
            fare_type:   p.waived ? "adult" : p.fare_type,
            full_name:   p.full_name,
            address:     p.address,
            gender:      p.gender,
            birthdate:   p.birthdate,
            nationality: p.nationality,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Booking failed. Please try again."); return; }
      setResult({
        reference:          data.reference,
        total_amount_cents: data.total_amount_cents,
        fare_breakdown:     data.fare_breakdown,
      });
      toast.showSuccess(`Booking ${data.reference} created! Complete payment below.`);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save passengers to saved_travelers after proof uploaded
  const handleSaveTravelers = useCallback(async () => {
    if (!result) return;
    const toSave = passengerDetails.filter((p, i) => {
      const key = `${p.fare_type}-${i}`;
      return (
        p.fare_type !== "infant" &&
        p.full_name.trim() &&
        saveTravelerChecked[key] &&
        !savedJustNow[key]
      );
    });
    for (let i = 0; i < toSave.length; i++) {
      const p   = toSave[i];
      const key = `${p.fare_type}-${i}`;
      try {
        await fetch("/api/saved-travelers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name:          p.full_name,
            gender:             p.gender      || null,
            birthdate:          p.birthdate   || null,
            nationality:        p.nationality || null,
            address:            p.address     || null,
            fare_type:          p.fare_type,
            booking_reference:  result.reference,
          }),
        });
        setSavedJustNow(prev => ({ ...prev, [key]: true }));
      } catch { /* silent — non-critical */ }
    }
    // Refresh saved travelers list so new entries show in dropdown
    fetch("/api/saved-travelers")
      .then(r => r.json())
      .then(d => setSavedTravelers(d.travelers ?? []))
      .catch(() => {});
  }, [result, passengerDetails, saveTravelerChecked, savedJustNow]);

  const handleConfirmBooking = async () => {
    setProofError("");
    if (!proofFile) { setProofError("Please select your GCash screenshot first."); return; }
    if (!result?.reference) return;
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.set("reference", result.reference);
      fd.set("file", proofFile);
      const res  = await fetch("/api/booking/upload-proof", { method:"POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setProofError(data.error ?? "Upload failed. Please try again."); return; }
      setProofUploaded(true);
      toast.showSuccess("Payment proof uploaded. We'll verify and confirm your booking soon.");
      router.refresh();
      onClose();
    } catch {
      setProofError("Network error. Please try again.");
    } finally {
      setProofUploading(false);
    }
  };

  // ── Colored numbered passenger block renderer ──
  const renderBlock = (
    label: string, fareType: string, count: number,
    names: string[], setNames: (v:string[])=>void,
    addresses: string[], setAddresses: (v:string[])=>void,
    extras: PassengerExtra[], setExtras: (v:PassengerExtra[])=>void,
  ) => {
    if (count === 0) return null;
    const baseColorIdx = FARE_BASE_COLOR[fareType] ?? 0;

    // All names currently filled across every passenger slot
    const allFilledNames = [
      ...adultNames, ...seniorNames, ...pwdNames,
      ...studentNames, ...childNames, ...infantNames,
    ].map(n => n.trim()).filter(Boolean);
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#134e4a]">{label} Passengers</p>
        {Array.from({ length: count }, (_, i) => {
          const key      = `${fareType}-${i}`;
          const colorIdx = (baseColorIdx + i) % PAX_COLORS.length;
          const color    = PAX_COLORS[colorIdx];

          // Check if this passenger has a verified ID on file
          const isPreVerified = isNameVerified(names[i] ?? "", fareType);
          // Find saved traveler record for badge display (fare_type, expires_at)
          const verifiedTraveler = isPreVerified
            ? (savedTravelers.find(t =>
                t.full_name.trim().toLowerCase() === (names[i] ?? "").trim().toLowerCase()
              ) ?? { full_name: names[i] ?? "", fare_type: fareType, id_verified: true, id_verified_at: null, id_expires_at: null, id: "", gender: null, birthdate: null, nationality: null, address: null, phone: null })
            : null;

          return (
            <div
              key={i}
              className={`rounded-xl border-2 border-l-4 ${color.border} border-teal-100 ${color.bg} p-3 space-y-2 transition-all`}
            >
              {/* Numbered header */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color.badge} text-white text-xs font-black shadow-sm`}>
                  {i + 1}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wide ${color.label}`}>
                  {label}{count > 1 ? ` ${i + 1}` : ""}
                </span>
                {verifiedTraveler && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-300 px-2 py-0.5 text-[10px] font-bold text-green-700 shrink-0">
                    ✓ Verified
                  </span>
                )}
              </div>

              <input
                type="text" required
                value={names[i] ?? ""}
                onChange={e => { const n=[...names]; n[i]=e.target.value; setNames(n); }}
                placeholder={`${label} ${i+1} — Full Name`}
                className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />

              <input
                type="text"
                value={addresses[i] ?? ""}
                onChange={e => { const n=[...addresses]; n[i]=e.target.value; setAddresses(n); }}
                placeholder="Different address (optional)"
                className="w-full rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />

              <PassengerExtraFields
                extra={extras[i] ?? { gender:"", birthdate:"", nationality:"" }}
                onChange={u => { const n=[...extras]; n[i]=u; setExtras(n); }}
                savedTravelers={savedTravelers}
                onSelectTraveler={t => {
                  const nn=[...names]; nn[i]=t.full_name; setNames(nn);
                  const ne=[...extras]; ne[i]={ gender:t.gender??"", birthdate:t.birthdate??"", nationality:t.nationality??"" }; setExtras(ne);
                  if (t.address) { const na=[...addresses]; na[i]=t.address; setAddresses(na); }
                  if (t.phone && !customerMobile.trim()) setCustomerMobile(t.phone);
                }}
                isLoggedIn={isLoggedIn}
                fareType={fareType}
                fare={fare}
                onSuggestSwitch={to => switchFareType(fareType, i, to)}
                usedNames={allFilledNames.filter(n => n !== (names[i] ?? "").trim())}
                isVerified={isPreVerified}
              />

              {/* Verified badge — shown after name is filled and matches a verified traveler */}
              {verifiedTraveler && requiresId(fareType) && (
                <VerifiedTravelerBadge traveler={verifiedTraveler} fareType={fareType} />
              )}

              {/* ID waiver — only show if NOT already verified */}
              {requiresId(fareType) && !verifiedTraveler && (
                <IdWaiverCard
                  paxKey={key}
                  fareType={fareType}
                  name={names[i] || `${label} ${i+1}`}
                  waived={waivers[key] ?? false}
                  onWaiverChange={val => setWaiver(key, val)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const autoType = fare ? getAutoFareType(loggedInAge, fare) : "adult";
  const autoFareBanner = autoFareApplied && autoType !== "adult" && loggedInBirthdate ? (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <p className="text-sm font-semibold text-blue-900">
        {autoType === "infant" ? "👶" : autoType === "child" ? "🧒" : "👴"}{" "}
        {autoType.charAt(0).toUpperCase() + autoType.slice(1)} fare applied
      </p>
      <p className="text-xs text-blue-700 mt-1">
        Based on your profile (age {loggedInAge}), your slot is set to{" "}
        <strong>{autoType}</strong>
        {autoType === "infant" ? " (FREE)" : ` (${fare ? discountPct(autoType, fare) : ""}% off)`}.
        You can change this below if needed.
      </p>
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog" aria-modal="true" aria-labelledby="booking-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
          <h2 id="booking-modal-title" className="text-lg font-bold text-[#134e4a]">Book This Trip</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* Trip summary */}
          <div className="rounded-xl border border-teal-200 bg-[#fef9e7]/50 px-4 py-3 mb-4">
            <p className="font-semibold text-[#134e4a]">{formatTime(trip.departure_time)} · {vesselName}</p>
            <p className="text-sm text-[#0f766e]">{routeName}</p>
            <p className="text-xs text-[#0f766e] mt-1">
              {new Date(trip.departure_date + "Z").toLocaleDateString("en-PH", { weekday:"long", month:"short", day:"numeric", year:"numeric" })}
            </p>
          </div>

          {autoFareBanner}

          {/* PAYMENT STEP */}
          {result ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                <p className="font-semibold text-[#134e4a]">✓ Booking created</p>
                <p className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Pending payment
                </p>
                <p className="font-mono text-xl font-bold text-[#0c7b93] mt-2">
                  Ref: {result.reference}
                </p>
              </div>

              <div className="rounded-lg border border-teal-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Fare breakdown</p>
                {result.fare_breakdown?.passenger_details?.map((p, i) => {
                  const b   = result.fare_breakdown?.base_fare_cents ?? 55000;
                  const dp  = result.fare_breakdown?.discount_percent ?? 20;
                  const isFree = p.per_person_cents === 0;
                  const isDis  = !isFree && p.fare_type !== "adult";
                  return (
                    <div key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-[#134e4a] py-0.5">
                      <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                      <span>
                        {isFree
                          ? <strong>Free</strong>
                          : isDis
                            ? <>₱{(b/100).toLocaleString()} − {dp}% = <strong>₱{(p.per_person_cents/100).toLocaleString()}</strong></>
                            : <strong>₱{(p.per_person_cents/100).toLocaleString()}</strong>
                        }
                      </span>
                    </div>
                  );
                })}
                {result.fare_breakdown?.fare_subtotal_cents != null && (
                  <div className="mt-2 pt-2 border-t border-teal-100 space-y-0.5">
                    <p className="text-sm text-[#134e4a]">Fare subtotal: ₱{(result.fare_breakdown.fare_subtotal_cents/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Platform fee: ₱{((result.fare_breakdown.admin_fee_cents??0)/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Processing fee: ₱{((result.fare_breakdown.gcash_fee_cents??0)/100).toLocaleString()}</p>
                  </div>
                )}
                <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-bold text-[#134e4a]">
                  Total: ₱{(result.total_amount_cents/100).toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {GCASH_NUMBER && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">
                    Send <strong>₱{(result.total_amount_cents/100).toLocaleString()}</strong> to{" "}
                    <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}).
                    Include reference <span className="font-mono font-semibold">{result.reference}</span> in the message.
                  </p>
                </div>
              )}

              {idUploadRequired.length > 0 && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-900">🪪 Upload Discount IDs (Optional)</p>
                  <p className="text-xs text-blue-700">
                    You can upload IDs now or present them at the terminal upon boarding.
                    Discount has already been applied to your fare.
                  </p>
                  {idUploadRequired.map(pax => (
                    <IdUploadCard
                      key={pax.key}
                      paxKey={pax.key}
                      fareType={pax.fareType}
                      name={pax.name}
                      passengerIndex={pax.passengerIndex}
                      upload={getUpload(pax.key)}
                      onFileChange={handleIdFileChange}
                      onUpload={handleIdUpload}
                    />
                  ))}
                </div>
              )}

              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">
                  🔎 Upload Payment Proof <span className="text-red-600">*</span>
                </p>
                <p className="text-xs text-amber-700">
                  <strong>Required.</strong> Upload your GCash screenshot showing the reference number.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <label
                    htmlFor="proof-upload"
                    className="inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 active:bg-amber-100"
                  >
                    {proofUploaded ? "✓ Proof submitted" : "Choose screenshot or PDF"}
                  </label>
                  <input
                    id="proof-upload"
                    ref={proofInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="sr-only"
                    disabled={proofUploading || proofUploaded}
                    onChange={e => { setProofError(""); setProofFile(e.target.files?.[0] ?? null); }}
                  />
                </div>
                {proofFile && !proofUploaded && (
                  <p className="text-xs text-green-700">✓ Selected: {proofFile.name}</p>
                )}
              </div>

              {proofError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm font-semibold text-red-700">⚠ {proofError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={proofUploading || proofUploaded}
                className="w-full min-h-[48px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
              >
                {proofUploading ? "Uploading…" : proofUploaded ? "✓ Done" : "Confirm Booking"}
              </button>
              {/* ── Save to travelers — shown after proof uploaded ── */}
              {proofUploaded && isLoggedIn && (() => {
                const saveable = passengerDetails.filter((p, idx) => {
                  if (p.fare_type === "infant" || !p.full_name.trim()) return false;
                  // Already in saved travelers?
                  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
                  const alreadySaved = savedTravelers.some(
                    t => norm(t.full_name) === norm(p.full_name)
                  );
                  return !alreadySaved;
                });
                if (saveable.length === 0) return null;
                return (
                  <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-4 space-y-3">
                    <p className="text-sm font-bold text-teal-900">
                      💾 Save passengers for future bookings?
                    </p>
                    <p className="text-xs text-teal-700">
                      Saved passengers auto-fill your next booking. Verified IDs are recognized automatically — no re-upload needed.
                    </p>
                    <div className="space-y-2">
                      {saveable.map((p, idx) => {
                        const key         = `${p.fare_type}-${idx}`;
                        const isSaved     = savedJustNow[key] ?? false;
                        const isChecked   = saveTravelerChecked[key] ?? false;
                        return (
                          <label key={key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                            isSaved
                              ? "border-green-300 bg-green-50"
                              : isChecked
                                ? "border-teal-400 bg-teal-100"
                                : "border-teal-200 bg-white hover:bg-teal-50"
                          }`}>
                            <input
                              type="checkbox"
                              checked={isChecked || isSaved}
                              disabled={isSaved}
                              onChange={e => setSaveTravelerChecked(prev => ({ ...prev, [key]: e.target.checked }))}
                              className="h-4 w-4 rounded border-teal-400 text-teal-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-teal-900 truncate">{p.full_name}</p>
                              <p className="text-xs text-teal-600 capitalize">{p.fare_type}</p>
                            </div>
                            {isSaved && (
                              <span className="text-xs font-bold text-green-700 shrink-0">✓ Saved</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {saveable.some((_, idx) => saveTravelerChecked[`${saveable[idx]?.fare_type}-${idx}`]) && (
                      <button
                        type="button"
                        onClick={handleSaveTravelers}
                        className="w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
                      >
                        Save selected travelers
                      </button>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                {proofUploaded ? "Close" : "I'll upload later (booking stays pending)"}
              </button>
            </div>

          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm font-semibold text-[#134e4a]">Number of passengers by type</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {FARE_TYPE_OPTIONS.map(({ value, label }) => {
                  const count =
                    value==="adult"   ? countAdult   :
                    value==="senior"  ? countSenior  :
                    value==="pwd"     ? countPwd     :
                    value==="student" ? countStudent :
                    value==="child"   ? countChild   : countInfant;
                  const setCount =
                    value==="adult"   ? setCountAdult   :
                    value==="senior"  ? setCountSenior  :
                    value==="pwd"     ? setCountPwd     :
                    value==="student" ? setCountStudent :
                    value==="child"   ? setCountChild   : setCountInfant;
                  return (
                    <div key={value}>
                      <label className="block text-xs font-medium text-[#0f766e] mb-1">{label}</label>
                      <input
                        type="number" min={0} max={20}
                        value={count}
                        onChange={e => setCount(Math.max(0, parseInt(e.target.value,10)||0))}
                        className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                      />
                    </div>
                  );
                })}
              </div>

              {fare && (
                <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 space-y-0.5 text-xs text-[#0f766e]">
                  <p className="font-semibold text-[#134e4a] mb-1">Discounted fares — ID required on boarding</p>
                  <p>• Senior (60+ yrs): {fare.senior_discount_percent ?? 20}% off</p>
                  <p>• PWD: {fare.pwd_discount_percent ?? 20}% off</p>
                  <p>• Student: {fare.discount_percent ?? 20}% off — school ID required</p>
                  <p>• Child ({fare.child_min_age ?? 3}–{fare.child_max_age ?? 10} yrs): {fare.child_discount_percent ?? 50}% off</p>
                  <p>• Infant (under {fare.infant_max_age ?? 2} yrs): FREE — crew verifies on board</p>
                  <p className="mt-1 text-amber-700 font-medium">If you waive the discount, regular adult fare applies — you will see the updated amount before confirming.</p>
                </div>
              )}

              {totalPassengers > 0 && fare && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-[#0f766e]">Amount breakdown</p>
                  {passengerDetails.map((p, i) => {
                    const cents = effectiveFareCents(base, p.fare_type, p.waived, fare);
                    const lbl = p.waived ? `${p.fare_type} (waived → adult)` : p.fare_type;
                    return (
                      <p key={i} className="text-sm text-[#134e4a]">
                        {p.full_name || `Passenger ${i+1}`} ({lbl}): {cents === 0 ? "FREE" : `₱${(cents/100).toLocaleString()}`}
                      </p>
                    );
                  })}
                  <div className="pt-1 border-t border-teal-100 space-y-0.5">
                    <p className="text-sm text-[#134e4a]">Fare subtotal: ₱{(fareSubtotalCents/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Platform fee (₱{(adminFeePerPax/100).toLocaleString()}/pax): ₱{(adminFeeCents/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Processing fee: ₱{(gcashFee/100).toLocaleString()}</p>
                    <p className="text-sm font-bold text-[#134e4a] pt-1 border-t border-teal-200">
                      Total: ₱{(totalCents/100).toLocaleString()} ({totalPassengers} passenger{totalPassengers!==1?"s":""})
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {isLoggedIn && savedTravelers.length > 0 && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/20 px-3 py-2">
                  <p className="text-xs text-[#0f766e]">
                    💡 You have {savedTravelers.length} saved traveler{savedTravelers.length!==1?"s":""}. Use the dropdowns in each passenger slot to auto-fill.
                    {savedTravelers.some(t => t.id_verified) && (
                      <span className="ml-1 text-green-700 font-semibold">
                        ✓ Some travelers have verified IDs — no upload needed!
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#134e4a] mb-1">
                  Address (for tickets and manifest)
                </label>
                <input
                  type="text" required
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                />
                {loggedInAddress && <p className="mt-0.5 text-xs text-[#0f766e]">Pre-filled from your account.</p>}
              </div>

              {renderBlock("Adult",   "adult",   countAdult,   adultNames,   setAdultNames,   adultAddresses,   setAdultAddresses,   adultExtras,   setAdultExtras)}
              {renderBlock("Senior",  "senior",  countSenior,  seniorNames,  setSeniorNames,  seniorAddresses,  setSeniorAddresses,  seniorExtras,  setSeniorExtras)}
              {renderBlock("PWD",     "pwd",     countPwd,     pwdNames,     setPwdNames,     pwdAddresses,     setPwdAddresses,     pwdExtras,     setPwdExtras)}
              {renderBlock("Student", "student", countStudent, studentNames, setStudentNames, studentAddresses, setStudentAddresses, studentExtras, setStudentExtras)}
              {renderBlock("Child",   "child",   countChild,   childNames,   setChildNames,   childAddresses,   setChildAddresses,   childExtras,   setChildExtras)}
              {renderBlock("Infant",  "infant",  countInfant,  infantNames,  setInfantNames,  infantAddresses,  setInfantAddresses,  infantExtras,  setInfantExtras)}

              <div className="border-t border-teal-200 pt-4 space-y-3">
                <p className="text-sm font-semibold text-[#134e4a]">Contact</p>
                <div>
                  <label className="block text-xs text-[#0f766e] mb-1">Email</label>
                  <input
                    type="email" required
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                  />
                  {loggedInEmail && <p className="mt-0.5 text-xs text-[#0f766e]">Using your account email — booking appears in My Bookings.</p>}
                </div>
                <div>
                  <label className="block text-xs text-[#0f766e] mb-1">Mobile Number</label>
                  <input
                    type="tel" required
                    value={customerMobile}
                    onChange={e => setCustomerMobile(e.target.value)}
                    placeholder="e.g. 09XX XXX XXXX"
                    className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#0f766e] mb-1">Also Notify (optional)</label>
                  <input
                    type="email"
                    value={notifyAlsoEmail}
                    onChange={e => setNotifyAlsoEmail(e.target.value)}
                    placeholder="Another email — e.g. travel partner or family"
                    className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                  />
                </div>
              </div>

              <div className={`rounded-xl border-2 p-4 ${termsAccepted ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-amber-400 text-[#0c7b93] focus:ring-[#0c7b93]"
                  />
                  <span className="text-sm text-[#134e4a]">
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline">Privacy Policy</a>.
                    {" "}I understand the refund and cancellation policy, including that once the vessel has departed, rebooking is not available.
                    <span className="block mt-1 text-xs text-[#0f766e]">Recorded with your booking (v{TERMS_VERSION}).</span>
                  </span>
                </label>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm font-semibold text-red-700">⚠ {formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={onClose}
                  className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || totalPassengers < 1 || !termsAccepted}
                  className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create Booking"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
