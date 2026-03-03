"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME, ROUTES } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";

const TERMS_VERSION = "1.0";

type RouteRow = { id: string; origin: string; destination: string; display_name: string };
type TripRow = {
  id: string;
  departure_time: string;
  departure_date?: string;
  online_quota: number;
  online_booked: number;
  walk_in_quota: number;
  walk_in_booked: number;
  boat: { id: string; name: string; capacity?: number } | null;
  route: { id: string; display_name: string; origin: string; destination: string } | null;
  port: { id: string; name: string } | null;
};
type FareRow = {
  base_fare_cents: number;
  discount_percent: number;
  admin_fee_cents_per_passenger?: number;
  gcash_fee_cents?: number;
  admin_fee_label?: string;
  gcash_fee_label?: string;
  gcash_fee_show_breakdown?: boolean;
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
  gender: string | null; birthdate: string | null; nationality: string | null;
};
type PassengerExtra = { gender: string; birthdate: string; nationality: string };
type FareTypeValue = "adult" | "senior" | "pwd" | "student" | "child" | "infant";

const FARE_TYPE_OPTIONS: { value: FareTypeValue; label: string }[] = [
  { value: "adult",   label: "Adult"       },
  { value: "senior",  label: "Senior"      },
  { value: "pwd",     label: "PWD"         },
  { value: "student", label: "Student"     },
  { value: "child",   label: "Child"       },
  { value: "infant",  label: "Infant (<7)" },
];

const NATIONALITIES = ["Filipino","American","Australian","British","Canadian","Chinese",
  "French","German","Japanese","Korean","Singaporean","Other"];
const GENDERS = ["Male","Female","Other"];

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m || "00"} ${am ? "AM" : "PM"}`;
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

function getAutoFareType(age: number | null, f: FareRow | null): FareTypeValue {
  if (age === null || !f) return "adult";
  if (age <= (f.infant_max_age ?? 6))  return "infant";
  if (age >= (f.child_min_age ?? 7) && age <= (f.child_max_age ?? 12)) return "child";
  if (age >= (f.senior_min_age ?? 60)) return "senior";
  return "adult";
}

function discountPct(fareType: string, f: FareRow): number {
  if (fareType === "infant")  return 100;
  if (fareType === "child")   return f.child_discount_percent  ?? 50;
  if (fareType === "senior")  return f.senior_discount_percent ?? 20;
  if (fareType === "pwd")     return f.pwd_discount_percent    ?? 20;
  if (fareType === "student") return f.discount_percent        ?? 20;
  return 0;
}

function effectiveFareCents(base: number, fareType: string, f: FareRow): number {
  if (fareType === "adult")  return base;
  if (fareType === "infant") return 0;
  const pct = discountPct(fareType, f);
  return Math.round(base * (1 - pct / 100));
}

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill("")];
  return arr.slice(0, len);
}
function ensureExtraLength(arr: PassengerExtra[], len: number): PassengerExtra[] {
  const e: PassengerExtra = { gender: "", birthdate: "", nationality: "" };
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill(null).map(() => ({ ...e }))];
  return arr.slice(0, len);
}

// PassengerExtraFields with age-based suggestion
function PassengerExtraFields({
  extra, onChange, savedTravelers, onSelectTraveler,
  isLoggedIn, fareType, fare, onSuggestSwitch,
}: {
  extra: PassengerExtra;
  onChange: (u: PassengerExtra) => void;
  savedTravelers: SavedTraveler[];
  onSelectTraveler: (t: SavedTraveler) => void;
  isLoggedIn: boolean;
  fareType: string;
  fare: FareRow | null;
  onSuggestSwitch?: (to: FareTypeValue) => void;
}) {
  const age = extra.birthdate ? calcAge(extra.birthdate) : null;
  const suggested = fare && age !== null ? getAutoFareType(age, fare) : null;
  const showTip = suggested && suggested !== fareType && suggested !== "adult";

  return (
    <div className="mt-1 rounded-lg border border-teal-100 bg-teal-50/30 p-2 space-y-2">
      {isLoggedIn && savedTravelers.length > 0 && (
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Fill from saved travelers</label>
          <select value="" onChange={e => { const t = savedTravelers.find(s => s.id === e.target.value); if (t) onSelectTraveler(t); }}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">— Select saved traveler —</option>
            {savedTravelers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Gender</label>
          <select value={extra.gender} onChange={e => onChange({ ...extra, gender: e.target.value })}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
            <option value="">—</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Birthdate</label>
          <input type="date" value={extra.birthdate} onChange={e => onChange({ ...extra, birthdate: e.target.value })}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
          {age !== null && <p className="text-xs text-[#0f766e] mt-0.5">{age} yrs</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Nationality</label>
          <select value={extra.nationality} onChange={e => onChange({ ...extra, nationality: e.target.value })}
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
          <button type="button" onClick={() => onSuggestSwitch(suggested!)}
            className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600">
            Switch
          </button>
        </div>
      )}
    </div>
  );
}

type BookingFormProps = {
  loggedInEmail?: string;
  loggedInAddress?: string;
  loggedInName?: string;
  loggedInGender?: string;
  loggedInBirthdate?: string;
  loggedInNationality?: string;
  initialRouteId?: string;
  initialDate?: string;
};

export default function BookingForm({
  loggedInEmail = "",
  loggedInAddress = "",
  loggedInName = "",
  loggedInGender = "",
  loggedInBirthdate = "",
  loggedInNationality = "",
  initialRouteId = "",
  initialDate = "",
}: BookingFormProps) {
  const [routes,    setRoutes]    = useState<RouteRow[]>([]);
  const [routeId,   setRouteId]   = useState(initialRouteId);
  const [date,      setDate]      = useState(initialDate);
  const [trips,     setTrips]     = useState<TripRow[]>([]);
  const [tripId,    setTripId]    = useState("");
  const [fare,      setFare]      = useState<FareRow | null>(null);

  const [countAdult,   setCountAdult]   = useState(1);
  const [countSenior,  setCountSenior]  = useState(0);
  const [countPwd,     setCountPwd]     = useState(0);
  const [countStudent, setCountStudent] = useState(0);
  const [countChild,   setCountChild]   = useState(0);
  const [countInfant,  setCountInfant]  = useState(0);

  const [adultNames,   setAdultNames]   = useState<string[]>([loggedInName]);
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

  const firstExtra: PassengerExtra = { gender: loggedInGender, birthdate: loggedInBirthdate, nationality: loggedInNationality };
  const [adultExtras,   setAdultExtras]   = useState<PassengerExtra[]>([firstExtra]);
  const [seniorExtras,  setSeniorExtras]  = useState<PassengerExtra[]>([]);
  const [pwdExtras,     setPwdExtras]     = useState<PassengerExtra[]>([]);
  const [studentExtras, setStudentExtras] = useState<PassengerExtra[]>([]);
  const [childExtras,   setChildExtras]   = useState<PassengerExtra[]>([]);
  const [infantExtras,  setInfantExtras]  = useState<PassengerExtra[]>([]);

  const [savedTravelers,  setSavedTravelers]  = useState<SavedTraveler[]>([]);
  const [customerEmail,   setCustomerEmail]   = useState(loggedInEmail);
  const [customerMobile,  setCustomerMobile]  = useState("");
  const [customerAddress, setCustomerAddress] = useState(loggedInAddress);
  const [notifyAlsoEmail, setNotifyAlsoEmail] = useState("");
  const [termsAccepted,   setTermsAccepted]   = useState(false);

  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingTrips,  setLoadingTrips]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");

  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number; discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
      fare_subtotal_cents?: number; gcash_fee_cents?: number; admin_fee_cents?: number;
      gcash_fee_label?: string; admin_fee_label?: string; gcash_fee_show_breakdown?: boolean;
    };
  } | null>(null);

  const [proofFile,      setProofFile]      = useState<File | null>(null);
  const [proofUploaded,  setProofUploaded]  = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError,     setProofError]     = useState("");
  const proofInputRef = useRef<HTMLInputElement>(null);

  // ID uploads per discount passenger (after booking)
  const [idUploads,      setIdUploads]      = useState<Record<string, "idle"|"uploading"|"done"|"error">>({});
  const [idUploadErrors, setIdUploadErrors] = useState<Record<string, string>>({});
  const idFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isLoggedIn = !!loggedInEmail?.trim();
  const canUpload  = isLoggedIn && customerEmail.trim().toLowerCase() === loggedInEmail.trim().toLowerCase();
  const router     = useRouter();
  const today      = new Date().toISOString().slice(0, 10);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/saved-travelers").then(r => r.json()).then(d => setSavedTravelers(d.travelers ?? [])).catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    fetch("/api/booking/routes")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRoutes(d); setLoadingRoutes(false); })
      .catch(() => setLoadingRoutes(false));
  }, []);

  useEffect(() => { if (initialRouteId) setRouteId(initialRouteId); }, [initialRouteId]);
  useEffect(() => { if (initialDate)    setDate(initialDate);       }, [initialDate]);

  useEffect(() => {
    if (!routeId || !date) { setTrips([]); setTripId(""); return; }
    setLoadingTrips(true); setTripId("");
    fetch(`/api/booking/trips?route_id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(d => { setTrips(Array.isArray(d) ? d : []); setLoadingTrips(false); })
      .catch(() => setLoadingTrips(false));
  }, [routeId, date]);

  useEffect(() => {
    if (!routeId) { setFare(null); return; }
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then(r => r.json())
      .then(d => setFare(d?.base_fare_cents != null ? d : null))
      .catch(() => {});
  }, [routeId]);

  // ── Sync array lengths ─────────────────────────────────────────────────────
  useEffect(() => { setAdultNames(p=>ensureLength(p,countAdult));     setAdultAddresses(p=>ensureLength(p,countAdult));     setAdultExtras(p=>ensureExtraLength(p,countAdult));     }, [countAdult]);
  useEffect(() => { setSeniorNames(p=>ensureLength(p,countSenior));   setSeniorAddresses(p=>ensureLength(p,countSenior));   setSeniorExtras(p=>ensureExtraLength(p,countSenior));   }, [countSenior]);
  useEffect(() => { setPwdNames(p=>ensureLength(p,countPwd));         setPwdAddresses(p=>ensureLength(p,countPwd));         setPwdExtras(p=>ensureExtraLength(p,countPwd));         }, [countPwd]);
  useEffect(() => { setStudentNames(p=>ensureLength(p,countStudent)); setStudentAddresses(p=>ensureLength(p,countStudent)); setStudentExtras(p=>ensureExtraLength(p,countStudent)); }, [countStudent]);
  useEffect(() => { setChildNames(p=>ensureLength(p,countChild));     setChildAddresses(p=>ensureLength(p,countChild));     setChildExtras(p=>ensureExtraLength(p,countChild));     }, [countChild]);
  useEffect(() => { setInfantNames(p=>ensureLength(p,countInfant));   setInfantAddresses(p=>ensureLength(p,countInfant));   setInfantExtras(p=>ensureExtraLength(p,countInfant));   }, [countInfant]);

  // ── Fare calculation ───────────────────────────────────────────────────────
  const baseFare      = fare?.base_fare_cents              ?? 55000;
  const adminFeePerPax = fare?.admin_fee_cents_per_passenger ?? 2000;
  const gcashFee       = fare?.gcash_fee_cents               ?? 1500;
  const totalPassengers = countAdult + countSenior + countPwd + countStudent + countChild + countInfant;

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string; address: string; gender?: string; birthdate?: string; nationality?: string }[] = [];
    const mainAddr = customerAddress.trim();
    const add = (count: number, fareType: string, names: string[], addresses: string[], extras: PassengerExtra[]) => {
      for (let i = 0; i < count; i++) {
        const ex = extras[i] ?? { gender:"", birthdate:"", nationality:"" };
        list.push({ fare_type: fareType, full_name: names[i]?.trim() ?? "", address: addresses[i]?.trim() || mainAddr, gender: ex.gender||undefined, birthdate: ex.birthdate||undefined, nationality: ex.nationality||undefined });
      }
    };
    add(countAdult,   "adult",   adultNames,   adultAddresses,   adultExtras);
    add(countSenior,  "senior",  seniorNames,  seniorAddresses,  seniorExtras);
    add(countPwd,     "pwd",     pwdNames,     pwdAddresses,     pwdExtras);
    add(countStudent, "student", studentNames, studentAddresses, studentExtras);
    add(countChild,   "child",   childNames,   childAddresses,   childExtras);
    add(countInfant,  "infant",  infantNames,  infantAddresses,  infantExtras);
    return list;
  }, [countAdult,countSenior,countPwd,countStudent,countChild,countInfant,adultNames,seniorNames,pwdNames,studentNames,childNames,infantNames,adultAddresses,seniorAddresses,pwdAddresses,studentAddresses,childAddresses,infantAddresses,customerAddress,adultExtras,seniorExtras,pwdExtras,studentExtras,childExtras,infantExtras]);

  const fareSubtotalCents = useMemo(() => {
    if (!fare) return 0;
    return passengerDetails.reduce((sum, p) => sum + effectiveFareCents(baseFare, p.fare_type, fare), 0);
  }, [passengerDetails, baseFare, fare]);

  const adminFeeCents = totalPassengers * adminFeePerPax;
  const totalCents    = fareSubtotalCents + gcashFee + adminFeeCents;

  // Discount passengers needing ID upload
  const discountPassengers = useMemo(() => {
    return passengerDetails
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => ["senior","pwd","child","student"].includes(p.fare_type))
      .map(({ p, idx }) => ({ key: `${p.fare_type}-${idx}`, fareType: p.fare_type, name: p.full_name || `${p.fare_type} passenger`, passengerIndex: idx }));
  }, [passengerDetails]);

  // ── Fare type switching (same as modal) ────────────────────────────────────
  const switchFareType = useCallback((fromType: string, fromIndex: number, toType: FareTypeValue) => {
    const namesMap:  Record<string, string[]>         = { adult:adultNames, senior:seniorNames, pwd:pwdNames, student:studentNames, child:childNames, infant:infantNames };
    const extrasMap: Record<string, PassengerExtra[]> = { adult:adultExtras, senior:seniorExtras, pwd:pwdExtras, student:studentExtras, child:childExtras, infant:infantExtras };
    const name  = namesMap[fromType]?.[fromIndex]  ?? "";
    const extra = extrasMap[fromType]?.[fromIndex] ?? { gender:"", birthdate:"", nationality:"" };
    const rm = (names:string[], setN:(v:string[])=>void, setC:(v:number)=>void, extras:PassengerExtra[], setE:(v:PassengerExtra[])=>void) => {
      const nn=names.filter((_,i)=>i!==fromIndex); const ne=extras.filter((_,i)=>i!==fromIndex);
      setN(nn); setE(ne); setC(nn.length);
    };
    const addTo = (names:string[], setN:(v:string[])=>void, setC:(v:number)=>void, extras:PassengerExtra[], setE:(v:PassengerExtra[])=>void) => {
      setN([...names,name]); setE([...extras,extra]); setC(names.length+1);
    };
    if (fromType==="adult")   rm(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (fromType==="senior")  rm(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (fromType==="pwd")     rm(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (fromType==="student") rm(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (fromType==="child")   rm(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (fromType==="infant")  rm(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);
    if (toType==="adult")   addTo(adultNames,   setAdultNames,   setCountAdult,   adultExtras,   setAdultExtras);
    if (toType==="senior")  addTo(seniorNames,  setSeniorNames,  setCountSenior,  seniorExtras,  setSeniorExtras);
    if (toType==="pwd")     addTo(pwdNames,     setPwdNames,     setCountPwd,     pwdExtras,     setPwdExtras);
    if (toType==="student") addTo(studentNames, setStudentNames, setCountStudent, studentExtras, setStudentExtras);
    if (toType==="child")   addTo(childNames,   setChildNames,   setCountChild,   childExtras,   setChildExtras);
    if (toType==="infant")  addTo(infantNames,  setInfantNames,  setCountInfant,  infantExtras,  setInfantExtras);
  }, [adultNames,seniorNames,pwdNames,studentNames,childNames,infantNames,adultExtras,seniorExtras,pwdExtras,studentExtras,childExtras,infantExtras]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetBooking = useCallback(() => {
    setResult(null); setTripId("");
    setCountAdult(1); setCountSenior(0); setCountPwd(0); setCountStudent(0); setCountChild(0); setCountInfant(0);
    setAdultNames([loggedInName]); setSeniorNames([]); setPwdNames([]); setStudentNames([]); setChildNames([]); setInfantNames([]);
    setAdultExtras([firstExtra]); setSeniorExtras([]); setPwdExtras([]); setStudentExtras([]); setChildExtras([]); setInfantExtras([]);
    setCustomerEmail(loggedInEmail); setCustomerMobile("");
    setProofFile(null); setProofUploaded(false); setProofError("");
    setTermsAccepted(false); setIdUploads({}); setIdUploadErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInName, loggedInEmail]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setResult(null);
    if (!tripId)             { setError("Please select route, date, and departure time."); return; }
    if (totalPassengers < 1) { setError("Add at least one passenger."); return; }
    if (passengerDetails.some(p => !p.full_name)) { setError("Please enter the name for every passenger."); return; }
    if (!customerEmail.trim() || !customerMobile.trim()) { setError("Please enter contact email and mobile number."); return; }
    if (!customerAddress.trim()) { setError("Please enter address (required for tickets and Coast Guard manifest)."); return; }
    if (!termsAccepted)      { setError("Please read and accept the Terms and Privacy Policy to continue."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          customer_email: customerEmail.trim(),
          customer_mobile: customerMobile.trim(),
          customer_address: customerAddress.trim(),
          ...(notifyAlsoEmail.trim() && { notify_also_email: notifyAlsoEmail.trim() }),
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          passenger_details: passengerDetails.map(p => ({
            fare_type: p.fare_type, full_name: p.full_name, address: p.address,
            gender: p.gender, birthdate: p.birthdate, nationality: p.nationality,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed"); return; }
      if (!isLoggedIn) {
        const params = new URLSearchParams({ mode:"signup", email:customerEmail.trim(), ref:data.reference });
        router.push(`${ROUTES.login}?${params.toString()}`);
        return;
      }
      setResult({ reference:data.reference, total_amount_cents:data.total_amount_cents, fare_breakdown:data.fare_breakdown });
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleConfirmBooking = async () => {
    if (!proofFile) { setProofError("Payment proof is required. Please upload your GCash screenshot before confirming."); return; }
    if (!result?.reference) return;
    setProofError(""); setUploadingProof(true);
    try {
      const fd = new FormData(); fd.set("reference", result.reference); fd.set("file", proofFile);
      const res = await fetch("/api/booking/upload-proof", { method:"POST", body:fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setProofError(data.error ?? "Upload failed"); return; }
      setProofUploaded(true); router.refresh(); resetBooking();
    } catch { setProofError("Network error. Please try again."); }
    finally { setUploadingProof(false); }
  };

  const handleIdUpload = async (pax: { key:string; fareType:string; name:string; passengerIndex:number }) => {
    const file = idFileRefs.current[pax.key]?.files?.[0];
    if (!file || !result?.reference) return;
    setIdUploads(p => ({ ...p, [pax.key]:"uploading" }));
    setIdUploadErrors(p => ({ ...p, [pax.key]:"" }));
    try {
      const fd = new FormData();
      fd.set("booking_reference", result.reference); fd.set("passenger_index", String(pax.passengerIndex));
      fd.set("passenger_name", pax.name); fd.set("discount_type", pax.fareType); fd.set("file", file);
      const res  = await fetch("/api/passenger-id", { method:"POST", body:fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setIdUploads(p=>({...p,[pax.key]:"error"})); setIdUploadErrors(p=>({...p,[pax.key]:data.error??"Upload failed"})); }
      else          { setIdUploads(p=>({...p,[pax.key]:"done"})); }
    } catch {
      setIdUploads(p=>({...p,[pax.key]:"error"})); setIdUploadErrors(p=>({...p,[pax.key]:"Network error."}));
    }
  };

  // ── Passenger block renderer ───────────────────────────────────────────────
  const renderBlock = (
    label: string, fareType: string, count: number,
    names: string[], setNames: (v:string[])=>void,
    addresses: string[], setAddresses: (v:string[])=>void,
    extras: PassengerExtra[], setExtras: (v:PassengerExtra[])=>void,
  ) => {
    if (count === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-[#134e4a] mb-2">{label} passengers</p>
        <div className="space-y-3">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="rounded-xl border border-teal-200 bg-white p-3 space-y-2">
              <input type="text" required value={names[i]??""} onChange={e=>{const n=[...names];n[i]=e.target.value;setNames(n);}}
                placeholder={`${label} ${i+1} — Full Name`}
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              <input type="text" value={addresses[i]??""} onChange={e=>{const n=[...addresses];n[i]=e.target.value;setAddresses(n);}}
                placeholder="Different address (optional)"
                className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              <PassengerExtraFields
                extra={extras[i]??{gender:"",birthdate:"",nationality:""}}
                onChange={u=>{const n=[...extras];n[i]=u;setExtras(n);}}
                savedTravelers={savedTravelers}
                onSelectTraveler={t=>{
                  const nn=[...names];nn[i]=t.full_name;setNames(nn);
                  const ne=[...extras];ne[i]={gender:t.gender??"",birthdate:t.birthdate??"",nationality:t.nationality??""};setExtras(ne);
                }}
                isLoggedIn={isLoggedIn}
                fareType={fareType}
                fare={fare}
                onSuggestSwitch={to => switchFareType(fareType, i, to)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Payment modal (shown after booking created) ────────────────────────────
  if (result) {
    return (
      <>
        <div className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#134e4a]">Book A Trip</h2>
          <p className="text-sm text-[#0f766e] mt-1">Your booking is created. Complete payment below to secure your seats.</p>
        </div>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"
          onClick={e => e.target === e.currentTarget && !proofUploaded && resetBooking()}>
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
              <h2 id="payment-modal-title" className="text-lg font-bold text-[#134e4a]">Complete payment</h2>
              {!proofUploaded && (
                <button type="button" onClick={resetBooking} aria-label="Close"
                  className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                <p className="font-semibold text-[#134e4a]">✓ Booking created</p>
                <p className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pending payment</p>
                <p className="font-mono text-xl font-bold text-[#0c7b93] mt-2">Ref: {result.reference}</p>
              </div>

              {/* Fare breakdown */}
              {result.fare_breakdown?.passenger_details?.length ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3">
                  <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Amount breakdown</p>
                  <ul className="space-y-1 text-sm text-[#134e4a]">
                    {result.fare_breakdown.passenger_details.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                        <span>{p.per_person_cents === 0 ? "Free" : `₱${(p.per_person_cents/100).toLocaleString()}`}</span>
                      </li>
                    ))}
                  </ul>
                  {result.fare_breakdown.fare_subtotal_cents != null && (
                    <div className="mt-2 pt-2 border-t border-teal-100 space-y-0.5">
                      <p className="text-sm text-[#134e4a]">Fare: ₱{(result.fare_breakdown.fare_subtotal_cents/100).toLocaleString()}</p>
                      {(result.fare_breakdown.admin_fee_cents ?? 0) > 0 && (
                        <p className="text-sm text-[#134e4a]">{result.fare_breakdown.admin_fee_label ?? "Platform Service Fee"}: ₱{((result.fare_breakdown.admin_fee_cents??0)/100).toLocaleString()}</p>
                      )}
                      {(result.fare_breakdown.gcash_fee_cents ?? 0) > 0 && result.fare_breakdown.gcash_fee_show_breakdown !== false && (
                        <p className="text-sm text-[#134e4a]">{result.fare_breakdown.gcash_fee_label ?? "Payment Processing Fee"}: ₱{((result.fare_breakdown.gcash_fee_cents??0)/100).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                  <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-bold text-[#134e4a]">
                    Total: ₱{(result.total_amount_cents/100).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#134e4a]">Total to pay: ₱{(result.total_amount_cents/100).toLocaleString()}</p>
              )}

              {/* GCash instructions */}
              {GCASH_NUMBER && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">
                    Send <strong>₱{(result.total_amount_cents/100).toLocaleString()}</strong> to{" "}
                    <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}).
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Put your reference <strong>{result.reference}</strong> in the message.
                  </p>
                </div>
              )}

              <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />

              {/* ID uploads for discount passengers */}
              {canUpload && discountPassengers.length > 0 && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-900">🪪 Upload Discount ID (Optional but recommended)</p>
                  <p className="text-xs text-blue-800">Upload a photo of each passenger&apos;s ID so our admin can verify it before your trip.</p>
                  <div className="space-y-3">
                    {discountPassengers.map(pax => {
                      const status = idUploads[pax.key] ?? "idle";
                      const err    = idUploadErrors[pax.key] ?? "";
                      return (
                        <div key={pax.key} className="rounded-lg border border-blue-200 bg-white p-3 space-y-2">
                          <p className="text-xs font-semibold text-blue-900 capitalize">{pax.fareType}: {pax.name}</p>
                          {status === "done" ? (
                            <p className="text-xs font-semibold text-green-700">✓ ID uploaded — pending admin verification</p>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50">
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="sr-only"
                                  disabled={status==="uploading"}
                                  ref={el => { idFileRefs.current[pax.key] = el; }}
                                  onChange={() => setIdUploadErrors(p => ({ ...p, [pax.key]:"" }))} />
                                📎 Choose ID photo
                              </label>
                              <button type="button" onClick={() => handleIdUpload(pax)} disabled={status==="uploading"}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                {status==="uploading" ? "Uploading…" : "Upload"}
                              </button>
                            </div>
                          )}
                          {err && <p className="text-xs text-red-700">⚠ {err}</p>}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-blue-700 italic">Skipping? Crew will ask for the physical ID upon boarding.</p>
                </div>
              )}

              {/* Payment proof */}
              {canUpload ? (
                <div className="space-y-3">
                  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900 mb-1">📎 Upload Payment Proof <span className="text-red-600">*</span></p>
                    <p className="text-xs text-amber-700 mb-3">
                      Upload a screenshot of your GCash payment showing the reference number.
                      <strong className="block mt-1">Booking will not be confirmed without proof.</strong>
                    </p>
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                      <input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        className="sr-only" disabled={uploadingProof||proofUploaded}
                        onChange={e => { setProofError(""); setProofFile(e.target.files?.[0]??null); }} />
                      {uploadingProof ? "Uploading…" : proofUploaded ? "✓ Proof submitted" : "Choose screenshot or PDF"}
                    </label>
                    {proofFile && !proofUploaded && <p className="mt-1 text-xs text-green-700">✓ {proofFile.name} selected</p>}
                  </div>
                  {proofError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-sm font-semibold text-red-700">⚠ {proofError}</p>
                    </div>
                  )}
                  <button type="button" onClick={handleConfirmBooking} disabled={uploadingProof||proofUploaded}
                    className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                    {uploadingProof ? "Uploading…" : proofUploaded ? "✓ Done" : "Confirm Booking"}
                  </button>
                  <button type="button" onClick={resetBooking}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                    I&apos;ll upload later (booking stays pending)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#0f766e]">
                    Sign in with <strong>{customerEmail || "your email"}</strong> to upload payment proof,
                    or pay at the ticket booth and present this reference.
                  </p>
                  <Link href={ROUTES.login} className="block w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] text-center">
                    Sign in to upload proof
                  </Link>
                  <button type="button" onClick={resetBooking}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                    Create another booking
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Booking form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-[#134e4a]">Book A Trip</h2>

      {/* Route */}
      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Route</label>
        <select value={routeId} onChange={e => { setRouteId(e.target.value); setTripId(""); }}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          disabled={loadingRoutes} required>
          <option value="">Select route</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Travel date</label>
        <input type="date" min={today} value={date} onChange={e => { setDate(e.target.value); setTripId(""); }}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" required />
        {date === today && <p className="mt-1 text-xs text-[#0f766e]">For today we only show trips that depart at least 30 minutes from now.</p>}
      </div>

      {/* Trip — now uses actual route data, no more idx-based direction guessing */}
      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Trip (vessel, time, route)</label>
        <select value={tripId} onChange={e => setTripId(e.target.value)}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          disabled={loadingTrips || !routeId || !date} required>
          <option value="">Select a trip</option>
          {trips.map(t => {
            const capacity  = t.boat?.capacity ?? (t.online_quota + t.walk_in_quota);
            const booked    = (t.online_booked ?? 0) + (t.walk_in_booked ?? 0);
            const available = Math.max(0, capacity - booked);
            const boatName  = t.boat?.name ?? "—";
            // ✅ Read direction directly from route data — no guessing
            const origin      = t.route?.origin      ?? "";
            const destination = t.route?.destination ?? "";
            const depDate = t.departure_date ?? date;
            const dateLabel = depDate
              ? new Date(depDate + "Z").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
              : "";
            return (
              <option key={t.id} value={t.id}>
                {dateLabel} {formatTime(t.departure_time)} — {boatName} · {origin} → {destination} ({available} seats)
              </option>
            );
          })}
        </select>
        {routeId && date && !loadingTrips && trips.length === 0 && (
          <p className="mt-1 text-xs text-[#0f766e]">No trips on this date for this route. Try another date.</p>
        )}
      </div>

      {/* Passenger counts */}
      <p className="text-sm font-medium text-[#134e4a]">Number of passengers by type</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {FARE_TYPE_OPTIONS.map(({ value, label }) => {
          const count = value==="adult" ? countAdult : value==="senior" ? countSenior : value==="pwd" ? countPwd : value==="student" ? countStudent : value==="child" ? countChild : countInfant;
          const setCount = value==="adult" ? setCountAdult : value==="senior" ? setCountSenior : value==="pwd" ? setCountPwd : value==="student" ? setCountStudent : value==="child" ? setCountChild : setCountInfant;
          return (
            <div key={value}>
              <label className="block text-xs font-medium text-[#0f766e] mb-1 whitespace-nowrap">{label}</label>
              <input type="number" min={0} max={20} value={count}
                onChange={e => setCount(Math.max(0, parseInt(e.target.value,10)||0))}
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
            </div>
          );
        })}
      </div>

      {/* Discount info */}
      {fare && (
        <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 space-y-0.5 text-xs text-[#0f766e]">
          <p className="font-semibold text-[#134e4a] mb-1">Discounted fares — ID required on boarding</p>
          <p>• Senior (60+ yrs): {fare.senior_discount_percent ?? 20}% off</p>
          <p>• PWD: {fare.pwd_discount_percent ?? 20}% off</p>
          <p>• Student: {fare.discount_percent ?? 20}% off — school ID required</p>
          <p>• Child ({fare.child_min_age ?? 7}–{fare.child_max_age ?? 12} yrs): {fare.child_discount_percent ?? 50}% off</p>
          <p>• Infant (under {fare.infant_max_age ?? 7} yrs): FREE</p>
        </div>
      )}

      {/* Live fare preview */}
      {totalPassengers > 0 && fare && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-1">
          <p className="text-xs font-semibold uppercase text-[#0f766e]">Amount breakdown</p>
          {passengerDetails.map((p, i) => {
            const cents = effectiveFareCents(baseFare, p.fare_type, fare);
            return (
              <p key={i} className="text-sm text-[#134e4a]">
                {p.full_name || `Passenger ${i+1}`} ({p.fare_type}): {cents===0 ? "FREE" : `₱${(cents/100).toLocaleString()}`}
              </p>
            );
          })}
          <div className="pt-1 border-t border-teal-100 space-y-0.5">
            <p className="text-sm text-[#134e4a]">Fare subtotal: ₱{(fareSubtotalCents/100).toLocaleString()}</p>
            {adminFeeCents > 0 && <p className="text-sm text-[#134e4a]">{fare.admin_fee_label ?? "Platform Service Fee"} (₱{(adminFeePerPax/100).toLocaleString()}/pax): ₱{(adminFeeCents/100).toLocaleString()}</p>}
            {gcashFee > 0 && fare.gcash_fee_show_breakdown !== false && <p className="text-sm text-[#134e4a]">{fare.gcash_fee_label ?? "Payment Processing Fee"}: ₱{(gcashFee/100).toLocaleString()}</p>}
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
          <p className="text-xs text-[#0f766e]">💡 You have {savedTravelers.length} saved traveler{savedTravelers.length!==1?"s":""}. Use the dropdowns in each passenger slot to auto-fill.</p>
        </div>
      )}

      {/* Address */}
      <div className="border-t border-teal-200 pt-4">
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Address (for tickets and Coast Guard manifest)</label>
        <input type="text" required value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
          placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
        {loggedInAddress && <p className="mt-1 text-xs text-[#0f766e]">Pre-filled from your account.</p>}
      </div>

      {/* Passenger blocks */}
      {renderBlock("Adult",   "adult",   countAdult,   adultNames,   setAdultNames,   adultAddresses,   setAdultAddresses,   adultExtras,   setAdultExtras)}
      {renderBlock("Senior",  "senior",  countSenior,  seniorNames,  setSeniorNames,  seniorAddresses,  setSeniorAddresses,  seniorExtras,  setSeniorExtras)}
      {renderBlock("PWD",     "pwd",     countPwd,     pwdNames,     setPwdNames,     pwdAddresses,     setPwdAddresses,     pwdExtras,     setPwdExtras)}
      {renderBlock("Student", "student", countStudent, studentNames, setStudentNames, studentAddresses, setStudentAddresses, studentExtras, setStudentExtras)}
      {renderBlock("Child",   "child",   countChild,   childNames,   setChildNames,   childAddresses,   setChildAddresses,   childExtras,   setChildExtras)}
      {renderBlock("Infant",  "infant",  countInfant,  infantNames,  setInfantNames,  infantAddresses,  setInfantAddresses,  infantExtras,  setInfantExtras)}

      {/* Contact */}
      <div className="border-t border-teal-200 pt-4 space-y-3">
        <p className="text-sm font-medium text-[#134e4a]">Contact (for this booking)</p>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Email</label>
          <input type="email" required value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
          {loggedInEmail && <p className="mt-1 text-xs text-[#0f766e]">Using your account email — this booking will appear in My Bookings.</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Mobile number</label>
          <input type="tel" required value={customerMobile} onChange={e => setCustomerMobile(e.target.value)}
            placeholder="e.g. 09XX XXX XXXX"
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Also notify (optional)</label>
          <input type="email" value={notifyAlsoEmail} onChange={e => setNotifyAlsoEmail(e.target.value)}
            placeholder="Another email — e.g. travel partner or family"
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
        </div>
      </div>

      {/* Terms */}
      <div className={`rounded-xl border-2 p-4 ${termsAccepted ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-amber-400 text-[#0c7b93] focus:ring-[#0c7b93]" />
          <span className="text-sm text-[#134e4a]">
            I have read and agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Privacy Policy</a>.
            I understand the refund and cancellation policy, including that once the vessel has departed, rebooking is not available.
            <span className="block mt-1 text-xs text-[#0f766e]">This acceptance is recorded with your booking (v{TERMS_VERSION}).</span>
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm font-semibold text-red-700">⚠ {error}</p>
        </div>
      )}

      <button type="submit" disabled={submitting || !tripId || totalPassengers < 1 || !termsAccepted}
        className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation">
        {submitting ? "Creating…" : "Create Booking"}
      </button>
    </form>
  );
}
