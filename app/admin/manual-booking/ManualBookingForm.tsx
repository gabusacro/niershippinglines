"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/components/ui/ActionToast";
import type { TripForManualBooking } from "@/lib/admin/get-trips-for-manual-booking";
import { formatTime } from "@/lib/dashboard/format";
import { getDayLabel } from "@/lib/dashboard/format";

const FARE_TYPE_OPTIONS = [
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
  { value: "pwd", label: "PWD" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant (<7)" },
];

function ensureLength(arr: string[], len: number): string[] {
  if (arr.length === len) return arr;
  if (arr.length > len) return arr.slice(0, len);
  return [...arr, ...Array(len - arr.length).fill("")];
}

export function ManualBookingForm({ trips }: { trips: TripForManualBooking[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tripId, setTripId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [countAdult, setCountAdult] = useState(0);
  const [countSenior, setCountSenior] = useState(0);
  const [countPwd, setCountPwd] = useState(0);
  const [countChild, setCountChild] = useState(0);
  const [countInfant, setCountInfant] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([""]);
  const [seniorNames, setSeniorNames] = useState<string[]>([""]);
  const [pwdNames, setPwdNames] = useState<string[]>([""]);
  const [childNames, setChildNames] = useState<string[]>([""]);
  const [infantNames, setInfantNames] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ reference: string; total: number } | null>(null);

  const totalPassengers = countAdult + countSenior + countPwd + countChild + countInfant;

  useEffect(() => {
    setAdultNames((prev) => ensureLength(prev, countAdult || 1));
    setSeniorNames((prev) => ensureLength(prev, countSenior));
    setPwdNames((prev) => ensureLength(prev, countPwd));
    setChildNames((prev) => ensureLength(prev, countChild));
    setInfantNames((prev) => ensureLength(prev, countInfant));
  }, [countAdult, countSenior, countPwd, countChild, countInfant]);

  const passengerDetails = useMemo(() => {
    const list: { fare_type: string; full_name: string }[] = [];
    for (let i = 0; i < countAdult; i++) list.push({ fare_type: "adult", full_name: adultNames[i]?.trim() ?? "" });
    for (let i = 0; i < countSenior; i++) list.push({ fare_type: "senior", full_name: seniorNames[i]?.trim() ?? "" });
    for (let i = 0; i < countPwd; i++) list.push({ fare_type: "pwd", full_name: pwdNames[i]?.trim() ?? "" });
    for (let i = 0; i < countChild; i++) list.push({ fare_type: "child", full_name: childNames[i]?.trim() ?? "" });
    for (let i = 0; i < countInfant; i++) list.push({ fare_type: "infant", full_name: infantNames[i]?.trim() ?? "" });
    return list.filter((p) => p.full_name.length > 0);
  }, [countAdult, countSenior, countPwd, countChild, countInfant, adultNames, seniorNames, pwdNames, childNames, infantNames]);

  const tripsWithSpace = trips.filter(
    (t) => (t.walk_in_quota ?? 0) - (t.walk_in_booked ?? 0) > 0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (!tripId) {
      setError("Select a trip.");
      return;
    }
    if (totalPassengers < 1) {
      setError("Add at least one passenger (set count and names).");
      return;
    }
    if (passengerDetails.length !== totalPassengers) {
      setError("Fill in the full name for every passenger.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          customer_email: customerEmail.trim(),
          customer_mobile: customerMobile.trim() || null,
          passenger_details: passengerDetails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create booking.");
        return;
      }
      setSuccess({
        reference: data.reference ?? "",
        total: data.total_amount_cents ?? 0,
      });
      toast.showSuccess(`Walk-in booking ${data.reference ?? ""} created successfully`);
      setTripId("");
      setCustomerEmail("");
      setCustomerMobile("");
      setCountAdult(0);
      setCountSenior(0);
      setCountPwd(0);
      setCountChild(0);
      setCountInfant(0);
      setAdultNames([""]);
      setSeniorNames([]);
      setPwdNames([]);
      setChildNames([]);
      setInfantNames([]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const ticketsUrl = `/bookings/${success.reference}/tickets`;
    return (
      <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/50 p-6">
        <p className="font-semibold text-[#134e4a]">Manual booking created</p>
        <p className="mt-2 font-mono text-lg font-bold text-[#0c7b93]">Reference: {success.reference}</p>
        <p className="mt-1 text-sm text-[#134e4a]">Total: ₱{(success.total / 100).toLocaleString()} · Walk-in seats updated in Supabase.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={ticketsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            Print tickets →
          </a>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-[#134e4a]">Trip (date, time, route)</label>
        <select
          required
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
        >
          <option value="">Select a trip</option>
          {tripsWithSpace.map((t) => {
            const avail = (t.walk_in_quota ?? 0) - (t.walk_in_booked ?? 0);
            const routeName = t.route?.display_name ?? [t.route?.origin, t.route?.destination].filter(Boolean).join(" → ") ?? "—";
            return (
              <option key={t.id} value={t.id}>
                {getDayLabel(t.departure_date)} {formatTime(t.departure_time)} — {routeName} — {t.boat?.name ?? "—"} (walk-in: {avail} seats)
              </option>
            );
          })}
        </select>
        {tripsWithSpace.length === 0 && (
          <p className="mt-1 text-sm text-amber-700">No trips with walk-in seats in the next 7 days.</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-[#134e4a]">Number of passengers by type</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
        {totalPassengers > 0 && (
          <p className="mt-2 text-sm text-[#0f766e]">{totalPassengers} passenger{totalPassengers !== 1 ? "s" : ""}</p>
        )}
      </div>

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
                onChange={(e) => { const n = [...adultNames]; n[i] = e.target.value; setAdultNames(n); }}
                placeholder={`Adult ${i + 1}`}
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
                onChange={(e) => { const n = [...seniorNames]; n[i] = e.target.value; setSeniorNames(n); }}
                placeholder={`Senior ${i + 1}`}
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
                onChange={(e) => { const n = [...pwdNames]; n[i] = e.target.value; setPwdNames(n); }}
                placeholder={`PWD ${i + 1}`}
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
                onChange={(e) => { const n = [...childNames]; n[i] = e.target.value; setChildNames(n); }}
                placeholder={`Child ${i + 1}`}
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
                onChange={(e) => { const n = [...infantNames]; n[i] = e.target.value; setInfantNames(n); }}
                placeholder={`Infant ${i + 1}`}
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
            <label className="block text-xs text-[#0f766e] mb-1">Mobile (optional)</label>
            <input
              type="tel"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full rounded-lg border border-teal-200 px-3 py-2 text-[#134e4a] focus:ring-2 focus:ring-[#0c7b93]"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading || tripsWithSpace.length === 0 || totalPassengers < 1}
          className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create walk-in booking"}
        </button>
        <Link
          href={ROUTES.admin}
          className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          ← Back to admin
        </Link>
      </div>
    </form>
  );
}
