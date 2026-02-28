"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { formatTime, passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";

const TERMS_VERSION = "1.0";

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

function fareCents(base: number, discount: number, fareType: string): number {
  if (fareType === "adult") return base;
  if (fareType === "infant") return 0;
  return Math.round(base * (1 - discount / 100));
}

type FareRow = {
  base_fare_cents: number;
  discount_percent: number;
  admin_fee_cents_per_passenger?: number;
  gcash_fee_cents?: number;
};
type SavedTraveler = {
  id: string;
  full_name: string;
  gender: string | null;
  birthdate: string | null;
  nationality: string | null;
};
type PassengerExtra = { gender: string; birthdate: string; nationality: string };

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill("")];
  return arr.slice(0, len);
}
function ensureExtraLength(arr: PassengerExtra[], len: number): PassengerExtra[] {
  const empty: PassengerExtra = { gender: "", birthdate: "", nationality: "" };
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill(null).map(() => ({ ...empty }))];
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
    </div>
  );
}

export function BookingModal({
  trip,
  onClose,
  loggedInEmail = "",
  passengerName,
  loggedInAddress = "",
  loggedInGender = "",
  loggedInBirthdate = "",
  loggedInNationality = "",
}: {
  trip: UpcomingTripRow;
  onClose: () => void;
  loggedInEmail?: string;
  passengerName?: string;
  loggedInAddress?: string;
  loggedInGender?: string;
  loggedInBirthdate?: string;
  loggedInNationality?: string;
}) {
  const routeName =
    trip.route?.display_name ??
    [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" ↔ ") ??
    "—";
  const vesselName = trip.boat?.name ?? "—";
  const toast = useToast();
  const isLoggedIn = !!loggedInEmail?.trim();

  const firstAdultExtra: PassengerExtra = {
    gender: loggedInGender,
    birthdate: loggedInBirthdate,
    nationality: loggedInNationality,
  };

  const [fare, setFare] = useState<FareRow | null>(null);
  const [countAdult, setCountAdult] = useState(1);
  const [countSenior, setCountSenior] = useState(0);
  const [countPwd, setCountPwd] = useState(0);
  const [countChild, setCountChild] = useState(0);
  const [countInfant, setCountInfant] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([passengerName ?? ""]);
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
  const [adultExtras, setAdultExtras] = useState<PassengerExtra[]>([firstAdultExtra]);
  const [seniorExtras, setSeniorExtras] = useState<PassengerExtra[]>([]);
  const [pwdExtras, setPwdExtras] = useState<PassengerExtra[]>([]);
  const [childExtras, setChildExtras] = useState<PassengerExtra[]>([]);
  const [infantExtras, setInfantExtras] = useState<PassengerExtra[]>([]);
  const [savedTravelers, setSavedTravelers] = useState<SavedTraveler[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [proofUploaded, setProofUploaded] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ── NEW STATE ──────────────────────────────────────────────────────────
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Track which senior/PWD passengers have waived their ID requirement
  // key: "senior-0", "pwd-1", etc. value: true = waived
  const [idWaivers, setIdWaivers] = useState<Record<string, boolean>>({});
  // ──────────────────────────────────────────────────────────────────────

  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number;
      discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
      fare_subtotal_cents?: number;
      gcash_fee_cents?: number;
      admin_fee_cents?: number;
      total_cents?: number;
    };
  } | null>(null);

  // Load saved travelers
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/saved-travelers")
      .then((r) => r.json())
      .then((data) => setSavedTravelers(data.travelers ?? []))
      .catch(() => {});
  }, [isLoggedIn]);

  const routeId = trip.route?.id;
  useEffect(() => {
    if (!routeId) return;
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.base_fare_cents != null) {
          setFare({ base_fare_cents: data.base_fare_cents, discount_percent: data.discount_percent ?? 20, admin_fee_cents_per_passenger: data.admin_fee_cents_per_passenger, gcash_fee_cents: data.gcash_fee_cents });
        }
      })
      .catch(() => {});
  }, [routeId]);

  useEffect(() => { setAdultNames((p) => ensureLength(p, countAdult)); setAdultAddresses((p) => ensureLength(p, countAdult)); setAdultExtras((p) => ensureExtraLength(p, countAdult)); }, [countAdult]);
  useEffect(() => { setSeniorNames((p) => ensureLength(p, countSenior)); setSeniorAddresses((p) => ensureLength(p, countSenior)); setSeniorExtras((p) => ensureExtraLength(p, countSenior)); }, [countSenior]);
  useEffect(() => { setPwdNames((p) => ensureLength(p, countPwd)); setPwdAddresses((p) => ensureLength(p, countPwd)); setPwdExtras((p) => ensureExtraLength(p, countPwd)); }, [countPwd]);
  useEffect(() => { setChildNames((p) => ensureLength(p, countChild)); setChildAddresses((p) => ensureLength(p, countChild)); setChildExtras((p) => ensureExtraLength(p, countChild)); }, [countChild]);
  useEffect(() => { setInfantNames((p) => ensureLength(p, countInfant)); setInfantAddresses((p) => ensureLength(p, countInfant)); setInfantExtras((p) => ensureExtraLength(p, countInfant)); }, [countInfant]);

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
    add(countAdult, "adult", adultNames, adultAddresses, adultExtras);
    add(countSenior, "senior", seniorNames, seniorAddresses, seniorExtras);
    add(countPwd, "pwd", pwdNames, pwdAddresses, pwdExtras);
    add(countChild, "child", childNames, childAddresses, childExtras);
    add(countInfant, "infant", infantNames, infantAddresses, infantExtras);
    return list;
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames, adultAddresses, seniorAddresses, pwdAddresses, childAddresses, infantAddresses, customerAddress, adultExtras, seniorExtras, pwdExtras, childExtras, infantExtras]);

  const fareSubtotalCents = useMemo(() => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0), [passengerDetails, baseFare, discount]);
  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;
  const adminFeePerPax = fare?.admin_fee_cents_per_passenger ?? 2000;
  const gcashFee = fare?.gcash_fee_cents ?? 1500;
  const adminFeeCents = totalPassengers * adminFeePerPax;
  const totalCents = fareSubtotalCents + gcashFee + adminFeeCents;

  // ── Detect senior/PWD passengers needing ID notice ────────────────────
  const seniorOrPwdPassengers = useMemo(() => {
    const result: { key: string; fareType: string; name: string; index: number }[] = [];
    seniorNames.forEach((name, i) => {
      result.push({ key: `senior-${i}`, fareType: "senior", name: name || `Senior ${i + 1}`, index: i });
    });
    // Adults aged 60+ also qualify
    adultNames.forEach((name, i) => {
      const age = adultExtras[i]?.birthdate ? calcAge(adultExtras[i].birthdate) : null;
      if (age !== null && age >= 60) {
        result.push({ key: `adult-senior-${i}`, fareType: "adult-senior", name: name || `Adult ${i + 1}`, index: i });
      }
    });
    pwdNames.forEach((name, i) => {
      result.push({ key: `pwd-${i}`, fareType: "pwd", name: name || `PWD ${i + 1}`, index: i });
    });
    return result;
  }, [seniorNames, pwdNames, adultNames, adultExtras]);
  // ──────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (totalPassengers < 1) { setError("Add at least one passenger (e.g. 1 Adult)."); return; }
    const hasEmptyName = passengerDetails.some((p) => !p.full_name);
    if (hasEmptyName) { setError("Please enter the name for every passenger."); return; }
    if (!customerEmail.trim() || !customerMobile.trim()) { setError("Please enter contact email and mobile number."); return; }
    if (!customerAddress.trim()) { setError("Please enter address (required for tickets and manifest)."); return; }

    // ── FIX 2: Terms required ─────────────────────────────────────────
    if (!termsAccepted) { setError("Please read and accept the Terms and Privacy Policy to continue."); return; }
    // ──────────────────────────────────────────────────────────────────

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
          // ── FIX 2: Record terms acceptance ──────────────────────────
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          // ── FIX 3: Record ID waivers in passenger details ────────────
          id_waivers: idWaivers,
          // ────────────────────────────────────────────────────────────
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
      setResult({ reference: data.reference, total_amount_cents: data.total_amount_cents, fare_breakdown: data.fare_breakdown });
      toast.showSuccess(`Booking ${data.reference} created. Upload payment proof below to confirm.`);
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleConfirmBooking = async () => {
    // ── FIX 1: Proof required ─────────────────────────────────────────
    const file = paymentProofInputRef.current?.files?.[0];
    if (!file) { setProofError("Payment proof is required. Please upload your GCash screenshot before confirming."); return; }
    // ──────────────────────────────────────────────────────────────────
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
      toast.showSuccess("Payment proof uploaded. We'll verify and confirm your booking soon.");
      router.refresh();
      onClose();
    } catch { setProofError("Network error. Please try again."); }
    finally { setUploadingProof(false); if (paymentProofInputRef.current) paymentProofInputRef.current.value = ""; }
  };

  // Helper: render one passenger type block
  const renderPassengerBlock = (
    label: string, count: number,
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
              <input
                type="text" required value={names[i] ?? ""}
                onChange={(e) => { const n = [...names]; n[i] = e.target.value; setNames(n); }}
                placeholder={`${label} ${i + 1} name`}
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <input
                type="text" value={addresses[i] ?? ""}
                onChange={(e) => { const n = [...addresses]; n[i] = e.target.value; setAddresses(n); }}
                placeholder="Different address (optional)"
                className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              />
              <PassengerExtraFields
                extra={extras[i] ?? { gender: "", birthdate: "", nationality: "" }}
                onChange={(updated) => { const n = [...extras]; n[i] = updated; setExtras(n); }}
                savedTravelers={savedTravelers}
                onSelectTraveler={(t) => {
                  const nn = [...names]; nn[i] = t.full_name; setNames(nn);
                  const ne = [...extras]; ne[i] = { gender: t.gender ?? "", birthdate: t.birthdate ?? "", nationality: t.nationality ?? "" }; setExtras(ne);
                }}
                isLoggedIn={isLoggedIn}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
          <h2 id="booking-modal-title" className="text-lg font-bold text-[#134e4a]">Book This Trip</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl border border-teal-200 bg-[#fef9e7]/50 px-4 py-3 mb-4">
            <p className="font-semibold text-[#134e4a]">{formatTime(trip.departure_time)} · {vesselName}</p>
            <p className="text-sm text-[#0f766e]">{routeName}</p>
            <p className="text-xs text-[#0f766e] mt-1">
              {new Date(trip.departure_date + "Z").toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {result ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
              <p className="font-semibold text-[#134e4a]">Booking created</p>
              <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Status: Pending payment</p>
              <p className="font-mono text-xl font-bold text-[#0c7b93] mt-2">Reference: {result.reference}</p>
              <div className="mt-4 rounded-lg border border-teal-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Fare breakdown (discount & charges)</p>
                {result.fare_breakdown?.passenger_details?.length ? (
                  <ul className="space-y-2 text-sm text-[#134e4a]">
                    {result.fare_breakdown.passenger_details.map((p, i) => {
                      const base = result.fare_breakdown?.base_fare_cents ?? 55000;
                      const discountPct = result.fare_breakdown?.discount_percent ?? 20;
                      const isFree = p.per_person_cents === 0;
                      const isDiscounted = !isFree && p.fare_type !== "adult";
                      return (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                          <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                          <span className="text-right">
                            {isFree ? <strong>Free</strong> : isDiscounted ? <>₱{(base / 100).toLocaleString()} − {discountPct}% = <strong>₱{(p.per_person_cents / 100).toLocaleString()}</strong></> : <strong>₱{(p.per_person_cents / 100).toLocaleString()}</strong>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {result.fare_breakdown?.fare_subtotal_cents != null && (
                  <>
                    <p className="mt-2 text-sm text-[#134e4a]">Fare: ₱{(result.fare_breakdown.fare_subtotal_cents / 100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Platform Service Fee (₱20/pax): ₱{((result.fare_breakdown.admin_fee_cents ?? 0) / 100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Payment Processing Fee: ₱{((result.fare_breakdown.gcash_fee_cents ?? 0) / 100).toLocaleString()}</p>
                  </>
                )}
                <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-semibold text-[#134e4a]">Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}</p>
              </div>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {GCASH_NUMBER && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">Send <strong>₱{(result.total_amount_cents / 100).toLocaleString()}</strong> to <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}). Put reference <span className="font-mono font-semibold">{result.reference}</span> in the message.</p>
                </div>
              )}

              {/* ── FIX 1: Payment proof REQUIRED ────────────────────── */}
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900 mb-1">📎 Upload Payment Proof <span className="text-red-600">*</span></p>
                  <p className="text-xs text-amber-700 mb-3">
                    Upload a screenshot of your GCash payment showing the reference number.
                    <strong className="block mt-1">Booking will not be confirmed without proof.</strong>
                  </p>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      className="sr-only"
                      onChange={() => setProofError("")}
                      disabled={uploadingProof || proofUploaded}
                    />
                    {uploadingProof ? "Uploading…" : proofUploaded ? "✓ Proof submitted" : "Choose screenshot or PDF"}
                  </label>
                  {paymentProofInputRef.current?.files?.[0] && !proofUploaded && (
                    <p className="mt-1 text-xs text-green-700">✓ {paymentProofInputRef.current.files[0].name} selected</p>
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
                  disabled={uploadingProof || proofUploaded}
                  className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
                >
                  {uploadingProof ? "Uploading…" : proofUploaded ? "✓ Done" : "Confirm Booking"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  {proofUploaded ? "Close" : "I'll upload later (booking stays pending)"}
                </button>
              </div>
              {/* ─────────────────────────────────────────────────────── */}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="text-sm text-[#134e4a]">Platform Service Fee (₱{(adminFeePerPax / 100).toLocaleString()}/pax): ₱{(adminFeeCents / 100).toLocaleString()}</p>
                  <p className="text-sm text-[#134e4a]">Payment Processing Fee: ₱{(gcashFee / 100).toLocaleString()}</p>
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

              <div>
                <p className="text-sm font-medium text-[#134e4a] mb-1">Address (for tickets and manifest)</p>
                <input type="text" required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="e.g. Brgy. Dapa, General Luna, Siargao" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                {loggedInAddress && <p className="mt-0.5 text-xs text-[#0f766e]">Pre-filled from your account.</p>}
              </div>

              {renderPassengerBlock("Adult", countAdult, adultNames, setAdultNames, adultAddresses, setAdultAddresses, adultExtras, setAdultExtras)}
              {renderPassengerBlock("Senior", countSenior, seniorNames, setSeniorNames, seniorAddresses, setSeniorAddresses, seniorExtras, setSeniorExtras)}
              {renderPassengerBlock("PWD", countPwd, pwdNames, setPwdNames, pwdAddresses, setPwdAddresses, pwdExtras, setPwdExtras)}
              {renderPassengerBlock("Child", countChild, childNames, setChildNames, childAddresses, setChildAddresses, childExtras, setChildExtras)}
              {renderPassengerBlock("Infant (<7)", countInfant, infantNames, setInfantNames, infantAddresses, setInfantAddresses, infantExtras, setInfantExtras)}

              {/* ── FIX 3: Senior / PWD ID notice ────────────────────── */}
              {seniorOrPwdPassengers.length > 0 && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-900">🪪 Senior Citizen / PWD ID Required</p>
                  <p className="text-xs text-blue-800">
                    Philippine law grants Senior Citizens and PWDs a 20% discount. To avail this,
                    a valid ID showing your date of birth (Senior Citizen ID, OSCA ID, PWD ID, or
                    any government-issued ID) must be presented upon boarding.
                  </p>
                  <div className="space-y-2">
                    {seniorOrPwdPassengers.map((pax) => (
                      <div key={pax.key} className="rounded-lg border border-blue-200 bg-white p-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">
                          {pax.fareType === "pwd" ? "PWD" : "Senior"}: {pax.name}
                        </p>
                        {pax.fareType === "adult-senior" && (
                          <p className="text-xs text-blue-700 mb-2">
                            ⚠️ This passenger appears to be 60 or older. They may qualify for the Senior Citizen discount — consider selecting &quot;Senior&quot; fare type instead to avail the 20% discount.
                          </p>
                        )}
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!idWaivers[pax.key]}
                            onChange={(e) => setIdWaivers((prev) => ({ ...prev, [pax.key]: e.target.checked }))}
                            className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600"
                          />
                          <span className="text-xs text-blue-800">
                            I acknowledge the ID requirement. I choose to <strong>waive the Senior/PWD discount</strong> and will not present an ID upon boarding.
                          </span>
                        </label>
                        {idWaivers[pax.key] && (
                          <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            ⚠️ Waiver recorded. This passenger will be charged the regular fare and no ID will be required. This is final.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* ─────────────────────────────────────────────────────── */}

              <div className="border-t border-teal-200 pt-4">
                <p className="text-sm font-medium text-[#134e4a] mb-2">Contact (for this booking)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Email</label>
                    <input type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    {loggedInEmail && <p className="mt-1 text-xs text-[#0f766e]">Using your account email — this booking will appear in My Bookings.</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Mobile Number</label>
                    <input type="tel" required value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="e.g. 09XX XXX XXXX" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                    <p className="mt-0.5 text-xs text-[#0f766e]">Used on the manifest for all passengers unless individually overridden.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Also Notify (optional)</label>
                    <input type="email" value={notifyAlsoEmail} onChange={(e) => setNotifyAlsoEmail(e.target.value)} placeholder="Another email to receive the same notification" className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" aria-label="Optional second email for notifications" />
                    <p className="mt-0.5 text-xs text-[#0f766e]/80">e.g. travel partner or family — they&apos;ll get the payment required email too.</p>
                  </div>
                </div>
              </div>

              {/* ── FIX 2: Terms & Privacy checkbox ──────────────────── */}
              <div className={`rounded-xl border-2 p-4 ${termsAccepted ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-amber-400 text-[#0c7b93] focus:ring-[#0c7b93]"
                  />
                  <span className="text-sm text-[#134e4a]">
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">Privacy Policy</a>
                    . I understand the refund and cancellation policy, including that once the vessel has departed, rebooking is not available.
                    <span className="block mt-1 text-xs text-[#0f766e]">This acceptance is recorded with your booking (v{TERMS_VERSION}).</span>
                  </span>
                </label>
              </div>
              {/* ─────────────────────────────────────────────────────── */}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm font-semibold text-red-700">⚠ {error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || totalPassengers < 1 || !termsAccepted}
                  className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
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
