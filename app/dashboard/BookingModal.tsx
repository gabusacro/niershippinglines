"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/ActionToast";
import type { UpcomingTripRow } from "@/lib/dashboard/get-upcoming-trips";
import { formatTime, passengerTypeLabel } from "@/lib/dashboard/format";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";

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
}: {
  trip: UpcomingTripRow;
  onClose: () => void;
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
  const [adultNames, setAdultNames] = useState<string[]>([""]);
  const [seniorNames, setSeniorNames] = useState<string[]>([]);
  const [pwdNames, setPwdNames] = useState<string[]>([]);
  const [childNames, setChildNames] = useState<string[]>([]);
  const [infantNames, setInfantNames] = useState<string[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    total_amount_cents: number;
    fare_breakdown?: {
      base_fare_cents?: number;
      discount_percent?: number;
      passenger_details?: { fare_type: string; full_name: string; per_person_cents: number }[];
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
  }, [countAdult]);
  useEffect(() => {
    setSeniorNames((prev) => ensureLength(prev, countSenior));
  }, [countSenior]);
  useEffect(() => {
    setPwdNames((prev) => ensureLength(prev, countPwd));
  }, [countPwd]);
  useEffect(() => {
    setChildNames((prev) => ensureLength(prev, countChild));
  }, [countChild]);
  useEffect(() => {
    setInfantNames((prev) => ensureLength(prev, countInfant));
  }, [countInfant]);

  const baseFare = fare?.base_fare_cents ?? 55000;
  const discount = fare?.discount_percent ?? 20;

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string }[] = [];
    for (let i = 0; i < countAdult; i++) list.push({ fare_type: "adult", full_name: adultNames[i]?.trim() ?? "" });
    for (let i = 0; i < countSenior; i++) list.push({ fare_type: "senior", full_name: seniorNames[i]?.trim() ?? "" });
    for (let i = 0; i < countPwd; i++) list.push({ fare_type: "pwd", full_name: pwdNames[i]?.trim() ?? "" });
    for (let i = 0; i < countChild; i++) list.push({ fare_type: "child", full_name: childNames[i]?.trim() ?? "" });
    for (let i = 0; i < countInfant; i++) list.push({ fare_type: "infant", full_name: infantNames[i]?.trim() ?? "" });
    return list;
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames]);

  const totalCents = useMemo(
    () => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0),
    [passengerDetails, baseFare, discount]
  );
  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;

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
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          customer_email: customerEmail.trim(),
          customer_mobile: customerMobile.trim(),
          passenger_details: passengerDetails.map((p) => ({ fare_type: p.fare_type, full_name: p.full_name })),
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
      toast.showSuccess(`Booking ${data.reference} created. Please upload payment proof to confirm.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
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
            Book this trip
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
                <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-semibold text-[#134e4a]">
                  Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}
                </p>
              </div>

              {/* Payment method */}
              <div className="mt-4 rounded-lg border border-teal-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Payment method</p>
                <ul className="space-y-2 text-sm text-[#134e4a]">
                  <li>
                    <strong>Ticket booth:</strong> Pay in person and present reference <span className="font-mono font-semibold">{result.reference}</span>.
                  </li>
                  {GCASH_NUMBER ? (
                    <li>
                      <strong>GCash deposit:</strong> Send <strong>₱{(result.total_amount_cents / 100).toLocaleString()}</strong> to the number below. Put reference <span className="font-mono font-semibold">{result.reference}</span> in the message. Show proof at the ticket booth.
                    </li>
                  ) : null}
                </ul>
                {GCASH_NUMBER ? (
                  <div className="mt-2 rounded bg-teal-50 p-2 text-sm">
                    <p><strong>GCash number:</strong> <span className="font-mono">{GCASH_NUMBER}</span></p>
                    {GCASH_ACCOUNT_NAME ? <p><strong>Account name:</strong> {GCASH_ACCOUNT_NAME}</p> : null}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e]"
              >
                Close
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
                <p className="text-sm text-[#0f766e]">
                  Total: <strong>₱{(totalCents / 100).toLocaleString()}</strong> ({totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""})
                </p>
              )}

              {/* Names per type */}
              {countAdult > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Adult — full name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countAdult }, (_, i) => (
                      <input
                        key={i}
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
                    ))}
                  </div>
                </div>
              )}
              {countSenior > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Senior — full name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countSenior }, (_, i) => (
                      <input
                        key={i}
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
                    ))}
                  </div>
                </div>
              )}
              {countPwd > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">PWD — full name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countPwd }, (_, i) => (
                      <input
                        key={i}
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
                    ))}
                  </div>
                </div>
              )}
              {countChild > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Child — full name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countChild }, (_, i) => (
                      <input
                        key={i}
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
                    ))}
                  </div>
                </div>
              )}
              {countInfant > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#134e4a] mb-2">Infant (&lt;7) — full name</p>
                  <div className="space-y-2">
                    {Array.from({ length: countInfant }, (_, i) => (
                      <input
                        key={i}
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
                  </div>
                  <div>
                    <label className="block text-xs text-[#0f766e] mb-1">Mobile number</label>
                    <input
                      type="tel"
                      required
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      placeholder="e.g. 09XX XXX XXXX"
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
                    />
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
                  {submitting ? "Creating…" : "Create booking"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
