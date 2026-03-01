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
  { value: "adult",   label: "Adult" },
  { value: "senior",  label: "Senior" },
  { value: "pwd",     label: "PWD" },
  { value: "student", label: "Student" },
  { value: "child",   label: "Child" },
  { value: "infant",  label: "Infant (<2)" },
] as const;

type FareTypeValue = typeof FARE_TYPE_OPTIONS[number]["value"];

const NATIONALITIES = ["Filipino","American","Australian","British","Canadian","Chinese","French","German","Japanese","Korean","Singaporean","Other"];
const GENDERS = ["Male","Female","Other"];

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

type SavedTraveler = { id: string; full_name: string; gender: string|null; birthdate: string|null; nationality: string|null };
type PassengerExtra = { gender: string; birthdate: string; nationality: string };

// Per-passenger ID state — one entry per passenger needing ID
type IdState = {
  fileSelected: boolean;   // has a file been picked
  fileName: string;
  uploading: boolean;
  uploaded: boolean;
  waived: boolean;
  error: string;
};

function emptyIdState(): IdState {
  return { fileSelected: false, fileName: "", uploading: false, uploaded: false, waived: false, error: "" };
}

function fareCents(base: number, discount: number, fareType: string): number {
  if (fareType === "adult") return base;
  if (fareType === "infant") return 0;
  return Math.round(base * (1 - discount / 100));
}

function calcAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const dob = new Date(birthdate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length >= len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill("")];
}
function ensureExtraLength(arr: PassengerExtra[], len: number): PassengerExtra[] {
  const empty: PassengerExtra = { gender: "", birthdate: "", nationality: "" };
  if (arr.length >= len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill(null).map(() => ({ ...empty }))];
}

function getAutoFareType(age: number | null, f: FareRow | null): FareTypeValue {
  if (age === null || !f) return "adult";
  if (age <= (f.infant_max_age ?? 2)) return "infant";
  if (age >= (f.child_min_age ?? 3) && age <= (f.child_max_age ?? 10)) return "child";
  if (age >= (f.senior_min_age ?? 60)) return "senior";
  return "adult";
}

// Which fare types require ID verification
function requiresId(fareType: string): boolean {
  return ["senior", "pwd", "student", "child"].includes(fareType);
}

function idLabel(fareType: string): string {
  if (fareType === "senior") return "Senior Citizen ID, OSCA ID, or any gov ID showing birthdate";
  if (fareType === "pwd") return "PWD ID";
  if (fareType === "student") return "School ID or any valid student ID";
  if (fareType === "child") return "Any ID showing birthdate (e.g. birth certificate, school ID)";
  return "Valid ID";
}

function PassengerExtraFields({ extra, onChange, savedTravelers, onSelectTraveler, isLoggedIn, fareType, fare, onSuggestFareType }: {
  extra: PassengerExtra;
  onChange: (u: PassengerExtra) => void;
  savedTravelers: SavedTraveler[];
  onSelectTraveler: (t: SavedTraveler) => void;
  isLoggedIn: boolean;
  fareType: string;
  fare: FareRow | null;
  onSuggestFareType?: (suggested: FareTypeValue) => void;
}) {
  const age = extra.birthdate ? calcAge(extra.birthdate) : null;
  const suggestedType = fare && age !== null ? getAutoFareType(age, fare) : null;
  const showSuggestion = suggestedType && suggestedType !== fareType && suggestedType !== "adult";

  return (
    <div className="mt-1 rounded-lg border border-teal-100 bg-teal-50/30 p-2 space-y-2">
      {isLoggedIn && savedTravelers.length > 0 && (
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Fill from saved travelers</label>
          <select value="" onChange={(e) => { const t = savedTravelers.find((s) => s.id === e.target.value); if (t) onSelectTraveler(t); }} className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">— Select saved traveler —</option>
            {savedTravelers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Gender</label>
          <select value={extra.gender} onChange={(e) => onChange({ ...extra, gender: e.target.value })} className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Birthdate</label>
          <input type="date" value={extra.birthdate} onChange={(e) => onChange({ ...extra, birthdate: e.target.value })} className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
          {age !== null && <p className="text-xs text-[#0f766e] mt-0.5">{age} yrs</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Nationality</label>
          <select value={extra.nationality} onChange={(e) => onChange({ ...extra, nationality: e.target.value })} className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">—</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {/* Inline fare type suggestion */}
      {showSuggestion && onSuggestFareType && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 flex items-center justify-between gap-2">
          <p className="text-xs text-amber-800">
            Age {age} qualifies as <strong>{suggestedType}</strong>
            {suggestedType === "infant" ? " — FREE" : suggestedType === "child" ? ` — ${fare?.child_discount_percent ?? 50}% off` : suggestedType === "senior" ? ` — ${fare?.senior_discount_percent ?? 20}% off` : ""}.
          </p>
          <button type="button" onClick={() => onSuggestFareType(suggestedType!)} className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600">
            Switch
          </button>
        </div>
      )}
    </div>
  );
}

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
  const routeName = trip.route?.display_name ?? [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" ↔ ") ?? "—";
  const vesselName = trip.boat?.name ?? "—";
  const toast = useToast();
  const isLoggedIn = !!loggedInEmail?.trim();
  const router = useRouter();

  const [fare, setFare] = useState<FareRow | null>(null);
  const [autoFareApplied, setAutoFareApplied] = useState(false);
  const loggedInAge = loggedInBirthdate ? calcAge(loggedInBirthdate) : null;
  const firstExtra: PassengerExtra = { gender: loggedInGender, birthdate: loggedInBirthdate, nationality: loggedInNationality };

  // Passenger counts per type
  const [countAdult,   setCountAdult]   = useState(1);
  const [countSenior,  setCountSenior]  = useState(0);
  const [countPwd,     setCountPwd]     = useState(0);
  const [countStudent, setCountStudent] = useState(0);
  const [countChild,   setCountChild]   = useState(0);
  const [countInfant,  setCountInfant]  = useState(0);

  // Names / addresses / extras per type
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

  const [savedTravelers, setSavedTravelers] = useState<SavedTraveler[]>([]);
  const [customerEmail,  setCustomerEmail]  = useState(loggedInEmail);
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState(loggedInAddress);
  const [notifyAlsoEmail, setNotifyAlsoEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Payment proof
  const [proofUploaded, setProofUploaded] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const [proofFileName, setProofFileName] = useState("");

  // Per-passenger ID states: key = "fareType-index" e.g. "senior-0"
  const [idStates, setIdStates] = useState<Record<string, IdState>>({});
  // Separate refs for each ID file input
  const idFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number; discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
      fare_subtotal_cents?: number; gcash_fee_cents?: number; admin_fee_cents?: number;
    };
  } | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/saved-travelers").then(r => r.json()).then(d => setSavedTravelers(d.travelers ?? [])).catch(() => {});
  }, [isLoggedIn]);

  const routeId = trip.route?.id;
  useEffect(() => {
    if (!routeId) return;
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.base_fare_cents != null) {
          setFare({
            base_fare_cents: data.base_fare_cents,
            discount_percent: data.discount_percent ?? 20,
            admin_fee_cents_per_passenger: data.admin_fee_cents_per_passenger,
            gcash_fee_cents: data.gcash_fee_cents,
            child_min_age: data.child_min_age ?? 3,
            child_max_age: data.child_max_age ?? 10,
            child_discount_percent: data.child_discount_percent ?? 50,
            infant_max_age: data.infant_max_age ?? 2,
            infant_is_free: data.infant_is_free ?? true,
            senior_min_age: data.senior_min_age ?? 60,
            senior_discount_percent: data.senior_discount_percent ?? 20,
            pwd_discount_percent: data.pwd_discount_percent ?? 20,
          });
        }
      }).catch(() => {});
  }, [routeId]);

  // Auto-set logged-in user's fare type once fare loads
  useEffect(() => {
    if (!fare || autoFareApplied || !loggedInBirthdate) { if (fare) setAutoFareApplied(true); return; }
    const autoType = getAutoFareType(loggedInAge, fare);
    const name = passengerName ?? "";
    if (autoType === "senior") {
      setCountAdult(0); setAdultNames([]); setAdultExtras([]);
      setCountSenior(1); setSeniorNames([name]); setSeniorExtras([firstExtra]);
    } else if (autoType === "child") {
      setCountAdult(0); setAdultNames([]); setAdultExtras([]);
      setCountChild(1); setChildNames([name]); setChildExtras([firstExtra]);
    } else if (autoType === "infant") {
      setCountAdult(0); setAdultNames([]); setAdultExtras([]);
      setCountInfant(1); setInfantNames([name]); setInfantExtras([firstExtra]);
    }
    setAutoFareApplied(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fare]);

  useEffect(() => { setAdultNames(p => ensureLength(p, countAdult)); setAdultAddresses(p => ensureLength(p, countAdult)); setAdultExtras(p => ensureExtraLength(p, countAdult)); }, [countAdult]);
  useEffect(() => { setSeniorNames(p => ensureLength(p, countSenior)); setSeniorAddresses(p => ensureLength(p, countSenior)); setSeniorExtras(p => ensureExtraLength(p, countSenior)); }, [countSenior]);
  useEffect(() => { setPwdNames(p => ensureLength(p, countPwd)); setPwdAddresses(p => ensureLength(p, countPwd)); setPwdExtras(p => ensureExtraLength(p, countPwd)); }, [countPwd]);
  useEffect(() => { setStudentNames(p => ensureLength(p, countStudent)); setStudentAddresses(p => ensureLength(p, countStudent)); setStudentExtras(p => ensureExtraLength(p, countStudent)); }, [countStudent]);
  useEffect(() => { setChildNames(p => ensureLength(p, countChild)); setChildAddresses(p => ensureLength(p, countChild)); setChildExtras(p => ensureExtraLength(p, countChild)); }, [countChild]);
  useEffect(() => { setInfantNames(p => ensureLength(p, countInfant)); setInfantAddresses(p => ensureLength(p, countInfant)); setInfantExtras(p => ensureExtraLength(p, countInfant)); }, [countInfant]);

  const baseFare = fare?.base_fare_cents ?? 55000;
  const discount = fare?.discount_percent ?? 20;

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string; address: string; gender?: string; birthdate?: string; nationality?: string }[] = [];
    const mainAddr = customerAddress.trim();
    const add = (count: number, fareType: string, names: string[], addresses: string[], extras: PassengerExtra[]) => {
      for (let i = 0; i < count; i++) {
        const ex = extras[i] ?? { gender: "", birthdate: "", nationality: "" };
        list.push({ fare_type: fareType, full_name: names[i]?.trim() ?? "", address: addresses[i]?.trim() || mainAddr, gender: ex.gender || undefined, birthdate: ex.birthdate || undefined, nationality: ex.nationality || undefined });
      }
    };
    add(countAdult,   "adult",   adultNames,   adultAddresses,   adultExtras);
    add(countSenior,  "senior",  seniorNames,  seniorAddresses,  seniorExtras);
    add(countPwd,     "pwd",     pwdNames,     pwdAddresses,     pwdExtras);
    add(countStudent, "student", studentNames, studentAddresses, studentExtras);
    add(countChild,   "child",   childNames,   childAddresses,   childExtras);
    add(countInfant,  "infant",  infantNames,  infantAddresses,  infantExtras);
    return list;
  }, [countAdult, countSenior, countPwd, countStudent, countChild, countInfant, adultNames, seniorNames, pwdNames, studentNames, childNames, infantNames, adultAddresses, seniorAddresses, pwdAddresses, studentAddresses, childAddresses, infantAddresses, customerAddress, adultExtras, seniorExtras, pwdExtras, studentExtras, childExtras, infantExtras]);

  const fareSubtotalCents = useMemo(() => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0), [passengerDetails, baseFare, discount]);
  const totalPassengers = countAdult + countSenior + countPwd + countStudent + countChild + countInfant;
  const adminFeePerPax = fare?.admin_fee_cents_per_passenger ?? 2000;
  const gcashFee = fare?.gcash_fee_cents ?? 1500;
  const adminFeeCents = totalPassengers * adminFeePerPax;
  const totalCents = fareSubtotalCents + gcashFee + adminFeeCents;

  // Build ID-required list: one entry per passenger needing ID, in order
  // Key format: "fareType-index"
  const idRequiredPassengers = useMemo(() => {
    const list: { key: string; fareType: string; name: string; passengerIndex: number }[] = [];
    let offset = countAdult;
    seniorNames.forEach((name, i) => list.push({ key: `senior-${i}`, fareType: "senior", name: name || `Senior ${i+1}`, passengerIndex: offset + i }));
    offset += countSenior;
    pwdNames.forEach((name, i) => list.push({ key: `pwd-${i}`, fareType: "pwd", name: name || `PWD ${i+1}`, passengerIndex: offset + i }));
    offset += countPwd;
    studentNames.forEach((name, i) => list.push({ key: `student-${i}`, fareType: "student", name: name || `Student ${i+1}`, passengerIndex: offset + i }));
    offset += countStudent;
    childNames.forEach((name, i) => list.push({ key: `child-${i}`, fareType: "child", name: name || `Child ${i+1}`, passengerIndex: offset + i }));
    return list;
  }, [seniorNames, pwdNames, studentNames, childNames, countAdult, countSenior, countPwd, countStudent]);

  const getIdState = useCallback((key: string): IdState => {
    return idStates[key] ?? emptyIdState();
  }, [idStates]);

  const patchIdState = useCallback((key: string, patch: Partial<IdState>) => {
    setIdStates(prev => ({ ...prev, [key]: { ...(prev[key] ?? emptyIdState()), ...patch } }));
  }, []);

  const allIdsSatisfied = idRequiredPassengers.length === 0 || idRequiredPassengers.every(p => {
    const s = idStates[p.key];
    return s?.uploaded || s?.waived;
  });

  // Handle ID file selection — separate from upload so user can see filename before uploading
  const handleIdFileChange = useCallback((key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      patchIdState(key, { fileSelected: true, fileName: file.name, error: "" });
    } else {
      patchIdState(key, { fileSelected: false, fileName: "", error: "" });
    }
  }, [patchIdState]);

  const handleIdUpload = useCallback(async (pax: { key: string; fareType: string; name: string; passengerIndex: number }, bookingRef: string) => {
    const fileInput = idFileRefs.current[pax.key];
    const file = fileInput?.files?.[0];
    if (!file) {
      patchIdState(pax.key, { error: "Please choose a file first, then click Upload ID." });
      return;
    }
    patchIdState(pax.key, { uploading: true, error: "" });
    try {
      const fd = new FormData();
      fd.set("booking_reference", bookingRef);
      fd.set("passenger_index", String(pax.passengerIndex));
      fd.set("passenger_name", pax.name);
      fd.set("discount_type", pax.fareType === "student" ? "pwd" : pax.fareType); // map student→pwd bucket for now
      fd.set("file", file);
      const res = await fetch("/api/passenger-id", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patchIdState(pax.key, { uploading: false, error: data.error ?? "Upload failed. Please try again." });
        return;
      }
      patchIdState(pax.key, { uploading: false, uploaded: true });
      toast.showSuccess(`ID uploaded for ${pax.name}.`);
    } catch {
      patchIdState(pax.key, { uploading: false, error: "Network error. Please try again." });
    }
  }, [patchIdState, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (totalPassengers < 1) { setError("Add at least one passenger."); return; }
    if (passengerDetails.some(p => !p.full_name)) { setError("Please enter the full name for every passenger."); return; }
    if (!customerEmail.trim() || !customerMobile.trim()) { setError("Please enter contact email and mobile number."); return; }
    if (!customerAddress.trim()) { setError("Please enter address (required for tickets and manifest)."); return; }
    if (!termsAccepted) { setError("Please read and accept the Terms and Privacy Policy."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          customer_email: customerEmail.trim(),
          customer_mobile: customerMobile.trim(),
          customer_address: customerAddress.trim(),
          notify_also_email: notifyAlsoEmail.trim() || undefined,
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          passenger_details: passengerDetails.map(p => ({ fare_type: p.fare_type, full_name: p.full_name, address: p.address, gender: p.gender, birthdate: p.birthdate, nationality: p.nationality })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed. Please try again."); return; }
      setResult({ reference: data.reference, total_amount_cents: data.total_amount_cents, fare_breakdown: data.fare_breakdown });
      toast.showSuccess(`Booking ${data.reference} created! Complete payment below.`);
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleConfirmBooking = async () => {
    setProofError("");
    if (!allIdsSatisfied) {
      setProofError("Please upload or waive the ID for all discounted passengers first.");
      return;
    }
    const file = paymentProofInputRef.current?.files?.[0];
    if (!file) {
      setProofError("Payment proof is required. Please upload your GCash screenshot.");
      return;
    }
    if (!result?.reference) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.set("reference", result.reference);
      fd.set("file", file);
      const res = await fetch("/api/booking/upload-proof", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setProofError(data.error ?? "Upload failed."); return; }
      setProofUploaded(true);
      toast.showSuccess("Payment proof uploaded. We'll verify and confirm your booking soon.");
      router.refresh();
      onClose();
    } catch { setProofError("Network error. Please try again."); }
    finally { setUploadingProof(false); }
  };

  // Helper to move a passenger from one type to another (for "Switch" button)
  const switchPassengerType = useCallback((fromType: string, fromIndex: number, toType: FareTypeValue) => {
    // Get the passenger's current info
    const getInfo = (type: string, idx: number) => {
      if (type === "adult")   return { name: adultNames[idx] ?? "",   extra: adultExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      if (type === "senior")  return { name: seniorNames[idx] ?? "",  extra: seniorExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      if (type === "pwd")     return { name: pwdNames[idx] ?? "",     extra: pwdExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      if (type === "student") return { name: studentNames[idx] ?? "", extra: studentExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      if (type === "child")   return { name: childNames[idx] ?? "",   extra: childExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      if (type === "infant")  return { name: infantNames[idx] ?? "",  extra: infantExtras[idx] ?? { gender: "", birthdate: "", nationality: "" } };
      return { name: "", extra: { gender: "", birthdate: "", nationality: "" } };
    };
    const { name, extra } = getInfo(fromType, fromIndex);

    // Remove from current type
    const removeFrom = (names: string[], setNames: (v: string[]) => void, setCount: (v: number) => void, extras: PassengerExtra[], setExtras: (v: PassengerExtra[]) => void) => {
      const newNames = names.filter((_, i) => i !== fromIndex);
      const newExtras = extras.filter((_, i) => i !== fromIndex);
      setNames(newNames); setExtras(newExtras); setCount(newNames.length);
    };
    if (fromType === "adult")   removeFrom(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (fromType === "senior")  removeFrom(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (fromType === "pwd")     removeFrom(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (fromType === "student") removeFrom(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (fromType === "child")   removeFrom(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (fromType === "infant")  removeFrom(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);

    // Add to target type
    const addTo = (names: string[], setNames: (v: string[]) => void, setCount: (v: number) => void, extras: PassengerExtra[], setExtras: (v: PassengerExtra[]) => void) => {
      setNames([...names, name]); setExtras([...extras, extra]); setCount(names.length + 1);
    };
    if (toType === "adult")   addTo(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (toType === "senior")  addTo(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (toType === "pwd")     addTo(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (toType === "student") addTo(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (toType === "child")   addTo(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (toType === "infant")  addTo(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);
  }, [adultNames, seniorNames, pwdNames, studentNames, childNames, infantNames, adultExtras, seniorExtras, pwdExtras, studentExtras, childExtras, infantExtras]);

  const renderPassengerBlock = (
    label: string, fareType: string, count: number,
    names: string[], setNames: (v: string[]) => void,
    addresses: string[], setAddresses: (v: string[]) => void,
    extras: PassengerExtra[], setExtras: (v: PassengerExtra[]) => void,
  ) => {
    if (count === 0) return null;
    return (
      <div>
        <p className="text-sm font-medium text-[#134e4a] mb-2">{label} — Full Name</p>
        <div className="space-y-3">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="rounded-xl border border-teal-200 bg-white p-3 space-y-2">
              <input type="text" required value={names[i] ?? ""} onChange={(e) => { const n = [...names]; n[i] = e.target.value; setNames(n); }} placeholder={`${label} ${i+1} name`} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              <input type="text" value={addresses[i] ?? ""} onChange={(e) => { const n = [...addresses]; n[i] = e.target.value; setAddresses(n); }} placeholder="Different address (optional)" className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              <PassengerExtraFields
                extra={extras[i] ?? { gender: "", birthdate: "", nationality: "" }}
                onChange={(u) => { const n = [...extras]; n[i] = u; setExtras(n); }}
                savedTravelers={savedTravelers}
                onSelectTraveler={(t) => { const nn = [...names]; nn[i] = t.full_name; setNames(nn); const ne = [...extras]; ne[i] = { gender: t.gender ?? "", birthdate: t.birthdate ?? "", nationality: t.nationality ?? "" }; setExtras(ne); }}
                isLoggedIn={isLoggedIn}
                fareType={fareType}
                fare={fare}
                onSuggestFareType={(suggested) => switchPassengerType(fareType, i, suggested)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Auto-fare banner
  const autoFareType = fare ? getAutoFareType(loggedInAge, fare) : "adult";
  const autoFareBanner = autoFareApplied && autoFareType !== "adult" && loggedInBirthdate ? (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <p className="text-sm font-semibold text-blue-900">
        {autoFareType === "infant" ? "👶" : autoFareType === "child" ? "🧒" : "👴"} {autoFareType.charAt(0).toUpperCase() + autoFareType.slice(1)} fare applied
      </p>
      <p className="text-xs text-blue-700 mt-1">
        Based on your profile (age {loggedInAge}), your slot is set to <strong>{autoFareType}</strong>. You can change this below if needed.
      </p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
          <h2 id="booking-modal-title" className="text-lg font-bold text-[#134e4a]">Book This Trip</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4">
          {/* Trip info */}
          <div className="rounded-xl border border-teal-200 bg-[#fef9e7]/50 px-4 py-3 mb-4">
            <p className="font-semibold text-[#134e4a]">{formatTime(trip.departure_time)} · {vesselName}</p>
            <p className="text-sm text-[#0f766e]">{routeName}</p>
            <p className="text-xs text-[#0f766e] mt-1">{new Date(trip.departure_date + "Z").toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</p>
          </div>

          {autoFareBanner}

          {result ? (
            /* ── PAYMENT STEP ─────────────────────────────────────── */
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                <p className="font-semibold text-[#134e4a]">Booking created ✓</p>
                <p className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pending payment</p>
                <p className="font-mono text-xl font-bold text-[#0c7b93] mt-2">Ref: {result.reference}</p>
              </div>

              {/* Fare breakdown */}
              <div className="rounded-lg border border-teal-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Fare breakdown</p>
                {result.fare_breakdown?.passenger_details?.map((p, i) => {
                  const base = result.fare_breakdown?.base_fare_cents ?? 55000;
                  const dp   = result.fare_breakdown?.discount_percent ?? 20;
                  const isFree = p.per_person_cents === 0;
                  const isDis  = !isFree && p.fare_type !== "adult";
                  return (
                    <div key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-[#134e4a] py-0.5">
                      <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                      <span>{isFree ? <strong>Free</strong> : isDis ? <>₱{(base/100).toLocaleString()} − {dp}% = <strong>₱{(p.per_person_cents/100).toLocaleString()}</strong></> : <strong>₱{(p.per_person_cents/100).toLocaleString()}</strong>}</span>
                    </div>
                  );
                })}
                {result.fare_breakdown?.fare_subtotal_cents != null && (<>
                  <div className="mt-2 pt-2 border-t border-teal-100 space-y-0.5">
                    <p className="text-sm text-[#134e4a]">Fare subtotal: ₱{(result.fare_breakdown.fare_subtotal_cents/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Platform fee: ₱{((result.fare_breakdown.admin_fee_cents ?? 0)/100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Processing fee: ₱{((result.fare_breakdown.gcash_fee_cents ?? 0)/100).toLocaleString()}</p>
                  </div>
                </>)}
                <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-bold text-[#134e4a]">Total: ₱{(result.total_amount_cents/100).toLocaleString()}</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {GCASH_NUMBER && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">Send <strong>₱{(result.total_amount_cents/100).toLocaleString()}</strong> to <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}). Include reference <span className="font-mono font-semibold">{result.reference}</span> in the message.</p>
                </div>
              )}

              {/* ── ID Upload section — one card per passenger needing ID ── */}
              {idRequiredPassengers.length > 0 && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-blue-900">🪪 Discount ID Verification</p>
                    <p className="text-xs text-blue-700 mt-1">Upload a valid ID for each discounted passenger to keep their discount upon boarding. Or waive the discount — they will be charged the regular adult fare.</p>
                  </div>

                  {idRequiredPassengers.map((pax) => {
                    const s = getIdState(pax.key);
                    return (
                      <div key={pax.key} className={`rounded-lg border p-3 space-y-2 bg-white ${s.uploaded ? "border-green-300" : s.waived ? "border-amber-200" : "border-blue-200"}`}>
                        {/* Passenger label */}
                        <p className="text-xs font-semibold text-blue-900 capitalize">
                          {pax.fareType}: <span className="text-[#134e4a]">{pax.name}</span>
                        </p>
                        <p className="text-xs text-slate-500 italic">{idLabel(pax.fareType)}</p>

                        {/* ── Uploaded state ── */}
                        {s.uploaded && (
                          <p className="text-xs text-green-700 font-semibold">✓ ID uploaded successfully</p>
                        )}

                        {/* ── Upload area (shown if not yet uploaded and not waived) ── */}
                        {!s.uploaded && !s.waived && (
                          <div className="space-y-2">
                            {/* Separate input + button — NOT inside a label to avoid ref issues */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                  ref={(el) => { idFileRefs.current[pax.key] = el; }}
                                  onChange={(e) => handleIdFileChange(pax.key, e)}
                                  disabled={s.uploading}
                                  id={`id-file-${pax.key}`}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                                  style={{ fontSize: 0 }}
                                />
                                <div className="pointer-events-none rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                                  📎 Choose ID photo or PDF
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleIdUpload(pax, result.reference)}
                                disabled={s.uploading || !s.fileSelected}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {s.uploading ? "Uploading…" : "Upload ID"}
                              </button>
                            </div>
                            {s.fileSelected && (
                              <p className="text-xs text-green-700">✓ Selected: {s.fileName}</p>
                            )}
                            {s.error && (
                              <p className="text-xs text-red-600 font-semibold">⚠ {s.error}</p>
                            )}
                          </div>
                        )}

                        {/* ── Waiver checkbox (shown if not yet uploaded) ── */}
                        {!s.uploaded && (
                          <div className={`pt-2 ${!s.waived ? "border-t border-blue-100" : ""}`}>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={s.waived}
                                onChange={(e) => patchIdState(pax.key, { waived: e.target.checked, error: "" })}
                                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 cursor-pointer"
                              />
                              <span className="text-xs text-amber-800">
                                <strong>Waive discount</strong> — no ID needed, regular adult fare applies instead.
                              </span>
                            </label>
                            {s.waived && (
                              <div className="mt-1 flex items-center justify-between">
                                <p className="text-xs text-amber-700 font-medium">⚠ Discount waived. Regular fare will be charged.</p>
                                <button type="button" onClick={() => patchIdState(pax.key, { waived: false })} className="text-xs text-blue-600 underline ml-2">Undo</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!allIdsSatisfied && (
                    <p className="text-xs text-red-600 font-semibold">⚠ Please upload or waive for all discounted passengers above to continue.</p>
                  )}
                </div>
              )}

              {/* ── Payment Proof ── */}
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">📎 Upload Payment Proof <span className="text-red-600">*</span></p>
                <p className="text-xs text-amber-700"><strong>Required.</strong> Upload your GCash screenshot showing the reference number.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={(e) => { setProofError(""); setProofFileName(e.target.files?.[0]?.name ?? ""); }}
                      disabled={uploadingProof || proofUploaded}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                      style={{ fontSize: 0 }}
                    />
                    <div className="pointer-events-none rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800">
                      {proofUploaded ? "✓ Proof submitted" : "Choose screenshot or PDF"}
                    </div>
                  </div>
                </div>
                {proofFileName && !proofUploaded && <p className="text-xs text-green-700">✓ Selected: {proofFileName}</p>}
              </div>

              {proofError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2"><p className="text-sm font-semibold text-red-700">⚠ {proofError}</p></div>}

              <button type="button" onClick={handleConfirmBooking} disabled={uploadingProof || proofUploaded} className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                {uploadingProof ? "Uploading…" : proofUploaded ? "✓ Done" : "Confirm Booking"}
              </button>
              <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                {proofUploaded ? "Close" : "I'll upload later (booking stays pending)"}
              </button>
            </div>

          ) : (
            /* ── BOOKING FORM ─────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm font-medium text-[#134e4a]">Number of passengers by type</p>

              {/* Fare type counts */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {FARE_TYPE_OPTIONS.map(({ value, label }) => {
                  const count = value === "adult" ? countAdult : value === "senior" ? countSenior : value === "pwd" ? countPwd : value === "student" ? countStudent : value === "child" ? countChild : countInfant;
                  const setCount = value === "adult" ? setCountAdult : value === "senior" ? setCountSenior : value === "pwd" ? setCountPwd : value === "student" ? setCountStudent : value === "child" ? setCountChild : setCountInfant;
                  return (
                    <div key={value}>
                      <label className="block text-xs font-medium text-[#0f766e] mb-1 whitespace-nowrap">{label}</label>
                      <input type="number" min={0} max={20} value={count} onChange={(e) => setCount(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    </div>
                  );
                })}
              </div>

              {/* Discount note */}
              {fare && (
                <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-[#0f766e] space-y-0.5">
                  <p>• Senior (60+) & PWD: {fare.senior_discount_percent ?? 20}% off — ID required on boarding</p>
                  <p>• Student: discount fare — School ID required on boarding</p>
                  <p>• Child ({fare.child_min_age ?? 3}–{fare.child_max_age ?? 10} yrs): {fare.child_discount_percent ?? 50}% off — ID required on boarding</p>
                  <p>• Infant (under {fare.infant_max_age ?? 2} yrs): FREE — crew verifies on board</p>
                </div>
              )}

              {totalPassengers > 0 && fare && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-[#0f766e]">Amount breakdown</p>
                  <p className="text-sm text-[#134e4a]">Fare: ₱{(fareSubtotalCents/100).toLocaleString()}</p>
                  <p className="text-sm text-[#134e4a]">Platform fee (₱{(adminFeePerPax/100).toLocaleString()}/pax): ₱{(adminFeeCents/100).toLocaleString()}</p>
                  <p className="text-sm text-[#134e4a]">Processing fee: ₱{(gcashFee/100).toLocaleString()}</p>
                  <p className="text-sm font-bold text-[#134e4a] pt-1 border-t border-teal-200">Total: ₱{(totalCents/100).toLocaleString()} ({totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""})</p>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {isLoggedIn && savedTravelers.length > 0 && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/20 px-3 py-2">
                  <p className="text-xs text-[#0f766e]">💡 You have {savedTravelers.length} saved traveler{savedTravelers.length !== 1 ? "s" : ""}. Use the dropdowns to auto-fill.</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-[#134e4a] mb-1">Address (for tickets and manifest)</p>
                <input type="text" required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="e.g. Brgy. Dapa, General Luna, Siargao" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                {loggedInAddress && <p className="mt-0.5 text-xs text-[#0f766e]">Pre-filled from your account.</p>}
              </div>

              {renderPassengerBlock("Adult",   "adult",   countAdult,   adultNames,   setAdultNames,   adultAddresses,   setAdultAddresses,   adultExtras,   setAdultExtras)}
              {renderPassengerBlock("Senior",  "senior",  countSenior,  seniorNames,  setSeniorNames,  seniorAddresses,  setSeniorAddresses,  seniorExtras,  setSeniorExtras)}
              {renderPassengerBlock("PWD",     "pwd",     countPwd,     pwdNames,     setPwdNames,     pwdAddresses,     setPwdAddresses,     pwdExtras,     setPwdExtras)}
              {renderPassengerBlock("Student", "student", countStudent, studentNames, setStudentNames, studentAddresses, setStudentAddresses, studentExtras, setStudentExtras)}
              {renderPassengerBlock("Child",   "child",   countChild,   childNames,   setChildNames,   childAddresses,   setChildAddresses,   childExtras,   setChildExtras)}
              {renderPassengerBlock("Infant",  "infant",  countInfant,  infantNames,  setInfantNames,  infantAddresses,  setInfantAddresses,  infantExtras,  setInfantExtras)}

              {/* Contact */}
              <div className="border-t border-teal-200 pt-4">
                <p className="text-sm font-medium text-[#134e4a] mb-2">Contact</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Email</label>
                    <input type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    {loggedInEmail && <p className="mt-1 text-xs text-[#0f766e]">Using your account email — booking appears in My Bookings.</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Mobile Number</label>
                    <input type="tel" required value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="e.g. 09XX XXX XXXX" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    <p className="mt-0.5 text-xs text-[#0f766e]">Used on the manifest for all passengers unless individually overridden.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Also Notify (optional)</label>
                    <input type="email" value={notifyAlsoEmail} onChange={(e) => setNotifyAlsoEmail(e.target.value)} placeholder="Another email to receive the same notification" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    <p className="mt-0.5 text-xs text-[#0f766e]">e.g. travel partner or family — they&apos;ll get the payment required email too.</p>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className={`rounded-xl border-2 p-4 ${termsAccepted ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-amber-400 text-[#0c7b93] focus:ring-[#0c7b93]" />
                  <span className="text-sm text-[#134e4a]">
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline">Terms of Service</a>{" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline">Privacy Policy</a>.
                    {" "}I understand the refund and cancellation policy, including that once the vessel has departed, rebooking is not available.
                    <span className="block mt-1 text-xs text-[#0f766e]">This acceptance is recorded with your booking (v{TERMS_VERSION}).</span>
                  </span>
                </label>
              </div>

              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2"><p className="text-sm font-semibold text-red-700">⚠ {error}</p></div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                <button type="submit" disabled={submitting || totalPassengers < 1 || !termsAccepted} className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
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
