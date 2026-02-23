"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME, ROUTES } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";

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
};
type SavedTraveler = {
  id: string;
  full_name: string;
  gender: string | null;
  birthdate: string | null;
  nationality: string | null;
};
type PassengerExtra = {
  gender: string;
  birthdate: string;
  nationality: string;
};

const FARE_TYPE_OPTIONS = [
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
  { value: "pwd", label: "PWD" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant (<7)" },
] as const;

const NATIONALITIES = [
  "Filipino", "American", "Australian", "British", "Canadian", "Chinese",
  "French", "German", "Japanese", "Korean", "Singaporean", "Other"
];

const GENDERS = ["Male", "Female", "Other"];

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m || "00"} ${am ? "AM" : "PM"}`;
}

function fareCents(base: number, discount: number, fareType: string): number {
  if (fareType === "adult") return base;
  if (fareType === "infant") return 0;
  return Math.round(base * (1 - discount / 100));
}

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill("")];
  return arr.slice(0, len);
}

function ensureExtraLength(arr: PassengerExtra[], len: number): PassengerExtra[] {
  const empty: PassengerExtra = { gender: "", birthdate: "", nationality: "" };
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill(empty).map(() => ({ ...empty }))];
  return arr.slice(0, len);
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

// Reusable passenger extra fields (gender, birthdate, nationality)
function PassengerExtraFields({
  extra,
  onChange,
  savedTravelers,
  onSelectTraveler,
  isLoggedIn,
}: {
  extra: PassengerExtra;
  onChange: (updated: PassengerExtra) => void;
  savedTravelers: SavedTraveler[];
  onSelectTraveler: (t: SavedTraveler) => void;
  isLoggedIn: boolean;
}) {
  const age = extra.birthdate ? calcAge(extra.birthdate) : null;
  return (
    <div className="mt-1 rounded-lg border border-teal-100 bg-teal-50/30 p-2 space-y-2">
      {isLoggedIn && savedTravelers.length > 0 && (
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Fill from saved travelers</label>
          <select
            value=""
            onChange={(e) => {
              const t = savedTravelers.find((s) => s.id === e.target.value);
              if (t) onSelectTraveler(t);
            }}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">— Select saved traveler —</option>
            {savedTravelers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Gender</label>
          <select
            value={extra.gender}
            onChange={(e) => onChange({ ...extra, gender: e.target.value })}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Birthdate</label>
          <input
            type="date"
            value={extra.birthdate}
            onChange={(e) => onChange({ ...extra, birthdate: e.target.value })}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
          {age !== null && <p className="text-xs text-[#0f766e] mt-0.5">{age} yrs</p>}
        </div>
        <div>
          <label className="block text-xs text-[#0f766e] mb-1">Nationality</label>
          <select
            value={extra.nationality}
            onChange={(e) => onChange({ ...extra, nationality: e.target.value })}
            className="w-full rounded-lg border border-teal-200 px-2 py-1.5 text-xs text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          >
            <option value="">—</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
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
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeId, setRouteId] = useState(initialRouteId);
  const [date, setDate] = useState(initialDate);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripId, setTripId] = useState("");
  const [fare, setFare] = useState<FareRow | null>(null);
  const [countAdult, setCountAdult] = useState(1);
  const [countSenior, setCountSenior] = useState(0);
  const [countPwd, setCountPwd] = useState(0);
  const [countChild, setCountChild] = useState(0);
  const [countInfant, setCountInfant] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([loggedInName]);
  const [seniorNames, setSeniorNames] = useState<string[]>([]);
  const [pwdNames, setPwdNames] = useState<string[]>([]);
  const [childNames, setChildNames] = useState<string[]>([]);
  const [infantNames, setInfantNames] = useState<string[]>([]);
  const [customerEmail, setCustomerEmail] = useState(loggedInEmail);
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState(loggedInAddress);
  const [notifyAlsoEmail, setNotifyAlsoEmail] = useState("");
  const [adultAddresses, setAdultAddresses] = useState<string[]>([]);
  const [seniorAddresses, setSeniorAddresses] = useState<string[]>([]);
  const [pwdAddresses, setPwdAddresses] = useState<string[]>([]);
  const [childAddresses, setChildAddresses] = useState<string[]>([]);
  const [infantAddresses, setInfantAddresses] = useState<string[]>([]);

  // Extra fields: gender, birthdate, nationality per passenger
  const firstAdultExtra: PassengerExtra = {
    gender: loggedInGender,
    birthdate: loggedInBirthdate,
    nationality: loggedInNationality,
  };
  const [adultExtras, setAdultExtras] = useState<PassengerExtra[]>([firstAdultExtra]);
  const [seniorExtras, setSeniorExtras] = useState<PassengerExtra[]>([]);
  const [pwdExtras, setPwdExtras] = useState<PassengerExtra[]>([]);
  const [childExtras, setChildExtras] = useState<PassengerExtra[]>([]);
  const [infantExtras, setInfantExtras] = useState<PassengerExtra[]>([]);

  // Saved travelers
  const [savedTravelers, setSavedTravelers] = useState<SavedTraveler[]>([]);
  const isLoggedIn = !!loggedInEmail?.trim();

  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingFare, setLoadingFare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number;
      discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
      fare_subtotal_cents?: number;
      gcash_fee_cents?: number;
      gcash_fee_label?: string;
      gcash_fee_show_breakdown?: boolean;
      admin_fee_cents?: number;
      admin_fee_label?: string;
      total_cents?: number;
    };
  } | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const canUpload = !!loggedInEmail?.trim() && (customerEmail.trim().toLowerCase() === loggedInEmail.trim().toLowerCase());

  // Load saved travelers if logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/saved-travelers")
      .then((r) => r.json())
      .then((data) => setSavedTravelers(data.travelers ?? []))
      .catch(() => {});
  }, [isLoggedIn]);

  const resetBooking = useCallback(() => {
    setResult(null);
    setTripId("");
    setCountAdult(1);
    setCountSenior(0);
    setCountPwd(0);
    setCountChild(0);
    setCountInfant(0);
    setAdultNames([loggedInName]);
    setSeniorNames([]);
    setPwdNames([]);
    setChildNames([]);
    setInfantNames([]);
    setAdultExtras([firstAdultExtra]);
    setSeniorExtras([]);
    setPwdExtras([]);
    setChildExtras([]);
    setInfantExtras([]);
    setCustomerEmail(loggedInEmail);
    setCustomerMobile("");
    setProofUploaded(false);
    setProofError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInName, loggedInEmail]);

  const handleConfirmBooking = async () => {
    const file = paymentProofInputRef.current?.files?.[0];
    if (!file) { setProofError("Please upload your GCash payment screenshot first."); return; }
    if (!result?.reference) return;
    setProofError("");
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.set("reference", result.reference);
      formData.set("file", file);
      const res = await fetch("/api/booking/upload-proof", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setProofError(data.error ?? "Upload failed"); return; }
      setProofUploaded(true);
      router.refresh();
      resetBooking();
    } catch { setProofError("Network error. Please try again."); }
    finally {
      setUploadingProof(false);
      if (paymentProofInputRef.current) paymentProofInputRef.current.value = "";
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/booking/routes")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRoutes(data); setLoadingRoutes(false); })
      .catch(() => setLoadingRoutes(false));
  }, []);

  useEffect(() => { if (initialRouteId) setRouteId(initialRouteId); }, [initialRouteId]);
  useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);

  useEffect(() => {
    if (!routeId || !date) { setTrips([]); setTripId(""); return; }
    setLoadingTrips(true);
    setTripId("");
    fetch(`/api/booking/trips?route_id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => { setTrips(Array.isArray(data) ? data : []); setLoadingTrips(false); })
      .catch(() => setLoadingTrips(false));
  }, [routeId, date]);

  const loadFare = useCallback(() => {
    if (!routeId) { setFare(null); return; }
    setLoadingFare(true);
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        setFare(data?.base_fare_cents != null ? {
          base_fare_cents: data.base_fare_cents,
          discount_percent: data.discount_percent ?? 20,
          admin_fee_cents_per_passenger: data.admin_fee_cents_per_passenger,
          gcash_fee_cents: data.gcash_fee_cents,
        } : null);
        setLoadingFare(false);
      })
      .catch(() => setLoadingFare(false));
  }, [routeId]);

  useEffect(() => { loadFare(); }, [loadFare]);

  useEffect(() => { setAdultNames((p) => ensureLength(p, countAdult)); setAdultAddresses((p) => ensureLength(p, countAdult)); setAdultExtras((p) => ensureExtraLength(p, countAdult)); }, [countAdult]);
  useEffect(() => { setSeniorNames((p) => ensureLength(p, countSenior)); setSeniorAddresses((p) => ensureLength(p, countSenior)); setSeniorExtras((p) => ensureExtraLength(p, countSenior)); }, [countSenior]);
  useEffect(() => { setPwdNames((p) => ensureLength(p, countPwd)); setPwdAddresses((p) => ensureLength(p, countPwd)); setPwdExtras((p) => ensureExtraLength(p, countPwd)); }, [countPwd]);
  useEffect(() => { setChildNames((p) => ensureLength(p, countChild)); setChildAddresses((p) => ensureLength(p, countChild)); setChildExtras((p) => ensureExtraLength(p, countChild)); }, [countChild]);
  useEffect(() => { setInfantNames((p) => ensureLength(p, countInfant)); setInfantAddresses((p) => ensureLength(p, countInfant)); setInfantExtras((p) => ensureExtraLength(p, countInfant)); }, [countInfant]);

  const baseFare = fare?.base_fare_cents ?? 55000;
  const discount = fare?.discount_percent ?? 20;

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string; address: string; gender?: string; age?: number; nationality?: string; birthdate?: string }[] = [];
    const mainAddr = customerAddress.trim();
    const addPassengers = (
      count: number,
      fareType: string,
      names: string[],
      addresses: string[],
      extras: PassengerExtra[]
    ) => {
      for (let i = 0; i < count; i++) {
        const extra = extras[i] ?? { gender: "", birthdate: "", nationality: "" };
        const age = extra.birthdate ? calcAge(extra.birthdate) : undefined;
        list.push({
          fare_type: fareType,
          full_name: names[i]?.trim() ?? "",
          address: addresses[i]?.trim() || mainAddr,
          gender: extra.gender || undefined,
          birthdate: extra.birthdate || undefined,
          age: age ?? undefined,
          nationality: extra.nationality || undefined,
        });
      }
    };
    addPassengers(countAdult, "adult", adultNames, adultAddresses, adultExtras);
    addPassengers(countSenior, "senior", seniorNames, seniorAddresses, seniorExtras);
    addPassengers(countPwd, "pwd", pwdNames, pwdAddresses, pwdExtras);
    addPassengers(countChild, "child", childNames, childAddresses, childExtras);
    addPassengers(countInfant, "infant", infantNames, infantAddresses, infantExtras);
    return list;
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames, adultAddresses, seniorAddresses, pwdAddresses, childAddresses, infantAddresses, customerAddress, adultExtras, seniorExtras, pwdExtras, childExtras, infantExtras]);

  const fareSubtotalCents = useMemo(
    () => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0),
    [passengerDetails, baseFare, discount]
  );
  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;
  const adminFeePerPax = fare?.admin_fee_cents_per_passenger ?? 2000;
  const gcashFee = fare?.gcash_fee_cents ?? 1500;
  const adminFeeCents = totalPassengers * adminFeePerPax;
  const totalCents = fareSubtotalCents + gcashFee + adminFeeCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!tripId) { setError("Please select route, date, and departure time."); return; }
    if (totalPassengers < 1) { setError("Add at least one passenger (e.g. 1 Adult)."); return; }
    const hasEmptyName = passengerDetails.some((p) => !p.full_name);
    if (hasEmptyName) { setError("Please enter the name for every passenger."); return; }
    if (!customerEmail.trim() || !customerMobile.trim()) { setError("Please enter contact email and mobile number."); return; }
    if (!customerAddress.trim()) { setError("Please enter address (required for tickets and Coast Guard manifest)."); return; }
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
          passenger_details: passengerDetails.map((p) => ({
            fare_type: p.fare_type,
            full_name: p.full_name,
            address: p.address,
            gender: p.gender,
            birthdate: p.birthdate,
            nationality: p.nationality,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed"); return; }
      if (!loggedInEmail?.trim()) {
        const params = new URLSearchParams({ mode: "signup", email: customerEmail.trim(), ref: data.reference });
        router.push(`${ROUTES.login}?${params.toString()}`);
        return;
      }
      setResult({ reference: data.reference, total_amount_cents: data.total_amount_cents, fare_breakdown: data.fare_breakdown });
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  // Helper: render passenger name + extra fields block
  const renderPassengerBlock = (
    label: string,
    count: number,
    names: string[],
    setNames: (v: string[]) => void,
    addresses: string[],
    setAddresses: (v: string[]) => void,
    extras: PassengerExtra[],
    setExtras: (v: PassengerExtra[]) => void,
  ) => {
    if (count === 0) return null;
    return (
      <div>
        <p className="text-sm font-medium text-[#134e4a] mb-2">{label} — full name</p>
        <div className="space-y-3">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="rounded-xl border border-teal-200 bg-white p-3 space-y-2">
              <input
                type="text"
                required
                value={names[i] ?? ""}
                onChange={(e) => { const next = [...names]; next[i] = e.target.value; setNames(next); }}
                placeholder={`${label} ${i + 1} full name`}
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <input
                type="text"
                value={addresses[i] ?? ""}
                onChange={(e) => { const next = [...addresses]; next[i] = e.target.value; setAddresses(next); }}
                placeholder="Different address (optional)"
                className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <PassengerExtraFields
                extra={extras[i] ?? { gender: "", birthdate: "", nationality: "" }}
                onChange={(updated) => { const next = [...extras]; next[i] = updated; setExtras(next); }}
                savedTravelers={savedTravelers}
                onSelectTraveler={(t) => {
                  const nextNames = [...names]; nextNames[i] = t.full_name; setNames(nextNames);
                  const nextExtras = [...extras];
                  nextExtras[i] = { gender: t.gender ?? "", birthdate: t.birthdate ?? "", nationality: t.nationality ?? "" };
                  setExtras(nextExtras);
                }}
                isLoggedIn={isLoggedIn}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (result) {
    return (
      <>
        <form onSubmit={(e) => e.preventDefault()} className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-[#134e4a]">Book A Trip</h2>
          <p className="text-sm text-[#0f766e]">Your booking is created. Complete payment below to secure your seats.</p>
        </form>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onClick={(e) => e.target === e.currentTarget && !proofUploaded && resetBooking()}>
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
              <h2 id="payment-modal-title" className="text-lg font-bold text-[#134e4a]">Complete payment</h2>
              {!proofUploaded && (
                <button type="button" onClick={resetBooking} className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100 transition-colors" aria-label="Close">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="p-4 space-y-4">
              <p className="font-mono text-xl font-bold text-[#0c7b93]">Reference: {result.reference}</p>
              {result.fare_breakdown?.passenger_details?.length ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3">
                  <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Amount breakdown</p>
                  <ul className="space-y-2 text-sm text-[#134e4a]">
                    {result.fare_breakdown.passenger_details.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                        <span>{p.per_person_cents === 0 ? "Free" : `₱${(p.per_person_cents / 100).toLocaleString()}`}</span>
                      </li>
                    ))}
                  </ul>
                  {result.fare_breakdown.fare_subtotal_cents != null && (
                    <>
                      <p className="mt-2 text-sm text-[#134e4a]">Fare: ₱{(result.fare_breakdown.fare_subtotal_cents / 100).toLocaleString()}</p>
                      {(result.fare_breakdown.admin_fee_cents ?? 0) > 0 && (
                        <p className="text-sm text-[#134e4a]">{result.fare_breakdown.admin_fee_label ?? "Platform Service Fee"}: ₱{((result.fare_breakdown.admin_fee_cents ?? 0) / 100).toLocaleString()}</p>
                      )}
                      {(result.fare_breakdown.gcash_fee_cents ?? 0) > 0 && result.fare_breakdown.gcash_fee_show_breakdown !== false && (
                        <p className="text-sm text-[#134e4a]">{result.fare_breakdown.gcash_fee_label ?? "Payment Processing Fee"}: ₱{((result.fare_breakdown.gcash_fee_cents ?? 0) / 100).toLocaleString()}</p>
                      )}
                    </>
                  )}
                  <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-semibold text-[#134e4a]">Total: ₱{(result.total_amount_cents / 100).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#134e4a]">Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}</p>
              )}
              {GCASH_NUMBER && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">Send <strong>₱{(result.total_amount_cents / 100).toLocaleString()}</strong> to <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}).</p>
                  <p className="text-sm text-amber-800 mt-1">Put your reference <strong>{result.reference}</strong> in the message.</p>
                </div>
              )}
              <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              {canUpload ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-[#134e4a] mb-2">Submit payment proof</p>
                    <p className="text-xs text-[#0f766e] mb-2">Upload a screenshot of your GCash payment showing the reference number so we can confirm your booking faster.</p>
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                      <input ref={paymentProofInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="sr-only" onChange={() => setProofError("")} disabled={uploadingProof || proofUploaded} />
                      {uploadingProof ? "Uploading…" : proofUploaded ? "Proof submitted" : "Choose screenshot or PDF"}
                    </label>
                  </div>
                  {proofError && <p className="text-sm text-red-600">{proofError}</p>}
                  <button type="button" onClick={handleConfirmBooking} disabled={uploadingProof || proofUploaded} className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
                    {uploadingProof ? "Uploading…" : proofUploaded ? "Done" : "Confirm Booking"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#0f766e]">Sign in with <strong>{customerEmail || "your email"}</strong> to upload payment proof, or pay at the ticket booth and present this reference.</p>
                  <Link href={ROUTES.login} className="block w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] text-center">Sign in to upload proof</Link>
                </div>
              )}
              <button type="button" onClick={resetBooking} className="w-full rounded-xl border border-[#0c7b93] px-4 py-2 text-sm font-medium text-[#0c7b93] hover:bg-[#0c7b93]/10">Create another booking</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-[#134e4a]">Book A Trip</h2>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Route</label>
        <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setTripId(""); }} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" disabled={loadingRoutes} required>
          <option value="">Select route</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Travel date</label>
        <input type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setTripId(""); }} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" required />
        {date === today && <p className="mt-1 text-xs text-[#0f766e]">For today we only show trips that depart at least 30 minutes from now so you have time to pay and board.</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Trip (date, time, route)</label>
        <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" disabled={loadingTrips || !routeId || !date} required>
          <option value="">Select a trip</option>
          {trips.map((t, idx) => {
            const ob = t.online_booked ?? 0; const wb = t.walk_in_booked ?? 0;
            const capacity = t.boat?.capacity ?? (t.online_quota ?? 0) + (t.walk_in_quota ?? 0);
            const available = Math.max(0, capacity - ob - wb);
            const boatName = t.boat?.name ?? "—";
            const r = t.route; const origin = r?.origin ?? ""; const destination = r?.destination ?? "";
            const directionLabel = idx === 0 ? `${origin} → ${destination}` : `${destination} → ${origin}`;
            const depDate = t.departure_date ?? date;
            const dateLabel = depDate ? new Date(depDate + "Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
            return <option key={t.id} value={t.id}>{dateLabel} {formatTime(t.departure_time)} — {directionLabel} · {boatName} ({available} seats available)</option>;
          })}
        </select>
        {routeId && date && !loadingTrips && trips.length === 0 && <p className="mt-1 text-xs text-[#0f766e]">No trips on this date for this route. Try another date.</p>}
      </div>

      <p className="text-sm font-medium text-[#134e4a]">Number of passengers by type</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FARE_TYPE_OPTIONS.map(({ value, label }) => {
          const count = value === "adult" ? countAdult : value === "senior" ? countSenior : value === "pwd" ? countPwd : value === "child" ? countChild : countInfant;
          const setCount = value === "adult" ? setCountAdult : value === "senior" ? setCountSenior : value === "pwd" ? setCountPwd : value === "child" ? setCountChild : setCountInfant;
          return (
            <div key={value}>
              <label className="block text-xs font-medium text-[#0f766e] mb-1 whitespace-nowrap">{label}</label>
              <input type="number" min={0} max={20} value={count} onChange={(e) => setCount(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
            </div>
          );
        })}
      </div>

      {totalPassengers > 0 && fare && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-1">
          <p className="text-xs font-semibold uppercase text-[#0f766e]">Amount breakdown</p>
          <p className="text-sm text-[#134e4a]">Fare: ₱{(fareSubtotalCents / 100).toLocaleString()}</p>
          {adminFeeCents > 0 && (
            <p className="text-sm text-[#134e4a]">{fare.admin_fee_label ?? "Platform Service Fee"} (₱{(adminFeePerPax / 100).toLocaleString()}/pax): ₱{(adminFeeCents / 100).toLocaleString()}</p>
          )}
          {gcashFee > 0 && fare.gcash_fee_show_breakdown !== false && (
            <p className="text-sm text-[#134e4a]">{fare.gcash_fee_label ?? "Payment Processing Fee"}: ₱{(gcashFee / 100).toLocaleString()}</p>
          )}
          <p className="text-sm font-semibold text-[#134e4a] pt-1 border-t border-teal-200">Total: ₱{(totalCents / 100).toLocaleString()} ({totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""})</p>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
        <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
      </div>

      {isLoggedIn && savedTravelers.length > 0 && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/20 px-3 py-2">
          <p className="text-xs text-[#0f766e]">💡 You have {savedTravelers.length} saved traveler{savedTravelers.length !== 1 ? "s" : ""}. Use the dropdowns in each passenger slot to auto-fill their info.</p>
        </div>
      )}

      {renderPassengerBlock("Adult", countAdult, adultNames, setAdultNames, adultAddresses, setAdultAddresses, adultExtras, setAdultExtras)}
      {renderPassengerBlock("Senior", countSenior, seniorNames, setSeniorNames, seniorAddresses, setSeniorAddresses, seniorExtras, setSeniorExtras)}
      {renderPassengerBlock("PWD", countPwd, pwdNames, setPwdNames, pwdAddresses, setPwdAddresses, pwdExtras, setPwdExtras)}
      {renderPassengerBlock("Child", countChild, childNames, setChildNames, childAddresses, setChildAddresses, childExtras, setChildExtras)}
      {renderPassengerBlock("Infant (<7)", countInfant, infantNames, setInfantNames, infantAddresses, setInfantAddresses, infantExtras, setInfantExtras)}

      <div className="border-t border-teal-200 pt-4">
        <p className="text-sm font-medium text-[#134e4a] mb-2">Address (for tickets and Coast Guard manifest)</p>
        <div className="mb-4">
          <label className="block text-xs text-[#0f766e] mb-1">Group address</label>
          <input type="text" required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="e.g. Brgy. Dapa, General Luna, Siargao" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
          {loggedInAddress && <p className="mt-1 text-xs text-[#0f766e]">Pre-filled from your account. Same for all passengers unless you enter a different one below.</p>}
          {!loggedInAddress && <p className="mt-1 text-xs text-[#0f766e]">Required. Used on tickets and manifest.</p>}
        </div>
      </div>

      <div className="border-t border-teal-200 pt-4">
        <p className="text-sm font-medium text-[#134e4a] mb-2">Contact (for this booking)</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Email</label>
            <input type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
            {loggedInEmail && <p className="mt-1 text-xs text-[#0f766e]">Using your account email — this booking will appear in My bookings.</p>}
          </div>
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Mobile number</label>
            <input type="tel" required value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="e.g. 09XX XXX XXXX" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
            <p className="mt-0.5 text-xs text-[#0f766e]">Used on the manifest for all passengers unless individually overridden.</p>
          </div>
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Also notify (optional)</label>
            <input type="email" value={notifyAlsoEmail} onChange={(e) => setNotifyAlsoEmail(e.target.value)} placeholder="Another email to receive the same notification" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" aria-label="Optional second email for notifications" />
            <p className="mt-0.5 text-xs text-[#0f766e]/80">e.g. travel partner or family — they'll get the payment required email too.</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || !tripId || totalPassengers < 1} className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation">
        {submitting ? "Creating…" : "Create Booking"}
      </button>
    </form>
  );
}
