"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { passengerTypeLabel } from "@/lib/dashboard/format";

type RouteRow = { id: string; origin: string; destination: string; display_name: string };
type TripRow = {
  id: string;
  departure_time: string;
  online_quota: number;
  online_booked: number;
  boat: { id: string; name: string } | null;
  route: { id: string; display_name: string; origin: string; destination: string } | null;
  port: { id: string; name: string } | null;
};
type FareRow = { base_fare_cents: number; discount_percent: number };

const FARE_TYPE_OPTIONS = [
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
  { value: "pwd", label: "PWD" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant (<7)" },
] as const;

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

type BookingFormProps = { loggedInEmail?: string; loggedInAddress?: string };

export default function BookingForm({ loggedInEmail = "", loggedInAddress = "" }: BookingFormProps) {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeId, setRouteId] = useState("");
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripId, setTripId] = useState("");
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
  const [customerEmail, setCustomerEmail] = useState(loggedInEmail);
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState(loggedInAddress);
  const [notifyAlsoEmail, setNotifyAlsoEmail] = useState("");
  const [adultAddresses, setAdultAddresses] = useState<string[]>([]);
  const [seniorAddresses, setSeniorAddresses] = useState<string[]>([]);
  const [pwdAddresses, setPwdAddresses] = useState<string[]>([]);
  const [childAddresses, setChildAddresses] = useState<string[]>([]);
  const [infantAddresses, setInfantAddresses] = useState<string[]>([]);
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
      total_cents?: number;
    };
  } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/booking/routes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRoutes(data);
        setLoadingRoutes(false);
      })
      .catch(() => setLoadingRoutes(false));
  }, []);

  useEffect(() => {
    if (!routeId || !date) {
      setTrips([]);
      setTripId("");
      return;
    }
    setLoadingTrips(true);
    setTripId("");
    fetch(`/api/booking/trips?route_id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => {
        setTrips(Array.isArray(data) ? data : []);
        setLoadingTrips(false);
      })
      .catch(() => setLoadingTrips(false));
  }, [routeId, date]);

  const loadFare = useCallback(() => {
    if (!routeId) {
      setFare(null);
      return;
    }
    setLoadingFare(true);
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        setFare(
          data?.base_fare_cents != null
            ? { base_fare_cents: data.base_fare_cents, discount_percent: data.discount_percent ?? 20 }
            : null
        );
        setLoadingFare(false);
      })
      .catch(() => setLoadingFare(false));
  }, [routeId]);

  useEffect(() => {
    loadFare();
  }, [loadFare]);

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
    for (let i = 0; i < countAdult; i++) {
      list.push({
        fare_type: "adult",
        full_name: adultNames[i]?.trim() ?? "",
        address: adultAddresses[i]?.trim() || mainAddr,
      });
    }
    for (let i = 0; i < countSenior; i++) {
      list.push({
        fare_type: "senior",
        full_name: seniorNames[i]?.trim() ?? "",
        address: seniorAddresses[i]?.trim() || mainAddr,
      });
    }
    for (let i = 0; i < countPwd; i++) {
      list.push({
        fare_type: "pwd",
        full_name: pwdNames[i]?.trim() ?? "",
        address: pwdAddresses[i]?.trim() || mainAddr,
      });
    }
    for (let i = 0; i < countChild; i++) {
      list.push({
        fare_type: "child",
        full_name: childNames[i]?.trim() ?? "",
        address: childAddresses[i]?.trim() || mainAddr,
      });
    }
    for (let i = 0; i < countInfant; i++) {
      list.push({
        fare_type: "infant",
        full_name: infantNames[i]?.trim() ?? "",
        address: infantAddresses[i]?.trim() || mainAddr,
      });
    }
    return list;
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames, adultAddresses, seniorAddresses, pwdAddresses, childAddresses, infantAddresses, customerAddress]);

  const totalCents = useMemo(
    () => passengerDetails.reduce((sum, p) => sum + fareCents(baseFare, discount, p.fare_type), 0),
    [passengerDetails, baseFare, discount]
  );
  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!tripId) {
      setError("Please select route, date, and departure time.");
      return;
    }
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
      setError("Please enter address (required for tickets and Coast Guard manifest).");
      return;
    }
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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#134e4a] mb-2">Booking created</h2>
        <p className="text-sm text-[#0f766e] mb-2">
          Your seats are reserved. Pay the amount below and present your reference (or payment proof) at the ticket booth to confirm.
        </p>
        <p className="font-mono text-xl font-bold text-[#0c7b93] mb-4">Reference: {result.reference}</p>
        {result.fare_breakdown?.passenger_details?.length ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 mb-4">
            <p className="text-xs font-semibold uppercase text-[#0f766e] mb-2">Fare breakdown</p>
            <ul className="space-y-2 text-sm text-[#134e4a]">
              {result.fare_breakdown.passenger_details.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{p.full_name} ({passengerTypeLabel(p.fare_type)})</span>
                  <span>{p.per_person_cents === 0 ? "Free" : `₱${(p.per_person_cents / 100).toLocaleString()}`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 pt-2 border-t border-teal-200 text-sm font-semibold text-[#134e4a]">
              Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#134e4a] mb-4">
            Total to pay: ₱{(result.total_amount_cents / 100).toLocaleString()}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setTripId("");
            setCountAdult(1);
            setCountSenior(0);
            setCountPwd(0);
            setCountChild(0);
            setCountInfant(0);
            setAdultNames([""]);
            setSeniorNames([]);
            setPwdNames([]);
            setChildNames([]);
            setInfantNames([]);
            setCustomerEmail("");
            setCustomerMobile("");
          }}
          className="rounded-xl border border-[#0c7b93] px-4 py-2 text-sm font-medium text-[#0c7b93] hover:bg-[#0c7b93]/10"
        >
          Create another booking
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-[#134e4a]">Book a trip</h2>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Route</label>
        <select
          value={routeId}
          onChange={(e) => {
            setRouteId(e.target.value);
            setTripId("");
          }}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          disabled={loadingRoutes}
          required
        >
          <option value="">Select route</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.display_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Travel date</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTripId("");
          }}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          required
        />
        {date === today && (
          <p className="mt-1 text-xs text-[#0f766e]">For today we only show trips that depart at least 30 minutes from now so you have time to pay and board.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#134e4a] mb-1">Departure time</label>
        <select
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          disabled={loadingTrips || !routeId || !date}
          required
        >
          <option value="">Select departure time</option>
          {trips.map((t) => {
            const avail = (t.online_quota ?? 0) - (t.online_booked ?? 0);
            const boatName = t.boat?.name ?? "—";
            const portName = t.port?.name;
            const portLabel = portName ? ` — ${portName}` : "";
            const timeStr = formatTime(t.departure_time);
            return (
              <option key={t.id} value={t.id}>
                {timeStr} — {boatName}{portLabel} ({avail} seats left)
              </option>
            );
          })}
        </select>
        {routeId && date && !loadingTrips && trips.length === 0 && (
          <p className="mt-1 text-xs text-[#0f766e]">No trips on this date for this route. Try another date.</p>
        )}
      </div>

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

      {countAdult > 0 && (
        <div>
          <p className="text-sm font-medium text-[#134e4a] mb-2">Adult — full name</p>
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
          <p className="text-sm font-medium text-[#134e4a] mb-2">Senior — full name</p>
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
          <p className="text-sm font-medium text-[#134e4a] mb-2">PWD — full name</p>
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
          <p className="text-sm font-medium text-[#134e4a] mb-2">Child — full name</p>
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
          <p className="text-sm font-medium text-[#134e4a] mb-2">Infant (&lt;7) — full name</p>
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
        <p className="text-sm font-medium text-[#134e4a] mb-2">Address (for tickets and Coast Guard manifest)</p>
        <div className="mb-4">
          <label className="block text-xs text-[#0f766e] mb-1">Group address</label>
          <input
            type="text"
            required
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
            className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
          />
          {loggedInAddress && (
            <p className="mt-1 text-xs text-[#0f766e]">Pre-filled from your account. Same for all passengers unless you enter a different one below.</p>
          )}
          {!loggedInAddress && (
            <p className="mt-1 text-xs text-[#0f766e]">Required. Used on tickets and manifest. Add your address in Dashboard if you book often.</p>
          )}
        </div>
      </div>

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
              <p className="mt-1 text-xs text-[#0f766e]">Using your account email — this booking will appear in My bookings.</p>
            )}
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
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Also notify (optional)</label>
            <input
              type="email"
              value={notifyAlsoEmail}
              onChange={(e) => setNotifyAlsoEmail(e.target.value)}
              placeholder="Another email to receive the same notification"
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              aria-label="Optional second email for notifications"
            />
            <p className="mt-0.5 text-xs text-[#0f766e]/80">e.g. travel partner or family — they’ll get the payment required email too.</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !tripId || totalPassengers < 1}
        className="w-full min-h-[44px] rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50 touch-manipulation"
      >
        {submitting ? "Creating…" : "Create booking"}
      </button>
    </form>
  );
}
