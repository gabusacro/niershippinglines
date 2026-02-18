"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ActionToast";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { formatTime, passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME, GCASH_FEE_CENTS, ADMIN_FEE_CENTS_PER_PASSENGER } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";

const FARE_TYPE_OPTIONS = [
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
  { value: "pwd", label: "PWD" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant (<7)" },
] as const;

function fareCents(base: number, discount: number, fareType: string): number {
  if (fareType === "adult") return base;
  if (fareType === "infant") return 0;
  return Math.round(base * (1 - discount / 100));
}

type FareRow = { base_fare_cents: number; discount_percent: number };

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (len > arr.length) return [...arr, ...Array(len - arr.length).fill("")];
  return arr.slice(0, len);
}

export function BookingModal({
  trip,
  onClose,
  loggedInEmail = "",
  passengerName,
  loggedInAddress = "",
}: {
  trip: UpcomingTripRow;
  onClose: () => void;
  loggedInEmail?: string;
  passengerName?: string;
  loggedInAddress?: string;
}) {
  const routeName =
    trip.route?.display_name ??
    [trip.route?.origin, trip.route?.destination].filter(Boolean).join(" ↔ ") ??
    "—";
  const vesselName = trip.boat?.name ?? "—";
  const toast = useToast();

  const [fare, setFare] = useState<FareRow | null>(null);
  const [countAdult, setCountAdult] = useState(1);
  const [countSenior, setCountSenior] = useState(0);
  const [countPwd, setCountPwd] = useState(0);
  const [countChild, setCountChild] = useState(0);
  const [countInfant, setCountInfant] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([
    passengerName ?? "",
  ]);
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [proofUploaded, setProofUploaded] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
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

  const routeId = trip.route?.id;
  useEffect(() => {
    if (!routeId) return;
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.base_fare_cents != null) {
          setFare({
            base_fare_cents: data.base_fare_cents,
            discount_percent: data.discount_percent ?? 20,
          });
        }
      })
      .catch(() => {});
  }, [routeId]);

  useEffect(() => {
    setAdultNames((prev) => ensureLength(prev, countAdult));
    setAdultAddresses((prev) => ensureLength(prev, countAdult));
  }, [countAdult]);
  useEffect(() => {
    setSeniorNames((prev) => ensureLength(prev, countSenior));
    setSeniorAddresses((prev) => ensureLength(prev, countSenior));
  }, [countSenior]);
  useEffect(() => {
    setPwdNames((prev) => ensureLength(prev, countPwd));
    setPwdAddresses((prev) => ensureLength(prev, countPwd));
  }, [countPwd]);
  useEffect(() => {
    setChildNames((prev) => ensureLength(prev, countChild));
    setChildAddresses((prev) => ensureLength(prev, countChild));
  }, [countChild]);
  useEffect(() => {
    setInfantNames((prev) => ensureLength(prev, countInfant));
    setInfantAddresses((prev) => ensureLength(prev, countInfant));
  }, [countInfant]);

  const baseFare = fare?.base_fare_cents ?? 55000;
  const discount = fare?.discount_percent ?? 20;

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string; address: string }[] = [];
    const mainAddr = customerAddress.trim();
    for (let i = 0; i < countAdult; i++) list.push({ fare_type: "adult", full_name: adultNames[i]?.trim() ?? "", address: adultAddresses[i]?.trim() || mainAddr });
    for (let i = 0; i < countSenior; i++) list.push({ fare_type: "senior", full_name: seniorNames[i]?.trim() ?? "", address: seniorAddresses[i]?.trim() || mainAddr });
    for (let i = 0; i < countPwd; i++) list.push({ fare_type: "pwd", full_name: pwdNames[i]?.trim() ?? "", address: pwdAddresses[i]?.trim() || mainAddr });
    for (let i = 0; i < countChild; i++) list.push({ fare_type: "child", full_name: childNames[i]?.trim() ?? "", address: childAddresses[i]?.trim() || mainAddr });
    for (let i = 0; i < countInfant; i++) list.push({ fare_type: "infant", full_name: infantNames[i]?.trim() ?? "", address: infantAddresses[i]?.trim() || mainAddr });
    return list;
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames, adultAddresses, seniorAddresses, pwdAddresses, childAddresses, infantAddresses, customerAddress]);

  const fareSubtotalCents = useMemo(
    () => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0),
    [passengerDetails, baseFare, discount]
  );
  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;
  const adminFeeCents = totalPassengers * ADMIN_FEE_CENTS_PER_PASSENGER;
  const totalCents = fareSubtotalCents + GCASH_FEE_CENTS + adminFeeCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (totalPassengers < 1) {
      setError("Add at least one passenger (e.g. 1 Adult).");
      return;
    }
    const hasEmptyName = passengerDetails.some((p) => !p.full_name);
    if (hasEmptyName) {
      setError("Please enter the name for every passenger.");
      return;
    }
    if (!customerEmail.trim() || !customerMobile.trim()) {
      setError("Please enter contact email and mobile number.");
      return;
    }
    if (!customerAddress.trim()) {
      setError("Please enter address (required for tickets and manifest).");
      return;
    }
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
          passenger_details: passengerDetails.map((p) => ({ fare_type: p.fare_type, full_name: p.full_name, address: p.address })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Booking failed");
        return;
      }
      setResult({
        reference: data.reference,
        total_amount_cents: data.total_amount_cents,
        fare_breakdown: data.fare_breakdown,
      });
      toast.showSuccess(`Booking ${data.reference} created. Upload payment proof below to confirm.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmBooking = async () => {
    const file = paymentProofInputRef.current?.files?.[0];
    if (!file) {
      setProofError("Please upload your GCash payment screenshot first.");
      return;
    }
    if (!result?.reference) return;
    setProofError("");
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.set("reference", result.reference);
      formData.set("file", file);
      const res = await fetch("/api/booking/upload-proof", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProofError(data.error ?? "Upload failed");
        return;
      }
      setProofUploaded(true);
      toast.showSuccess("Payment proof uploaded. We'll verify and confirm your booking soon.");
      router.refresh();
      onClose();
    } catch {
      setProofError("Network error. Please try again.");
    } finally {
      setUploadingProof(false);
      if (paymentProofInputRef.current) paymentProofInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-teal-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white px-4 py-3">
          <h2 id="booking-modal-title" className="text-lg font-bold text-[#134e4a]">
            Book This Trip
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#0f766e] hover:bg-teal-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl border border-teal-200 bg-[#fef9e7]/50 px-4 py-3 mb-4">
            <p className="font-semibold text-[#134e4a]">{formatTime(trip.departure_time)} · {vesselName}</p>
            <p className="text-sm text-[#0f766e]">{routeName}</p>
            <p className="text-xs text-[#0f766e] mt-1">
              {new Date(trip.departure_date + "Z").toLocaleDateString("en-PH", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {result ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
              <p className="font-semibold text-[#134e4a]">Booking created</p>
              <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Status: Pending payment</p>
              <p className="font-mono text-xl font-bold text-[#0c7b93] mt-2">Reference: {result.reference}</p>

              {/* Discount & charges breakdown */}
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
                            {isFree ? (
                              <strong>Free</strong>
                            ) : isDiscounted ? (
                              <>₱{(base / 100).toLocaleString()} − {discountPct}% = <strong>₱{(p.per_person_cents / 100).toLocaleString()}</strong></>
                            ) : (
                              <strong>₱{(p.per_person_cents / 100).toLocaleString()}</strong>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {result.fare_breakdown?.fare_subtotal_cents != null && (
                  <>
                    <p className="mt-2 text-sm text-[#134e4a]">Fare: ₱{(result.fare_breakdown.fare_subtotal_cents / 100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">Admin Fee (₱20/pax): ₱{((result.fare_breakdown.admin_fee_cents ?? 0) / 100).toLocaleString()}</p>
                    <p className="text-sm text-[#134e4a]">GCash Fee: ₱{((result.fare_breakdown.gcash_fee_cents ?? 0) / 100).toLocaleString()}</p>
                  </>
                )}
                <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-semibold text-[#134e4a]">
                  Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {/* Pay via GCash */}
              {GCASH_NUMBER && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Pay via GCash</p>
                  <p className="text-sm text-amber-900">
                    Send <strong>₱{(result.total_amount_cents / 100).toLocaleString()}</strong> to <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}). Put reference <span className="font-mono font-semibold">{result.reference}</span> in the message.
                  </p>
                </div>
              )}

              {/* Submit payment proof + Confirm Booking */}
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Submit payment proof</p>
                  <p className="text-xs text-[#0f766e] mb-2">
                    Upload a screenshot of your GCash payment showing the reference number so we can confirm your booking faster.
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
                    {uploadingProof ? "Uploading…" : proofUploaded ? "Proof submitted" : "Choose screenshot or PDF"}
                  </label>
                </div>
                {proofError && <p className="text-sm text-red-600">{proofError}</p>}
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={uploadingProof || proofUploaded}
                  className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
                >
                  {uploadingProof ? "Uploading…" : proofUploaded ? "Done" : "Confirm Booking"}
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full rounded-xl border border-[#0c7b93] px-4 py-2 text-sm font-medium text-[#0c7b93] hover:bg-[#0c7b93]/10"
              >
                {proofUploaded ? "Close" : "I'll upload later"}
              </button>
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
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={count}
                        onChange={(e) => setCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                      />
                    </div>
                  );
                })}
              </div>

              {totalPassengers > 0 && fare && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-[#0f766e]">Amount breakdown</p>
                  <p className="text-sm text-[#134e4a]">Fare: ₱{(fareSubtotalCents / 100).toLocaleString()}</p>
                  <p className="text-sm text-[#134e4a]">Admin Fee (₱20/pax): ₱{(adminFeeCents / 100).toLocaleString()}</p>
                  <p className="text-sm text-[#134e4a]">GCash Fee: ₱{(GCASH_FEE_CENTS / 100).toLocaleString()}</p>
                  <p className="text-sm font-semibold text-[#134e4a] pt-1 border-t border-teal-200">
                    Total: ₱{(totalCents / 100).toLocaleString()} ({totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""})
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <TranslatableNotices listClassName="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1" />
              </div>

              {/* Address */}
              <div>
                <p className="text-sm font-medium text-[#134e4a] mb-1">Address (for tickets and manifest)</p>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                />
                {loggedInAddress && <p className="mt-0.5 text-xs text-[#0f766e]">Pre-filled from your account.</p>}
              </div>

              {/* Names per type */}
              {countAdult > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Adult — Full Name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countAdult }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <input
                          type="text"
                          required
                          value={adultNames[i] ?? ""}
                          onChange={(e) => {
                            const next = [...adultNames];
                            next[i] = e.target.value;
                            setAdultNames(next);
                          }}
                          placeholder={`Adult ${i + 1} name`}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                        <input
                          type="text"
                          value={adultAddresses[i] ?? ""}
                          onChange={(e) => {
                            const next = [...adultAddresses];
                            next[i] = e.target.value;
                            setAdultAddresses(next);
                          }}
                          placeholder="Different address (optional)"
                          className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {countSenior > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Senior — Full Name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countSenior }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <input
                          type="text"
                          required
                          value={seniorNames[i] ?? ""}
                          onChange={(e) => {
                            const next = [...seniorNames];
                            next[i] = e.target.value;
                            setSeniorNames(next);
                          }}
                          placeholder={`Senior ${i + 1} name`}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                        <input
                          type="text"
                          value={seniorAddresses[i] ?? ""}
                          onChange={(e) => {
                            const next = [...seniorAddresses];
                            next[i] = e.target.value;
                            setSeniorAddresses(next);
                          }}
                          placeholder="Different address (optional)"
                          className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {countPwd > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">PWD — Full Name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countPwd }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <input
                          type="text"
                          required
                          value={pwdNames[i] ?? ""}
                          onChange={(e) => {
                            const next = [...pwdNames];
                            next[i] = e.target.value;
                            setPwdNames(next);
                          }}
                          placeholder={`PWD ${i + 1} name`}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                        <input
                          type="text"
                          value={pwdAddresses[i] ?? ""}
                          onChange={(e) => {
                            const next = [...pwdAddresses];
                            next[i] = e.target.value;
                            setPwdAddresses(next);
                          }}
                          placeholder="Different address (optional)"
                          className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {countChild > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Child — Full Name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countChild }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <input
                          type="text"
                          required
                          value={childNames[i] ?? ""}
                          onChange={(e) => {
                            const next = [...childNames];
                            next[i] = e.target.value;
                            setChildNames(next);
                          }}
                          placeholder={`Child ${i + 1} name`}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                        <input
                          type="text"
                          value={childAddresses[i] ?? ""}
                          onChange={(e) => {
                            const next = [...childAddresses];
                            next[i] = e.target.value;
                            setChildAddresses(next);
                          }}
                          placeholder="Different address (optional)"
                          className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {countInfant > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Infant (&lt;7) — Full Name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countInfant }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <input
                          type="text"
                          required
                          value={infantNames[i] ?? ""}
                          onChange={(e) => {
                            const next = [...infantNames];
                            next[i] = e.target.value;
                            setInfantNames(next);
                          }}
                          placeholder={`Infant ${i + 1} name`}
                          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                        <input
                          type="text"
                          value={infantAddresses[i] ?? ""}
                          onChange={(e) => {
                            const next = [...infantAddresses];
                            next[i] = e.target.value;
                            setInfantAddresses(next);
                          }}
                          placeholder="Different address (optional)"
                          className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-teal-200 pt-4">
                <p className="text-sm font-medium text-[#134e4a] mb-2">Contact (for this booking)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                    />
                    {loggedInEmail && (
                      <p className="mt-1 text-xs text-[#0f766e]">
                        Using your account email — this booking will appear in My Bookings.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      placeholder="e.g. 09XX XXX XXXX"
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Also Notify (optional)</label>
                    <input
                      type="email"
                      value={notifyAlsoEmail}
                      onChange={(e) => setNotifyAlsoEmail(e.target.value)}
                      placeholder="Another email to receive the same notification"
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                      aria-label="Optional second email for notifications"
                    />
                    <p className="mt-0.5 text-xs text-[#0f766e]/80">
                      e.g. travel partner or family — they&apos;ll get the payment required email too.
                    </p>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || totalPassengers < 1}
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
