"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES, ADMIN_FEE_CENTS_PER_PASSENGER, BOOKING_NOTICES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";
import type { TripForManualBooking } from "@/lib/admin/get-trips-for-manual-booking";
import { formatTime } from "@/lib/dashboard/format";
import { getDayLabelExplicit } from "@/lib/dashboard/format";

// ── Per-type fare calculation using live fee settings ─────────────────────────
// NOTE: discountPercent is only used as a fallback for fare types not covered
// by fee_settings (shouldn't happen in practice). The real discounts come from
// farePreview which is populated from /api/booking/fare → fee_settings in DB.
function fareCents(
  baseFareCents: number,
  fareType: string,
  seniorDiscount: number,
  pwdDiscount: number,
  childDiscount: number,
  infantIsFree: boolean
): number {
  if (fareType === "adult")   return baseFareCents;
  if (fareType === "infant")  return infantIsFree ? 0 : baseFareCents;
  if (fareType === "senior")  return Math.round(baseFareCents * (1 - seniorDiscount / 100));
  if (fareType === "pwd")     return Math.round(baseFareCents * (1 - pwdDiscount    / 100));
  if (fareType === "child")   return Math.round(baseFareCents * (1 - childDiscount  / 100));
  if (fareType === "student") return Math.round(baseFareCents * (1 - pwdDiscount    / 100));
  return baseFareCents;
}

const FARE_TYPE_OPTIONS = [
  { value: "adult",   label: "Adult"       },
  { value: "senior",  label: "Senior"      },
  { value: "pwd",     label: "PWD"         },
  { value: "child",   label: "Child"       },
  { value: "infant",  label: "Infant (<7)" },
];

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (arr.length > len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill("")];
}

export function ManualBookingForm({ trips }: { trips: TripForManualBooking[] }) {
  const router = useRouter();
  const toast  = useToast();

  const [tripId,           setTripId]           = useState("");
  const [customerEmail,    setCustomerEmail]    = useState("");
  const [customerMobile,   setCustomerMobile]   = useState("");
  const [customerAddress,  setCustomerAddress]  = useState("");
  const [notifyAlsoEmail,  setNotifyAlsoEmail]  = useState("");
  const [addressPrefilledFromAccount, setAddressPrefilledFromAccount] = useState(false);

  const [countAdult,   setCountAdult]   = useState(0);
  const [countSenior,  setCountSenior]  = useState(0);
  const [countPwd,     setCountPwd]     = useState(0);
  const [countChild,   setCountChild]   = useState(0);
  const [countInfant,  setCountInfant]  = useState(0);

  const [adultNames,    setAdultNames]    = useState<string[]>([""]);
  const [adultAddresses,setAdultAddresses]= useState<string[]>([]);
  const [seniorNames,   setSeniorNames]   = useState<string[]>([""]);
  const [seniorAddresses,setSeniorAddresses]=useState<string[]>([]);
  const [pwdNames,      setPwdNames]      = useState<string[]>([""]);
  const [pwdAddresses,  setPwdAddresses]  = useState<string[]>([]);
  const [childNames,    setChildNames]    = useState<string[]>([""]);
  const [childAddresses,setChildAddresses]= useState<string[]>([]);
  const [infantNames,   setInfantNames]   = useState<string[]>([""]);
  const [infantAddresses,setInfantAddresses]=useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState<{ reference: string; total: number } | null>(null);

  // farePreview now carries ALL fee_settings fields from /api/booking/fare
  const [farePreview, setFarePreview] = useState<{
    base_fare_cents: number;
    discount_percent: number;
    // Fee amounts
    admin_fee_cents_per_passenger: number;
    gcash_fee_cents: number;
    // Walk-in fee toggle — from fee_settings.admin_fee_applies_walkin
    admin_fee_applies_walkin: boolean;
    // Labels
    admin_fee_label: string;
    gcash_fee_label: string;
    gcash_fee_show_breakdown: boolean;
    // Per-type discounts
    senior_discount_percent: number;
    pwd_discount_percent: number;
    child_discount_percent: number;
    infant_is_free: boolean;
  } | null>(null);

  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;

  // ── Sync name/address array lengths ────────────────────────────────────────
  useEffect(() => {
    setAdultNames(    (p) => ensureLength(p, countAdult  || 1));
    setAdultAddresses((p) => ensureLength(p, countAdult));
    setSeniorNames(   (p) => ensureLength(p, countSenior));
    setSeniorAddresses((p)=> ensureLength(p, countSenior));
    setPwdNames(      (p) => ensureLength(p, countPwd));
    setPwdAddresses(  (p) => ensureLength(p, countPwd));
    setChildNames(    (p) => ensureLength(p, countChild));
    setChildAddresses((p) => ensureLength(p, countChild));
    setInfantNames(   (p) => ensureLength(p, countInfant));
    setInfantAddresses((p)=> ensureLength(p, countInfant));
  }, [countAdult, countSenior, countPwd, countChild, countInfant]);

  const mainAddr = customerAddress.trim();

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string; address: string }[] = [];
    for (let i = 0; i < countAdult;  i++) list.push({ fare_type: "adult",  full_name: adultNames[i]?.trim()  ?? "", address: adultAddresses[i]?.trim()  || mainAddr });
    for (let i = 0; i < countSenior; i++) list.push({ fare_type: "senior", full_name: seniorNames[i]?.trim() ?? "", address: seniorAddresses[i]?.trim() || mainAddr });
    for (let i = 0; i < countPwd;    i++) list.push({ fare_type: "pwd",    full_name: pwdNames[i]?.trim()    ?? "", address: pwdAddresses[i]?.trim()    || mainAddr });
    for (let i = 0; i < countChild;  i++) list.push({ fare_type: "child",  full_name: childNames[i]?.trim()  ?? "", address: childAddresses[i]?.trim()  || mainAddr });
    for (let i = 0; i < countInfant; i++) list.push({ fare_type: "infant", full_name: infantNames[i]?.trim() ?? "", address: infantAddresses[i]?.trim() || mainAddr });
    return list.filter((p) => p.full_name.length > 0);
  }, [countAdult,countSenior,countPwd,countChild,countInfant,adultNames,seniorNames,pwdNames,childNames,infantNames,adultAddresses,seniorAddresses,pwdAddresses,childAddresses,infantAddresses,mainAddr]);

  const tripsWithSpace = trips.filter((t) => {
    const ob       = t.online_booked  ?? 0;
    const wb       = t.walk_in_booked ?? 0;
    const capacity = (t.boat as { capacity?: number })?.capacity ?? (t.online_quota ?? 0) + (t.walk_in_quota ?? 0);
    return Math.max(0, capacity - ob - wb) > 0;
  });

  const selectedTrip = tripId ? tripsWithSpace.find((t) => t.id === tripId) : null;
  const routeId = selectedTrip?.route?.id ?? null;

  // ── Fetch fare + ALL fee_settings for selected route ───────────────────────
  useEffect(() => {
    if (!routeId || totalPassengers < 1) { setFarePreview(null); return; }
    fetch(`/api/booking/fare?route_id=${encodeURIComponent(routeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.base_fare_cents != null) {
          setFarePreview({
            base_fare_cents:               data.base_fare_cents,
            discount_percent:              data.discount_percent              ?? 20,
            admin_fee_cents_per_passenger: data.admin_fee_cents_per_passenger ?? ADMIN_FEE_CENTS_PER_PASSENGER,
            gcash_fee_cents:               data.gcash_fee_cents               ?? 0,
            // ✅ Walk-in toggle — read from fee_settings via the fare API
            admin_fee_applies_walkin:      data.admin_fee_applies_walkin      ?? true,
            admin_fee_label:               data.admin_fee_label               ?? "Platform Service Fee",
            gcash_fee_label:               data.gcash_fee_label               ?? "Payment Processing Fee",
            gcash_fee_show_breakdown:      data.gcash_fee_show_breakdown      ?? true,
            senior_discount_percent:       data.senior_discount_percent       ?? 20,
            pwd_discount_percent:          data.pwd_discount_percent          ?? 20,
            child_discount_percent:        data.child_discount_percent        ?? 50,
            infant_is_free:                data.infant_is_free                ?? true,
          });
        } else {
          setFarePreview(null);
        }
      })
      .catch(() => setFarePreview(null));
  }, [routeId, totalPassengers]);

  // ── Fare breakdown using live fee_settings ─────────────────────────────────
  const fareBreakdown = useMemo(() => {
    if (!farePreview || totalPassengers < 1) return null;

    const base = farePreview.base_fare_cents;

    // Per-passenger fare using per-type discounts from fee_settings
    const fareSubtotalCents =
      countAdult  * fareCents(base, "adult",  farePreview.senior_discount_percent, farePreview.pwd_discount_percent, farePreview.child_discount_percent, farePreview.infant_is_free) +
      countSenior * fareCents(base, "senior", farePreview.senior_discount_percent, farePreview.pwd_discount_percent, farePreview.child_discount_percent, farePreview.infant_is_free) +
      countPwd    * fareCents(base, "pwd",    farePreview.senior_discount_percent, farePreview.pwd_discount_percent, farePreview.child_discount_percent, farePreview.infant_is_free) +
      countChild  * fareCents(base, "child",  farePreview.senior_discount_percent, farePreview.pwd_discount_percent, farePreview.child_discount_percent, farePreview.infant_is_free) +
      countInfant * fareCents(base, "infant", farePreview.senior_discount_percent, farePreview.pwd_discount_percent, farePreview.child_discount_percent, farePreview.infant_is_free);

    // ✅ Platform Service Fee: only charge if admin enabled it for walk-ins
    const adminFeeCents = farePreview.admin_fee_applies_walkin
      ? totalPassengers * farePreview.admin_fee_cents_per_passenger
      : 0;

    // ✅ Payment Processing Fee: always ₱0 for walk-ins (cash payment, no GCash)
    const gcashCents = 0;

    const totalCents = fareSubtotalCents + adminFeeCents + gcashCents;

    return {
      fareSubtotalCents,
      adminFeeCents,
      gcashCents,
      totalCents,
      adminFeePerPax: farePreview.admin_fee_cents_per_passenger,
    };
  }, [farePreview, totalPassengers, countAdult, countSenior, countPwd, countChild, countInfant]);

  // ── Passenger email lookup ─────────────────────────────────────────────────
  const lookupPassenger = useCallback((email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    fetch(`/api/admin/lookup-passenger?email=${encodeURIComponent(e)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.found && data.address) {
          setCustomerAddress(data.address);
          setAddressPrefilledFromAccount(true);
          if (data.full_name) {
            setAdultNames((prev) => {
              if (countAdult > 0 && (!prev[0] || !prev[0].trim())) {
                return [data.full_name, ...prev.slice(1)];
              }
              return prev;
            });
          }
        }
      })
      .catch(() => {});
  }, [countAdult]);

  const handleEmailBlur = () => lookupPassenger(customerEmail);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(null);
    if (!tripId)                               { setError("Select a trip."); return; }
    if (totalPassengers < 1)                   { setError("Add at least one passenger (set count and names)."); return; }
    if (passengerDetails.length !== totalPassengers) { setError("Fill in the full name for every passenger."); return; }
    if (!customerAddress.trim())               { setError("Address is required (for tickets and Coast Guard manifest)."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id:           tripId,
          customer_email:    customerEmail.trim(),
          customer_mobile:   customerMobile.trim() || null,
          customer_address:  customerAddress.trim(),
          notify_also_email: notifyAlsoEmail.trim() || undefined,
          passenger_details: passengerDetails.map((p) => ({
            fare_type:  p.fare_type,
            full_name:  p.full_name,
            address:    p.address,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Failed to create booking."); return; }

      setSuccess({ reference: data.reference ?? "", total: data.total_amount_cents ?? 0 });
      toast.showSuccess(`Walk-in booking ${data.reference ?? ""} created successfully`);

      // Reset form
      setTripId(""); setCustomerEmail(""); setCustomerMobile(""); setCustomerAddress(""); setNotifyAlsoEmail(""); setAddressPrefilledFromAccount(false);
      setCountAdult(0); setCountSenior(0); setCountPwd(0); setCountChild(0); setCountInfant(0);
      setAdultNames([""]); setAdultAddresses([]); setSeniorNames([]); setSeniorAddresses([]);
      setPwdNames([]); setPwdAddresses([]); setChildNames([]); setChildAddresses([]);
      setInfantNames([]); setInfantAddresses([]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/50 p-6">
        <p className="font-semibold text-[#134e4a]">Manual Booking Created</p>
        <p className="mt-2 font-mono text-lg font-bold text-[#0c7b93]">Reference: {success.reference}</p>
        <p className="mt-1 text-sm text-[#134e4a]">Total: ₱{(success.total / 100).toLocaleString()} · Walk-in seats updated in Supabase.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`/bookings/${success.reference}/tickets`} target="_blank" rel="noopener noreferrer"
            className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]">
            Print tickets →
          </a>
          <button type="button" onClick={() => setSuccess(null)}
            className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            Add another
          </button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">

      {/* Trip selector */}
      <div>
        <label className="block text-sm font-medium text-[#134e4a]">Trip (date, time, route)</label>
        <select required value={tripId} onChange={(e) => setTripId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]">
          <option value="">Select a trip</option>
          {(() => {
            const groupKey = (t: TripForManualBooking) => `${t.route?.id ?? ""}-${t.departure_date ?? ""}`;
            const byGroup = new Map<string, TripForManualBooking[]>();
            for (const t of tripsWithSpace) {
              const key  = groupKey(t);
              const list = byGroup.get(key) ?? [];
              list.push(t);
              byGroup.set(key, list);
            }
            for (const list of byGroup.values()) {
              list.sort((a, b) => (a.departure_time ?? "").localeCompare(b.departure_time ?? ""));
            }
            const tripIndexInRoute = (t: TripForManualBooking) => {
              const list = byGroup.get(groupKey(t)) ?? [];
              const idx  = list.findIndex((x) => x.id === t.id);
              return idx >= 0 ? idx : 0;
            };
            return tripsWithSpace.map((t) => {
              const ob        = t.online_booked  ?? 0;
              const wb        = t.walk_in_booked ?? 0;
              const capacity  = (t.boat as { capacity?: number })?.capacity ?? (t.online_quota ?? 0) + (t.walk_in_quota ?? 0);
              const available = Math.max(0, capacity - ob - wb);
              const origin    = t.route?.origin      ?? "";
              const dest      = t.route?.destination ?? "";
              const idx       = tripIndexInRoute(t);
              const dir       = idx === 0 ? `${origin} → ${dest}` : `${dest} → ${origin}`;
              return (
                <option key={t.id} value={t.id}>
                  {getDayLabelExplicit(t.departure_date)} {formatTime(t.departure_time)} — {dir} — {t.boat?.name ?? "—"} ({available} seats available, {ob + wb} booked)
                </option>
              );
            });
          })()}
        </select>
        {tripsWithSpace.length === 0 && (
          <p className="mt-1 text-sm text-amber-700">No trips with walk-in seats in the next 7 days.</p>
        )}
      </div>

      {/* Passenger counts */}
      <div>
        <p className="text-sm font-medium text-[#134e4a]">Number of passengers by type</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FARE_TYPE_OPTIONS.map(({ value, label }) => {
            const count    = value === "adult" ? countAdult : value === "senior" ? countSenior : value === "pwd" ? countPwd : value === "child" ? countChild : countInfant;
            const setCount = value === "adult" ? setCountAdult : value === "senior" ? setCountSenior : value === "pwd" ? setCountPwd : value === "child" ? setCountChild : setCountInfant;
            return (
              <div key={value}>
                <label className="block text-xs font-medium text-[#0f766e] mb-1 whitespace-nowrap">{label}</label>
                <input type="number" min={0} max={20} value={count}
                  onChange={(e) => setCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              </div>
            );
          })}
        </div>

        {/* ✅ Fare calculation — uses live fee_settings labels + walk-in toggle */}
        {totalPassengers > 0 && (
          <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-2 text-sm text-[#134e4a]">
            {fareBreakdown && farePreview ? (
              <>
                <p className="font-medium">Fare calculation</p>
                <div className="mt-1 space-y-0.5">
                  {/* Base fare subtotal */}
                  <p>Base fare: ₱{(fareBreakdown.fareSubtotalCents / 100).toLocaleString()}</p>

                  {/* Platform Service Fee — shows ₱0 if admin disabled it for walk-ins */}
                  <p>
                    {farePreview.admin_fee_label} (₱{(fareBreakdown.adminFeePerPax / 100).toLocaleString()}/pax
                    {!farePreview.admin_fee_applies_walkin && " — not applied to walk-ins"}):&nbsp;
                    ₱{(fareBreakdown.adminFeeCents / 100).toLocaleString()}
                  </p>

                  {/* Payment Processing Fee — always ₱0 for walk-ins */}
                  <p>{farePreview.gcash_fee_label} (walk-in): ₱0</p>

                  <p className="font-semibold pt-0.5 border-t border-teal-200 mt-1">
                    Total: ₱{(fareBreakdown.totalCents / 100).toLocaleString()}
                  </p>
                </div>
              </>
            ) : (
              <p>
                {totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""} — select a trip to see fare breakdown.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Notices */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
        <p className="text-xs font-semibold uppercase text-amber-800 mb-1">Important notices</p>
        <ul className="text-sm text-amber-900 space-y-1 list-disc list-outside pl-5 ml-1">
          {BOOKING_NOTICES.map((notice, i) => <li key={i}>{notice}</li>)}
        </ul>
      </div>

      {/* Address */}
      <div>
        <p className="text-sm font-medium text-[#134e4a] mb-1">Address (for tickets & Coast Guard manifest)</p>
        <input type="text" required value={customerAddress}
          onChange={(e) => { setCustomerAddress(e.target.value); setAddressPrefilledFromAccount(false); }}
          placeholder="e.g. Brgy. Dapa, General Luna, Siargao"
          className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
        {addressPrefilledFromAccount && (
          <p className="mt-0.5 text-xs text-[#0f766e]">Pre-filled from passenger account.</p>
        )}
      </div>

      {/* Passenger name blocks */}
      {countAdult > 0 && (
        <div>
          <p className="text-sm font-medium text-[#134e4a] mb-2">Adult — full name</p>
          <div className="space-y-2">
            {Array.from({ length: countAdult }, (_, i) => (
              <div key={i} className="space-y-1">
                <input type="text" required value={adultNames[i] ?? ""} placeholder={`Adult ${i + 1}`}
                  onChange={(e) => { const n = [...adultNames]; n[i] = e.target.value; setAdultNames(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                <input type="text" value={adultAddresses[i] ?? ""} placeholder="Different address (optional)"
                  onChange={(e) => { const n = [...adultAddresses]; n[i] = e.target.value; setAdultAddresses(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
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
                <input type="text" required value={seniorNames[i] ?? ""} placeholder={`Senior ${i + 1}`}
                  onChange={(e) => { const n = [...seniorNames]; n[i] = e.target.value; setSeniorNames(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                <input type="text" value={seniorAddresses[i] ?? ""} placeholder="Different address (optional)"
                  onChange={(e) => { const n = [...seniorAddresses]; n[i] = e.target.value; setSeniorAddresses(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
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
                <input type="text" required value={pwdNames[i] ?? ""} placeholder={`PWD ${i + 1}`}
                  onChange={(e) => { const n = [...pwdNames]; n[i] = e.target.value; setPwdNames(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                <input type="text" value={pwdAddresses[i] ?? ""} placeholder="Different address (optional)"
                  onChange={(e) => { const n = [...pwdAddresses]; n[i] = e.target.value; setPwdAddresses(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
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
                <input type="text" required value={childNames[i] ?? ""} placeholder={`Child ${i + 1}`}
                  onChange={(e) => { const n = [...childNames]; n[i] = e.target.value; setChildNames(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                <input type="text" value={childAddresses[i] ?? ""} placeholder="Different address (optional)"
                  onChange={(e) => { const n = [...childAddresses]; n[i] = e.target.value; setChildAddresses(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
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
                <input type="text" required value={infantNames[i] ?? ""} placeholder={`Infant ${i + 1}`}
                  onChange={(e) => { const n = [...infantNames]; n[i] = e.target.value; setInfantNames(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
                <input type="text" value={infantAddresses[i] ?? ""} placeholder="Different address (optional)"
                  onChange={(e) => { const n = [...infantAddresses]; n[i] = e.target.value; setInfantAddresses(n); }}
                  className="w-full rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="border-t border-teal-200 pt-4">
        <p className="text-sm font-medium text-[#134e4a] mb-2">Contact (for this booking)</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Email</label>
            <input type="email" required value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)} onBlur={handleEmailBlur}
              placeholder="Passenger email (enter account email to pre-fill address)"
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
            <p className="mt-0.5 text-xs text-[#0f766e]">
              If passenger has an account, address and name can be pre-filled when you leave this field.
            </p>
          </div>
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Mobile (optional)</label>
            <input type="tel" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)}
              placeholder="e.g. 09XX XXX XXXX"
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]" />
          </div>
          <div>
            <label className="block text-xs text-[#0f766e] mb-1">Also notify (optional)</label>
            <input type="email" value={notifyAlsoEmail} onChange={(e) => setNotifyAlsoEmail(e.target.value)}
              placeholder="Another email to receive confirmation (e.g. family or travel partner)"
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
              aria-label="Optional second email for notifications" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit"
          disabled={loading || tripsWithSpace.length === 0 || totalPassengers < 1 || !customerAddress.trim()}
          className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50">
          {loading ? "Creating…" : "Create walk-in booking"}
        </button>
        <Link href={ROUTES.admin}
          className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          ← Back to admin
        </Link>
      </div>
    </form>
  );
}
